import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { SyncApi } from './SyncApi';
import { SyncService } from './SyncService';
import { AuthStatus, SyncConfig, SyncProgress, ConflictInfo } from '../Sync.types';
import { DEFAULT_SYNC_CONFIG } from '../Sync.constants';
import { RequestManager } from '@/lib/requests/RequestManager';
import { getAppVersion } from '@/Manatan/utils/api';

interface SyncContextValue {
    // State
    status: AuthStatus | null;
    config: SyncConfig;
    is_syncing: boolean;
    lastSyncTime: Date | null;
    error: string | null;
    progress: SyncProgress | null;
    lastConflicts: ConflictInfo[];

    // Actions
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    sync: () => Promise<void>;
    pullOnly: () => Promise<void>;
    pushOnly: () => Promise<void>;
    updateConfig: (updates: Partial<SyncConfig>) => Promise<void>;
    refreshStatus: () => Promise<void>;
    clearError: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [status, setStatus] = useState<AuthStatus | null>(null);
    const [config, setConfig] = useState<SyncConfig>(DEFAULT_SYNC_CONFIG);
    const [is_syncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<SyncProgress | null>(null);
    const [lastConflicts, setLastConflicts] = useState<ConflictInfo[]>([]);

    // Load initial state and handle auth callback
    useEffect(() => {
        refreshStatus();
        loadConfig();
        setLastSyncTime(SyncService.getLastSyncTime());
        
        // Check if we're returning from auth flow
        const authInProgress = sessionStorage.getItem('sync_auth_in_progress');
        if (authInProgress) {
            sessionStorage.removeItem('sync_auth_in_progress');
            sessionStorage.removeItem('sync_auth_return_path');
        }
        
        // Check for error in URL (from auth callback)
        const urlParams = new URLSearchParams(window.location.search);
        const authError = urlParams.get('error');
        if (authError) {
            setError(`Authentication failed: ${authError}`);
            // Clean up URL
            urlParams.delete('error');
            const newSearch = urlParams.toString();
            const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
            window.history.replaceState(null, '', newUrl);
        }
    }, []);

    // Auto-sync on app start
    useEffect(() => {
        if (config.sync_on_app_start && status?.connected && !is_syncing) {
            sync();
        }
    }, [config.sync_on_app_start, status?.connected]);

    // Auto-sync on app resume (visibility change)
    useEffect(() => {
        if (!config.sync_on_app_resume || !status?.connected) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !is_syncing) {
                sync();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [config.sync_on_app_resume, status?.connected, is_syncing]);

    const refreshStatus = useCallback(async () => {
        try {
            const newStatus = await SyncApi.getStatus();
            setStatus(newStatus);
        } catch (e) {
            console.error('Failed to get sync status:', e);
        }
    }, []);

    const loadConfig = useCallback(async () => {
        try {
            const newConfig = await SyncApi.getConfig();
            setConfig(newConfig);
        } catch (e) {
            console.error('Failed to get sync config:', e);
        }
    }, []);

    const connect = useCallback(async () => {
        try {
            setError(null);
            // Use current origin for redirect URI to work on mobile and desktop
            const redirectUri = `${window.location.origin}/api/sync/auth/google/callback`;
            console.log('[Sync] Auth redirectUri:', redirectUri);
            console.log('[Sync] Starting auth, redirectUri:', redirectUri);
            
            const response = await SyncApi.startGoogleAuth(redirectUri);
            console.log('[Sync] Auth response:', response);
            
            const authUrl = response?.authUrl;
            if (!authUrl) {
                console.error('[Sync] No authUrl in response:', response);
                throw new Error('No auth URL returned from server. Check server logs.');
            }
            
            console.log('[Sync] Redirecting to:', authUrl);
            
            // Store current path to return after auth
            sessionStorage.setItem('sync_auth_return_path', window.location.pathname + window.location.search);
            sessionStorage.setItem('sync_auth_in_progress', 'true');
            
            // Use appropriate redirect method based on platform
            const requestManager = new RequestManager();

            try {
                const appVersion = await getAppVersion();
                if (appVersion.variant === 'native-webview') {
                    const webviewUrl = requestManager.getWebviewUrl(authUrl);
                    window.location.href = webviewUrl;
                    return;
                }

                window.location.href = authUrl;
            } catch (e) {
                console.warn('[Sync] Webview redirect failed, using fallback:', e);
                // Fallback to direct navigation for desktop browsers
                window.location.href = authUrl;
            }
        } catch (e) {
            console.error('[Sync] Connection failed:', e);
            setError(`Connection failed: ${e}`);
        }
    }, []);

    const disconnect = useCallback(async () => {
        try {
            setError(null);
            await SyncApi.disconnect();
            await refreshStatus();
        } catch (e) {
            setError(`Disconnect failed: ${e}`);
        }
    }, [refreshStatus]);

    const sync = useCallback(async () => {
        if (is_syncing || !status?.connected) return;

        try {
            setIsSyncing(true);
            setError(null);
            setProgress(null);
            setLastConflicts([]);

            const result = await SyncService.sync(setProgress);

            // Use the service's stored time for consistency
            setLastSyncTime(SyncService.getLastSyncTime());
            setLastConflicts(result.conflicts);
            setProgress(null);
        } catch (e) {
            setError(`Sync failed: ${e}`);
        } finally {
            setIsSyncing(false);
            setProgress(null);
        }
    }, [is_syncing, status?.connected]);

    const pullOnly = useCallback(async () => {
        if (is_syncing || !status?.connected) return;

        try {
            setIsSyncing(true);
            setError(null);
            setProgress(null);

            await SyncService.pullOnly(setProgress);

            setLastSyncTime(SyncService.getLastSyncTime());
            setProgress(null);
        } catch (e) {
            setError(`Pull failed: ${e}`);
        } finally {
            setIsSyncing(false);
            setProgress(null);
        }
    }, [is_syncing, status?.connected]);

    const pushOnly = useCallback(async () => {
        if (is_syncing || !status?.connected) return;

        try {
            setIsSyncing(true);
            setError(null);
            setProgress(null);

            await SyncService.pushOnly(setProgress);

            setLastSyncTime(SyncService.getLastSyncTime());
            setProgress(null);
        } catch (e) {
            setError(`Push failed: ${e}`);
        } finally {
            setIsSyncing(false);
            setProgress(null);
        }
    }, [is_syncing, status?.connected]);

    const updateConfig = useCallback(async (updates: Partial<SyncConfig>) => {
        try {
            const newConfig = { ...config, ...updates };
            await SyncApi.setConfig(newConfig);
            setConfig(newConfig);
        } catch (e) {
            setError(`Failed to save config: ${e}`);
        }
    }, [config]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const value = useMemo(
        () => ({
            status,
            config,
            is_syncing,
            lastSyncTime,
            error,
            progress,
            lastConflicts,
            connect,
            disconnect,
            sync,
            pullOnly,
            pushOnly,
            updateConfig,
            refreshStatus,
            clearError,
        }),
        [
            status,
            config,
            is_syncing,
            lastSyncTime,
            error,
            progress,
            lastConflicts,
            connect,
            disconnect,
            sync,
            pullOnly,
            pushOnly,
            updateConfig,
            refreshStatus,
            clearError,
        ],
    );

    return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export const useSync = (): SyncContextValue => {
    const context = useContext(SyncContext);
    if (!context) {
        throw new Error('useSync must be used within SyncProvider');
    }
    return context;
};
