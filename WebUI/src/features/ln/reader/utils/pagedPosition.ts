
import {
    getCleanTextContent,
    getCleanCharCount,
    extractContextSnippet
} from './blockPosition';

// ============================================================================
// Types
// ============================================================================

export interface DetectedBlock {
    blockId: string;
    element: Element;
    blockLocalOffset: number;
    chapterCharOffset: number;
}

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Find the block that's currently at the reading position for paged mode
 * 
 * @param container - The viewport container element
 * @param pageIndex - Current page index (0-based)
 * @param pageSize - Size of each page in pixels
 * @param isVertical - Whether reading direction is vertical
 * @param chapterIndex - Current chapter index (for block ID prefix)
 */
export function detectVisibleBlockPaged(
    container: HTMLElement,
    pageIndex: number,
    pageSize: number,
    isVertical: boolean,
    chapterIndex: number
): DetectedBlock | null {
    // Get all blocks
    const allBlocks = container.querySelectorAll('[data-block-id]');

    if (allBlocks.length === 0) {
        console.warn('[pagedPosition] No blocks found in container');
        return null;
    }

    const containerRect = container.getBoundingClientRect();
    const scrollOffset = pageIndex * pageSize;

    let bestBlock: Element | null = null;
    let bestDistance = Infinity;

    // Find block closest to the reading edge
    for (const block of allBlocks) {
        const rect = block.getBoundingClientRect();

        let blockPosition: number;
        let viewportStart: number;
        let viewportEnd: number;

        if (isVertical) {
            // Vertical mode: transforms are translateY
            blockPosition = rect.top - containerRect.top + scrollOffset;
            viewportStart = scrollOffset;
            viewportEnd = scrollOffset + containerRect.height;
        } else {
            // Horizontal mode: transforms are translateX
            blockPosition = rect.left - containerRect.left + scrollOffset;
            viewportStart = scrollOffset;
            viewportEnd = scrollOffset + containerRect.width;
        }

        const blockSize = isVertical ? rect.height : rect.width;
        const blockEnd = blockPosition + blockSize;

        // Check if block is visible on current page
        const isVisible = blockEnd > viewportStart && blockPosition < viewportEnd;

        if (isVisible) {
            const distance = Math.abs(blockPosition - viewportStart);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestBlock = block;
            }
        }
    }

    // Fallback to first block if none found
    if (!bestBlock) {
        bestBlock = allBlocks[0];
    }

    const blockId = bestBlock.getAttribute('data-block-id');
    if (!blockId) {
        console.warn('[pagedPosition] Best block has no data-block-id');
        return null;
    }

    // Calculate block local offset (how far into the block we've read)
    const blockRect = bestBlock.getBoundingClientRect();
    const blockText = getCleanTextContent(bestBlock);
    const blockChars = blockText.length;

    let blockLocalOffset = 0;
    if (blockChars > 0) {
        let readRatio: number;

        if (isVertical) {
            const scrollTop = pageIndex * pageSize;
            const blockTop = blockRect.top - containerRect.top + scrollTop;
            const readAmount = scrollTop - blockTop;
            readRatio = Math.max(0, Math.min(1, readAmount / blockRect.height));
        } else {
            const scrollLeft = pageIndex * pageSize;
            const blockLeft = blockRect.left - containerRect.left + scrollLeft;
            const readAmount = scrollLeft - blockLeft;
            readRatio = Math.max(0, Math.min(1, readAmount / blockRect.width));
        }

        blockLocalOffset = Math.floor(blockChars * readRatio);
    }

    // Calculate chapter character offset
    let chapterCharOffset = 0;
    for (const block of allBlocks) {
        if (block === bestBlock) {
            chapterCharOffset += blockLocalOffset;
            break;
        }
        const text = getCleanTextContent(block);
        chapterCharOffset += getCleanCharCount(text);
    }

    return {
        blockId,
        element: bestBlock,
        blockLocalOffset,
        chapterCharOffset,
    };
}

/**
 * Find which page contains a specific block
 */
export function findPageForBlock(
    container: HTMLElement,
    blockId: string,
    pageSize: number,
    isVertical: boolean
): number {
    const block = container.querySelector(`[data-block-id="${blockId}"]`);
    if (!block) return 0;

    const containerRect = container.getBoundingClientRect();
    const blockRect = block.getBoundingClientRect();

    // Calculate block's position in the scrollable content
    let blockPosition: number;

    if (isVertical) {
        blockPosition = blockRect.top - containerRect.top + (container.scrollTop || 0);
    } else {
        blockPosition = blockRect.left - containerRect.left + (container.scrollLeft || 0);
    }

    return Math.floor(blockPosition / pageSize);
}

/**
 * Restore position to a specific block on a page
 */
export function restoreToBlockPaged(
    container: HTMLElement,
    blockId: string,
    blockLocalOffset: number,
    pageSize: number,
    isVertical: boolean
): { pageIndex: number; success: boolean } {
    const block = container.querySelector(`[data-block-id="${blockId}"]`);

    if (!block) {
        console.warn('[pagedPosition] Block not found for restoration:', blockId);
        return { pageIndex: 0, success: false };
    }

    const pageIndex = findPageForBlock(container, blockId, pageSize, isVertical);

    console.log('[pagedPosition] Restored to block:', {
        blockId,
        pageIndex,
        blockLocalOffset,
    });

    return { pageIndex, success: true };
}