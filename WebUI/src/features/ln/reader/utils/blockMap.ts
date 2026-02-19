/**
 * Block Map Utilities
 * 
 * Provides efficient lookup and position calculation using pre-calculated
 * blockMaps from book stats. This is the core of accurate restoration.
 */

import { BlockIndexMap } from '../types/block';

// ============================================================================
// Types
// ============================================================================

export interface BlockLookup {
    /** Map of blockId → block data */
    byId: Map<string, BlockIndexMap>;
    
    /** Blocks sorted by startOffset for binary search */
    sortedByOffset: BlockIndexMap[];
    
    /** Total character count covered by all blocks */
    totalChars: number;
}

export interface PositionFromBlock {
    blockId: string;
    blockLocalOffset: number;
    chapterCharOffset: number;
}

// ============================================================================
// Lookup Creation
// ============================================================================

/**
 * Create a BlockLookup from flat blockMaps array
 * This enables O(1) lookups by blockId and O(log n) by character offset
 */
export function createBlockLookup(blockMaps: BlockIndexMap[] | undefined): BlockLookup {
    if (!blockMaps || blockMaps.length === 0) {
        return {
            byId: new Map(),
            sortedByOffset: [],
            totalChars: 0,
        };
    }

    const byId = new Map<string, BlockIndexMap>();
    const sortedByOffset = [...blockMaps].sort((a, b) => a.startOffset - b.startOffset);
    
    let totalChars = 0;
    for (const block of sortedByOffset) {
        byId.set(block.blockId, block);
        totalChars = Math.max(totalChars, block.endOffset);
    }

    return {
        byId,
        sortedByOffset,
        totalChars,
    };
}

/**
 * Create a chapter-specific lookup (filters blocks for a single chapter)
 */
export function createChapterBlockLookup(
    blockMaps: BlockIndexMap[] | undefined,
    chapterIndex: number
): BlockLookup {
    if (!blockMaps || blockMaps.length === 0) {
        return {
            byId: new Map(),
            sortedByOffset: [],
            totalChars: 0,
        };
    }

    const chapterPrefix = `ch${chapterIndex}-`;
    const chapterBlocks = blockMaps.filter(b => b.blockId.startsWith(chapterPrefix));
    
    return createBlockLookup(chapterBlocks);
}

// ============================================================================
// Position Calculation
// ============================================================================

/**
 * Find the block containing a specific character offset
 * Uses binary search for O(log n) performance
 */
export function findBlockAtOffset(
    lookup: BlockLookup,
    charOffset: number
): BlockIndexMap | null {
    const { sortedByOffset } = lookup;
    
    if (sortedByOffset.length === 0) return null;
    if (charOffset <= 0) return sortedByOffset[0];
    if (charOffset >= lookup.totalChars) return sortedByOffset[sortedByOffset.length - 1];

    // Binary search
    let left = 0;
    let right = sortedByOffset.length - 1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const block = sortedByOffset[mid];

        if (charOffset < block.startOffset) {
            right = mid - 1;
        } else if (charOffset >= block.endOffset) {
            left = mid + 1;
        } else {
            return block;
        }
    }

    // Return closest block if exact match not found
    return sortedByOffset[right] || sortedByOffset[0];
}

/**
 * Calculate chapter character offset from blockId and local offset
 * Uses pre-calculated startOffset for accuracy
 */
export function calculateCharOffsetFromBlock(
    lookup: BlockLookup,
    blockId: string,
    localOffset: number
): number {
    const block = lookup.byId.get(blockId);
    if (!block) return 0;
    
    return block.startOffset + Math.min(localOffset, block.endOffset - block.startOffset);
}

/**
 * Calculate local offset within a block from chapter character offset
 */
export function calculateLocalOffsetFromCharOffset(
    lookup: BlockLookup,
    blockId: string,
    chapterCharOffset: number
): number {
    const block = lookup.byId.get(blockId);
    if (!block) return 0;
    
    return Math.max(0, chapterCharOffset - block.startOffset);
}

/**
 * Get position from block ID and local offset
 */
export function getPositionFromBlock(
    lookup: BlockLookup,
    blockId: string,
    localOffset: number
): PositionFromBlock | null {
    const block = lookup.byId.get(blockId);
    if (!block) return null;

    const chapterCharOffset = block.startOffset + Math.min(
        localOffset,
        block.endOffset - block.startOffset
    );

    return {
        blockId,
        blockLocalOffset: localOffset,
        chapterCharOffset,
    };
}

/**
 * Get position from chapter character offset (when blockId is not available)
 */
export function getPositionFromCharOffset(
    lookup: BlockLookup,
    chapterCharOffset: number
): PositionFromBlock | null {
    const block = findBlockAtOffset(lookup, chapterCharOffset);
    if (!block) return null;

    const blockLocalOffset = Math.max(0, chapterCharOffset - block.startOffset);

    return {
        blockId: block.blockId,
        blockLocalOffset,
        chapterCharOffset,
    };
}

// ============================================================================
// Block Information
// ============================================================================

/**
 * Get block by ID
 */
export function getBlockById(
    lookup: BlockLookup,
    blockId: string
): BlockIndexMap | undefined {
    return lookup.byId.get(blockId);
}

/**
 * Get all block IDs for a chapter
 */
export function getChapterBlocks(
    blockMaps: BlockIndexMap[] | undefined,
    chapterIndex: number
): BlockIndexMap[] {
    if (!blockMaps) return [];
    
    const prefix = `ch${chapterIndex}-`;
    return blockMaps.filter(b => b.blockId.startsWith(prefix));
}

/**
 * Get chapter character count
 */
export function getChapterCharCount(
    blockMaps: BlockIndexMap[] | undefined,
    chapterIndex: number
): number {
    const chapterBlocks = getChapterBlocks(blockMaps, chapterIndex);
    if (chapterBlocks.length === 0) return 0;
    
    return Math.max(...chapterBlocks.map(b => b.endOffset));
}

/**
 * Get total character count from blockMaps
 */
export function getTotalCharCount(blockMaps: BlockIndexMap[] | undefined): number {
    if (!blockMaps || blockMaps.length === 0) return 0;
    return Math.max(...blockMaps.map(b => b.endOffset));
}

// ============================================================================
// Debug Helpers
// ============================================================================

/**
 * Log block map statistics for debugging
 */
export function logBlockStats(
    blockMaps: BlockIndexMap[] | undefined,
    chapterIndex?: number
): void {
    if (!blockMaps || blockMaps.length === 0) {
        console.log('[BlockMap] No blocks');
        return;
    }

    const targetBlocks = chapterIndex !== undefined
        ? getChapterBlocks(blockMaps, chapterIndex)
        : blockMaps;

    const totalChars = getTotalCharCount(targetBlocks);
    const firstBlock = targetBlocks[0];
    const lastBlock = targetBlocks[targetBlocks.length - 1];

    console.log('[BlockMap] Stats:', {
        chapter: chapterIndex ?? 'all',
        blockCount: targetBlocks.length,
        totalChars,
        firstBlock: firstBlock?.blockId,
        firstStart: firstBlock?.startOffset,
        lastBlock: lastBlock?.blockId,
        lastEnd: lastBlock?.endOffset,
    });
}
