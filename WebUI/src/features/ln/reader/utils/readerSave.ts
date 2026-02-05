
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

// ============================================================================
// Progress Calculation
// ============================================================================

/**
 * Calculate progress percentages from character offset
 */
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
// Save Functions
// ============================================================================

/**
 * Save reading position to database
 */
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
        });

        console.log('[readerSave] Saved:', {
            blockId: position.blockId,
            chapter: position.chapterIndex,
            charOffset: position.chapterCharOffset,
            progress: `${position.totalProgress.toFixed(1)}%`,
        });

        return true;
    } catch (err) {
        console.error('[readerSave] Save failed:', err);
        return false;
    }
}

/**
 * Create a save scheduler (returns functions to schedule and force save)
 */
export function createSaveScheduler(
    bookId: string,
    debounceMs: number = 3000
): {
    scheduleSave: (position: SaveablePosition) => void;
    saveNow: () => Promise<void>;
    cancel: () => void;
    getLastPosition: () => SaveablePosition | null;
} {
    let timerId: number | null = null;
    let lastPosition: SaveablePosition | null = null;
    let currentBookId = bookId;

    const scheduleSave = (position: SaveablePosition) => {
        lastPosition = position;

        if (timerId) {
            clearTimeout(timerId);
        }

        timerId = window.setTimeout(() => {
            if (lastPosition) {
                saveReadingPosition(currentBookId, lastPosition);
            }
            timerId = null;
        }, debounceMs);
    };

    const saveNow = async () => {
        if (timerId) {
            clearTimeout(timerId);
            timerId = null;
        }

        if (lastPosition) {
            await saveReadingPosition(currentBookId, lastPosition);
        }
    };

    const cancel = () => {
        if (timerId) {
            clearTimeout(timerId);
            timerId = null;
        }
    };

    const getLastPosition = () => lastPosition;

    return {
        scheduleSave,
        saveNow,
        cancel,
        getLastPosition,
    };
}