
import { getCleanTextContent } from './blockPosition';

export interface RestorationResult {
    success: boolean;
    method: 'block' | 'block-offset' | 'text-search' | 'char-offset' | 'fallback' | 'failed';
    confidence: 'high' | 'medium' | 'low';
    blockId?: string;
    message?: string;
}



export interface RestorationPosition {
    // Block-based (preferred)
    blockId?: string;
    blockLocalOffset?: number;
    contextSnippet?: string;

    // Legacy/fallback
    chapterIndex: number;
    chapterCharOffset?: number;
    sentenceText?: string;
}

/**
 * Restore reading position using multi-tier approach
 */
export function restoreReadingPosition(
    container: HTMLElement,
    position: RestorationPosition,
    isVertical: boolean,
    isRTL: boolean = false
): RestorationResult {
    console.log('[Restoration] Attempting restore:', {
        blockId: position.blockId,
        chapterIndex: position.chapterIndex,
        hasContext: !!position.contextSnippet,
        hasSentence: !!position.sentenceText,
    });

    // ========================================================================
    // TIER 1: Block-based restoration (highest accuracy)
    // ========================================================================
    if (position.blockId) {
        const block = container.querySelector(`[data-block-id="${position.blockId}"]`);

        if (block) {
            // Scroll to block
            scrollToBlock(block, container, isVertical, isRTL);

            // Apply local offset if significant
            if (position.blockLocalOffset && position.blockLocalOffset > 50) {
                applyLocalOffset(block, container, position.blockLocalOffset, isVertical);
            }

            // Validate with context snippet
            const confidence = validateContext(block, position.contextSnippet);

            console.log('[Restoration] Block-based success:', {
                blockId: position.blockId,
                confidence,
            });

            return {
                success: true,
                method: position.blockLocalOffset && position.blockLocalOffset > 50
                    ? 'block-offset'
                    : 'block',
                confidence,
                blockId: position.blockId,
            };
        }

        console.log('[Restoration] Block not found, trying fallbacks');
    }

    // ========================================================================
    // TIER 2: Text search (legacy support)
    // ========================================================================
    if (position.sentenceText && position.sentenceText.length >= 10) {
        const result = searchAndScrollToText(
            container,
            position.sentenceText,
            isVertical,
            isRTL
        );

        if (result) {
            console.log('[Restoration] Text search success');
            return {
                success: true,
                method: 'text-search',
                confidence: 'medium',
                blockId: result.blockId,
            };
        }
    }

    // Also try context snippet for text search
    if (position.contextSnippet && position.contextSnippet.length >= 10) {
        const result = searchAndScrollToText(
            container,
            position.contextSnippet,
            isVertical,
            isRTL
        );

        if (result) {
            console.log('[Restoration] Context search success');
            return {
                success: true,
                method: 'text-search',
                confidence: 'medium',
                blockId: result.blockId,
            };
        }
    }

    // ========================================================================
    // TIER 3: Character offset fallback
    // ========================================================================
    if (position.chapterCharOffset && position.chapterCharOffset > 0) {
        const result = scrollToCharOffset(
            container,
            position.chapterIndex,
            position.chapterCharOffset,
            isVertical,
            isRTL
        );

        if (result) {
            console.log('[Restoration] Char offset success');
            return {
                success: true,
                method: 'char-offset',
                confidence: 'low',
                blockId: result.blockId,
            };
        }
    }

    // ========================================================================
    // TIER 4: Fallback - scroll to chapter start
    // ========================================================================
    const firstBlock = container.querySelector(
        `[data-block-id^="ch${position.chapterIndex}-b"]`
    );

    if (firstBlock) {
        scrollToBlock(firstBlock, container, isVertical, isRTL);
        const blockId = firstBlock.getAttribute('data-block-id') || undefined;

        console.log('[Restoration] Fallback to chapter start');
        return {
            success: true,
            method: 'fallback',
            confidence: 'low',
            blockId,
            message: 'Restored to chapter start',
        };
    }

    // ========================================================================
    // TIER 5: Complete failure
    // ========================================================================
    console.log('[Restoration] All methods failed');
    container.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    return {
        success: false,
        method: 'failed',
        confidence: 'low',
        message: 'Could not restore position',
    };
}

/**
 * Scroll to a block element
 */
function scrollToBlock(
    block: Element,
    container: HTMLElement,
    isVertical: boolean,
    isRTL: boolean
): void {
    if (isVertical) {
        block.scrollIntoView({
            block: 'end',
            inline: 'start',
            behavior: 'auto',
        });
    } else {
        block.scrollIntoView({
            block: 'start',
            inline: 'nearest',
            behavior: 'auto',
        });
    }
}

/**
 * Apply local offset within a block
 */
function applyLocalOffset(
    block: Element,
    container: HTMLElement,
    localOffset: number,
    isVertical: boolean
): void {
    const text = getCleanTextContent(block);
    if (text.length === 0) return;

    const ratio = Math.min(1, localOffset / text.length);
    const rect = block.getBoundingClientRect();

    if (isVertical) {
        // Vertical text: Scroll left (into already-read content)
        const scrollAmount = rect.width * ratio;
        container.scrollBy({ left: -scrollAmount, behavior: 'auto' });
    } else {
        // Horizontal text: Scroll down (into already-read content)
        const scrollAmount = rect.height * ratio;
        container.scrollBy({ top: scrollAmount, behavior: 'auto' });
    }
}

/**
 * Validate context snippet against block content
 */
function validateContext(
    block: Element,
    contextSnippet?: string
): 'high' | 'medium' | 'low' {
    if (!contextSnippet || contextSnippet.length < 5) {
        return 'medium';
    }

    const text = getCleanTextContent(block);

    if (text.includes(contextSnippet)) {
        return 'high';
    }

    // Try partial match (first 10 chars)
    if (text.includes(contextSnippet.substring(0, 10))) {
        return 'medium';
    }

    return 'low';
}

/**
 * Search for text and scroll to it
 */
function searchAndScrollToText(
    container: HTMLElement,
    searchText: string,
    isVertical: boolean,
    isRTL: boolean
): { blockId: string } | null {
    const allBlocks = container.querySelectorAll('[data-block-id]');

    // Try full text first
    for (const block of allBlocks) {
        const text = getCleanTextContent(block);

        if (text.includes(searchText)) {
            scrollToBlock(block, container, isVertical, isRTL);
            const blockId = block.getAttribute('data-block-id');
            return blockId ? { blockId } : null;
        }
    }

    // Try shorter search (first 30 chars)
    if (searchText.length > 30) {
        const shortSearch = searchText.substring(0, 30);

        for (const block of allBlocks) {
            const text = getCleanTextContent(block);

            if (text.includes(shortSearch)) {
                scrollToBlock(block, container, isVertical, isRTL);
                const blockId = block.getAttribute('data-block-id');
                return blockId ? { blockId } : null;
            }
        }
    }

    // Try even shorter (first 15 chars)
    if (searchText.length > 15) {
        const veryShortSearch = searchText.substring(0, 15);

        for (const block of allBlocks) {
            const text = getCleanTextContent(block);

            if (text.includes(veryShortSearch)) {
                scrollToBlock(block, container, isVertical, isRTL);
                const blockId = block.getAttribute('data-block-id');
                return blockId ? { blockId } : null;
            }
        }
    }

    return null;
}

/**
 * Scroll to approximate character offset
 */
function scrollToCharOffset(
    container: HTMLElement,
    chapterIndex: number,
    charOffset: number,
    isVertical: boolean,
    isRTL: boolean
): { blockId: string } | null {
    const allBlocks = Array.from(
        container.querySelectorAll(`[data-block-id^="ch${chapterIndex}-b"]`)
    );

    let currentOffset = 0;

    for (const block of allBlocks) {
        const text = getCleanTextContent(block);
        const blockLength = text.length;

        if (currentOffset + blockLength >= charOffset) {
            scrollToBlock(block, container, isVertical, isRTL);
            const blockId = block.getAttribute('data-block-id');
            return blockId ? { blockId } : null;
        }

        currentOffset += blockLength;
    }

    // Past all blocks - go to last one
    if (allBlocks.length > 0) {
        const lastBlock = allBlocks[allBlocks.length - 1];
        scrollToBlock(lastBlock, container, isVertical, isRTL);
        const blockId = lastBlock.getAttribute('data-block-id');
        return blockId ? { blockId } : null;
    }

    return null;
}

/**
 * Find block containing specific text
 */
export function findBlockByText(
    container: HTMLElement,
    searchText: string
): Element | null {
    const allBlocks = container.querySelectorAll('[data-block-id]');

    for (const block of allBlocks) {
        const text = getCleanTextContent(block);
        if (text.includes(searchText)) {
            return block;
        }
    }

    return null;
}

/**
 * Find block at character offset
 */
export function findBlockAtOffset(
    container: HTMLElement,
    chapterIndex: number,
    charOffset: number
): Element | null {
    const allBlocks = Array.from(
        container.querySelectorAll(`[data-block-id^="ch${chapterIndex}-b"]`)
    );

    let currentOffset = 0;

    for (const block of allBlocks) {
        const text = getCleanTextContent(block);
        const blockLength = text.length;

        if (currentOffset + blockLength >= charOffset) {
            return block;
        }

        currentOffset += blockLength;
    }

    return allBlocks.length > 0 ? allBlocks[allBlocks.length - 1] : null;
}