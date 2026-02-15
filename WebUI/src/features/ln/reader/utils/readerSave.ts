import { AppStorage, BookStats } from '@/lib/storage/AppStorage';

// ============================================================================
// Types
// ============================================================================

export interface SaveablePosition {
    // Block-based (primary)
    blockId?: string;
    blockLocalOffset?: number;
    contextSnippet?: string;

    // Chapter info
    chapterIndex: number;
    pageIndex?: number;

    // Character-based
    chapterCharOffset: number;
    totalCharsRead: number;

    // Progress
    chapterProgress: number;
    totalProgress: number;

    // Legacy
    sentenceText?: string;
}

export interface ProgressCalculation {
    chapterProgress: number;
    totalProgress: number;
    totalCharsRead: number;
}

export interface SaveSchedulerOptions {
    bookId: string;
    debounceMs?: number;
    autoSaveEnabled?: boolean;
    saveDelay?: number; // Delay in seconds (0 = use debounceMs in ms)
    onSaveStatusChange?: (isSaved: boolean) => void;
    onPositionSaved?: (position: SaveablePosition) => void;
}

// ============================================================================
// Progress Calculation
// ============================================================================

export function calculateProgress(
    chapterIndex: number,
    chapterCharOffset: number,
    stats: BookStats
): ProgressCalculation {
    if (!stats || stats.totalLength === 0) {
        return {
            chapterProgress: 0,
            totalProgress: 0,
            totalCharsRead: 0,
        };
    }

    const chapterLength = stats.chapterLengths[chapterIndex] || 1;
    const chapterProgress = Math.min(100, (chapterCharOffset / chapterLength) * 100);

    let charsBeforeChapter = 0;
    for (let i = 0; i < chapterIndex; i++) {
        charsBeforeChapter += stats.chapterLengths[i] || 0;
    }

    const totalCharsRead = charsBeforeChapter + chapterCharOffset;
    const totalProgress = Math.min(100, (totalCharsRead / stats.totalLength) * 100);

    return {
        chapterProgress,
        totalProgress,
        totalCharsRead,
    };
}

// ============================================================================
// Save Function
// ============================================================================

export async function saveReadingPosition(
    bookId: string,
    position: SaveablePosition
): Promise<boolean> {
    if (!bookId) {
        console.warn('[readerSave] No bookId provided');
        return false;
    }

    if (!position.blockId && !position.sentenceText && position.totalProgress === 0) {
        console.warn('[readerSave] No meaningful position to save');
        return false;
    }

    try {
        const existing = await AppStorage.getLnProgress(bookId);
        await AppStorage.saveLnProgress(bookId, {
            chapterIndex: position.chapterIndex,
            pageNumber: position.pageIndex || 0,
            chapterCharOffset: position.chapterCharOffset,
            totalCharsRead: position.totalCharsRead,
            sentenceText: position.sentenceText || position.contextSnippet || '',
            chapterProgress: position.chapterProgress,
            totalProgress: position.totalProgress,
            blockId: position.blockId,
            blockLocalOffset: position.blockLocalOffset,
            contextSnippet: position.contextSnippet,
            highlights: existing?.highlights ?? [],
        });

        return true;
    } catch (err) {
        console.error('[readerSave] Save failed:', err);
        return false;
    }
}

// ============================================================================
// Save Scheduler
// ============================================================================

export function createSaveScheduler(
    bookIdOrOptions: string | SaveSchedulerOptions,
    debounceMs: number = 3000
) {
    const initialOptions: SaveSchedulerOptions = typeof bookIdOrOptions === 'string'
        ? { bookId: bookIdOrOptions, debounceMs }
        : bookIdOrOptions;

    let currentOptions = {
        bookId: initialOptions.bookId,
        debounceMs: initialOptions.debounceMs ?? 3000,
        autoSaveEnabled: initialOptions.autoSaveEnabled ?? true,
        saveDelay: initialOptions.saveDelay ?? 0,
        onSaveStatusChange: initialOptions.onSaveStatusChange,
        onPositionSaved: initialOptions.onPositionSaved,
    };

    let saveTimerId: number | null = null;
    let lastPosition: SaveablePosition | null = null;
    let savedBlockId: string | null = null; // Track what position is actually saved
    let isSaved: boolean = true;

    /**
     * Get effective delay in milliseconds
     */
    const getEffectiveDelay = (): number => {
        if (currentOptions.saveDelay > 0) {
            return currentOptions.saveDelay * 1000;
        }
        return currentOptions.debounceMs;
    };

    /**
     * Update saved status and notify
     */
    const updateSaveStatus = (saved: boolean) => {
        if (isSaved !== saved) {
            isSaved = saved;
            currentOptions.onSaveStatusChange?.(saved);
        }
    };

    /**
     * Schedule a position save
     */
    const scheduleSave = (position: SaveablePosition) => {
        lastPosition = position;

        // Check if position changed from what's saved
        const positionChanged = position.blockId !== savedBlockId;
        
        if (positionChanged) {
            updateSaveStatus(false);
        }

        // Don't schedule if auto-save is disabled
        if (!currentOptions.autoSaveEnabled) {
            return;
        }

        // Clear existing timer
        if (saveTimerId) {
            clearTimeout(saveTimerId);
        }

        // Schedule save
        saveTimerId = window.setTimeout(async () => {
            if (lastPosition) {
                const success = await saveReadingPosition(currentOptions.bookId, lastPosition);
                if (success) {
                    savedBlockId = lastPosition.blockId || null;
                    updateSaveStatus(true);
                    currentOptions.onPositionSaved?.(lastPosition);
                }
            }
            saveTimerId = null;
        }, getEffectiveDelay());
    };

    /**
     * Save immediately (manual save)
     */
    const saveNow = async (): Promise<boolean> => {
        // Clear pending auto-save
        if (saveTimerId) {
            clearTimeout(saveTimerId);
            saveTimerId = null;
        }

        if (!lastPosition) {
            return false;
        }

        const success = await saveReadingPosition(currentOptions.bookId, lastPosition);
        if (success) {
            savedBlockId = lastPosition.blockId || null;
            updateSaveStatus(true);
            currentOptions.onPositionSaved?.(lastPosition);
        }
        return success;
    };

    /**
     * Cancel pending save
     */
    const cancel = () => {
        if (saveTimerId) {
            clearTimeout(saveTimerId);
            saveTimerId = null;
        }
    };

    /**
     * Get the last recorded position
     */
    const getLastPosition = (): SaveablePosition | null => lastPosition;

    /**
     * Check if current position is saved
     */
    const isPositionSaved = (): boolean => isSaved;

    /**
     * Update scheduler options
     */
    const updateOptions = (newOptions: Partial<SaveSchedulerOptions>) => {
        if (newOptions.bookId && newOptions.bookId !== currentOptions.bookId) {
            lastPosition = null;
            savedBlockId = null;
            isSaved = true;
        }

        currentOptions = {
            ...currentOptions,
            ...newOptions,
        };
    };

    /**
     * Set the initially saved position (for restoration)
     */
    const setInitialSavedPosition = (blockId: string | undefined) => {
        savedBlockId = blockId || null;
        isSaved = true;
    };

    return {
        scheduleSave,
        saveNow,
        cancel,
        getLastPosition,
        isPositionSaved,
        updateOptions,
        setInitialSavedPosition,
    };
}