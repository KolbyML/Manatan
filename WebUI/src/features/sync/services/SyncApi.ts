import { apiRequest } from '@/Manatan/utils/api';
import {
    AuthFlow,
    AuthStatus,
    MergeRequest,
    MergeResponse,
    PushResponse,
    SyncConfig,
    SyncPayload,
} from '../Sync.types';

const SYNC_BASE = '/api/sync';

export const SyncApi = {
    // ========================================================================
    // Authentication
    // ========================================================================

    getStatus: (): Promise<AuthStatus> => 
        apiRequest<AuthStatus>(`${SYNC_BASE}/auth/status`),

    startGoogleAuth: (redirectUri: string): Promise<AuthFlow> =>
        apiRequest<AuthFlow>(`${SYNC_BASE}/auth/google/start`, {
            method: 'POST',
            body: { redirectUri },
        }),

    completeGoogleAuth: (
        code: string,
        state: string,
        redirectUri: string,
    ): Promise<{ success: boolean; message: string }> =>
        apiRequest<{ success: boolean; message: string }>(
            `${SYNC_BASE}/auth/google/callback`,
            {
                method: 'POST',
                body: { code, state, redirectUri },
            },
        ),

    disconnect: (): Promise<{ success: boolean; message: string }> =>
        apiRequest<{ success: boolean; message: string }>(
            `${SYNC_BASE}/auth/disconnect`,
            { method: 'POST' },
        ),

    // ========================================================================
    // Sync Operations
    // ========================================================================

    merge: (request: MergeRequest): Promise<MergeResponse> =>
        apiRequest<MergeResponse>(`${SYNC_BASE}/merge`, {
            method: 'POST',
            body: request,
        }),

    pull: (): Promise<SyncPayload | null> => 
        apiRequest<SyncPayload | null>(`${SYNC_BASE}/pull`),

    push: (payload: SyncPayload, etag?: string): Promise<PushResponse> =>
        apiRequest<PushResponse>(`${SYNC_BASE}/push`, {
            method: 'POST',
            body: { payload, etag },
        }),

    // ========================================================================
    // Configuration
    // ========================================================================

    getConfig: (): Promise<SyncConfig> => 
        apiRequest<SyncConfig>(`${SYNC_BASE}/config`),

    setConfig: (config: SyncConfig): Promise<SyncConfig> =>
        apiRequest<SyncConfig>(`${SYNC_BASE}/config`, {
            method: 'PUT',
            body: config,
        }),
};