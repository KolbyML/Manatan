
import { useEffect, useCallback, useRef } from 'react';
import { useSync } from './SyncContext';

/**
 * Hook to trigger sync when opening a chapter
 */
export const useSyncOnChapterOpen = (chapterId: string | null): void => {
    const { sync, config, status, isSyncing } = useSync();
    const lastChapterId = useRef<string | null>(null);

    useEffect(() => {
        if (
            chapterId &&
            chapterId !== lastChapterId.current &&
            config.syncOnChapterOpen &&
            status?.connected &&
            !isSyncing
        ) {
            lastChapterId.current = chapterId;
            
            // Debounce to avoid rapid syncs
            const timeout = setTimeout(() => {
                sync();
            }, 1000);

            return () => clearTimeout(timeout);
        }
    }, [chapterId, config.syncOnChapterOpen, status?.connected, isSyncing, sync]);
};

/**
 * Hook that returns a function to call after reading a chapter
 */
export const useSyncOnChapterRead = (): { triggerSync: () => void } => {
    const { sync, config, status, isSyncing } = useSync();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerSync = useCallback(() => {
        if (!config.syncOnChapterRead || !status?.connected || isSyncing) {
            return;
        }

        // Debounce rapid calls
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            sync();
            debounceRef.current = null;
        }, 2000);
    }, [config.syncOnChapterRead, status?.connected, isSyncing, sync]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    return { triggerSync };
};