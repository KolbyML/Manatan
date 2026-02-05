/**
 * Block-based position tracking types
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

export interface BlockIndexMap {
    /** All blocks in this chapter */
    blocks: Block[];

    /** Total clean characters in chapter */
    totalChars: number;

    /** Chapter index (0-indexed) */
    chapterIndex: number;
}