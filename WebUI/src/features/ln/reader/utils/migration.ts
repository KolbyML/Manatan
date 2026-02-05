
import { ReadingPosition } from '../types/progress';
import { LNProgress } from '@/lib/storage/AppStorage';

/**
 * Check if a progress object uses the old format
 */
export function isLegacyProgress(progress: any): boolean {
    if (!progress) return false;

    // New format has blockId
    if (progress.blockId && progress.blockId.length > 0) {
        return false;
    }

    // Old format has sentenceText but no blockId
    return !!(progress.sentenceText || progress.chapterCharOffset);
}

/**
 * Migrate old progress format to new format
 * 
 * Old format:
 * - sentenceText: string (for text search restoration)
 * - chapterCharOffset: number (character offset in chapter)
 * 
 * New format:
 * - blockId: string (structural anchor)
 * - blockLocalOffset: number (offset within block)
 * - contextSnippet: string (for validation)
 */
export function migrateProgress(oldProgress: LNProgress): LNProgress {
    // If already migrated, return as-is
    if (oldProgress.blockId) {
        return oldProgress;
    }

    // Migrate fields
    return {
        ...oldProgress,

        // New fields (will be populated on first save after restoration)
        blockId: '', // Empty - will trigger text search restoration
        blockLocalOffset: 0,
        contextSnippet: oldProgress.sentenceText?.substring(0, 40) || '',

        // Keep legacy fields for fallback
        sentenceText: oldProgress.sentenceText,
        chapterCharOffset: oldProgress.chapterCharOffset,
    };
}

/**
 * Convert storage progress to ReadingPosition
 */
export function progressToPosition(progress: LNProgress | null): ReadingPosition | null {
    if (!progress) return null;

    return {
        // Block-based (may be empty for legacy saves)
        blockId: progress.blockId || undefined,
        blockLocalOffset: progress.blockLocalOffset || 0,
        contextSnippet: progress.contextSnippet || '',

        // Chapter info
        chapterIndex: progress.chapterIndex,
        pageIndex: progress.pageNumber,

        // Character-based
        chapterCharOffset: progress.chapterCharOffset,
        totalCharsRead: progress.totalCharsRead,

        // Legacy
        sentenceText: progress.sentenceText,

        // Progress
        chapterProgress: progress.chapterProgress,
        totalProgress: progress.totalProgress,

        // Metadata
        timestamp: progress.lastRead || Date.now(),
    };
}

/**
 * Convert ReadingPosition to storage progress
 */
export function positionToProgress(position: ReadingPosition): Omit<LNProgress, 'lastRead'> {
    return {
        chapterIndex: position.chapterIndex,
        pageNumber: position.pageIndex,

        // Character-based
        chapterCharOffset: position.chapterCharOffset,
        totalCharsRead: position.totalCharsRead,

        // Block-based
        blockId: position.blockId,
        blockLocalOffset: position.blockLocalOffset,
        contextSnippet: position.contextSnippet,

        // Legacy (for backward compatibility)
        sentenceText: position.sentenceText || position.contextSnippet || '',

        // Progress
        chapterProgress: position.chapterProgress,
        totalProgress: position.totalProgress,
    };
}

/**
 * Validate migrated position can be restored
 */
export function canRestorePosition(position: ReadingPosition | null): boolean {
    if (!position) return false;

    // Has block ID - best case
    if (position.blockId && position.blockId.length > 0) {
        return true;
    }

    // Has sentence text - can use text search
    if (position.sentenceText && position.sentenceText.length >= 10) {
        return true;
    }

    // Has context snippet - can use text search
    if (position.contextSnippet && position.contextSnippet.length >= 10) {
        return true;
    }

    // Has character offset - can approximate
    if (position.chapterCharOffset && position.chapterCharOffset > 0) {
        return true;
    }

    return false;
}

/**
 * Get restoration method that will be used
 */
export function getRestorationMethod(
    position: ReadingPosition | null
): 'block' | 'text-search' | 'char-offset' | 'none' {
    if (!position) return 'none';

    if (position.blockId && position.blockId.length > 0) {
        return 'block';
    }

    if (
        (position.sentenceText && position.sentenceText.length >= 10) ||
        (position.contextSnippet && position.contextSnippet.length >= 10)
    ) {
        return 'text-search';
    }

    if (position.chapterCharOffset && position.chapterCharOffset > 0) {
        return 'char-offset';
    }

    return 'none';
}

/**
 * Log migration info for debugging
 */
export function logMigrationInfo(
    bookId: string,
    oldProgress: LNProgress,
    newProgress: LNProgress
): void {
    console.log(`[Migration] Book ${bookId}:`, {
        hadBlockId: !!oldProgress.blockId,
        hadSentenceText: !!oldProgress.sentenceText,
        hadCharOffset: !!oldProgress.chapterCharOffset,
        newBlockId: newProgress.blockId,
        newContextSnippet: newProgress.contextSnippet?.substring(0, 20) + '...',
        restorationMethod: getRestorationMethod(progressToPosition(newProgress)),
    });
}