/**
 * Block-based position tracking types
 * Unified format for both local reading and cross-device sync
 */

export interface Block {
    /** Unique identifier: "ch{chapterIndex}-b{blockOrder}" */
    id: string;

    /** HTML tag type */
    type: BlockType;

    /** Order within chapter (0-indexed) */
    order: number;

    /** DOM element reference (only available at runtime) */
    element?: HTMLElement;

    /** Measured height in pixels (only available at runtime) */
    height: number;

    /** Character count excluding whitespace */
    cleanCharCount: number;

    /** Starting character offset within chapter */
    cleanCharStart: number;

    // Extended properties (optional, added by processor)
    isSignificant?: boolean;
    hasImages?: boolean;
    hasFurigana?: boolean;
    isFallback?: boolean;
    elementPath?: string;
    textPreview?: string;
}

export type BlockType =
    | 'p'
    | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
    | 'blockquote'
    | 'figure'
    | 'li'
    | 'table'
    | 'pre'
    | 'div'
    | 'td'
    | 'th'
    | 'figcaption'
    | 'caption';

/**
 * Flat BlockIndexMap for sync and position tracking
 * Compatible with Rust backend BlockIndexMap struct
 */
export interface BlockIndexMap {
    /** Block identifier (e.g., "ch4-b12") */
    blockId: string;
    
    /** Character offset where this block starts */
    startOffset: number;
    
    /** Character offset where this block ends */
    endOffset: number;
}

/**
 * Chapter-level block information (for internal processing)
 */
export interface ChapterBlockInfo {
    /** All blocks in this chapter */
    blocks: Block[];
    
    /** Total clean characters in chapter */
    totalChars: number;
    
    /** Chapter index (0-indexed) */
    chapterIndex: number;
}
