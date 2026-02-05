/**
 * Reading progress and position types
 */

export interface BookStats {
    chapterLengths: number[];
    totalLength: number;
}

export interface ReadingPosition {
    // ========================================================================
    // PRIMARY ANCHOR (Block-based - NEW)
    // ========================================================================

    /** Block ID for position anchor: "ch5-b22" */
    blockId?: string;

    /** Character offset within the block */
    blockLocalOffset?: number;

    /** Text snippet for validation during restoration */
    contextSnippet?: string;

    // ========================================================================
    // CHAPTER INFO
    // ========================================================================

    /** Current chapter index (0-based) */
    chapterIndex: number;

    /** Current page index for paged mode */
    pageIndex?: number;

    // ========================================================================
    // CHARACTER-BASED (Legacy + Fallback)
    // ========================================================================

    /** Character offset within chapter */
    chapterCharOffset: number;

    /** Total characters read in book */
    totalCharsRead: number;

    /** Sentence text for legacy restoration */
    sentenceText: string;

    // ========================================================================
    // PROGRESS PERCENTAGES
    // ========================================================================

    /** Progress within current chapter (0-100) */
    chapterProgress: number;

    /** Total book progress (0-100) */
    totalProgress: number;

    // ========================================================================
    // METADATA
    // ========================================================================

    /** Timestamp when position was recorded */
    timestamp: number;
}

export interface ProgressManagerState {
    isReady: boolean;
    currentProgress: number;
    currentPosition: ReadingPosition | null;
}