/**
 * Block Position Calculator
 * 
 * Calculates reading position within blocks:
 * - Local character offset within a block
 * - Context snippets for validation
 * - Viewport-relative position estimation
 */

// Universal regex for clean text (matches blockProcessor.ts)
const NOISE_REGEX = /[^\p{L}\p{N}]+/gu;

/**
 * Get clean text content from an element (excludes ruby annotations)
 */
export function getCleanTextContent(element: Element): string {
    const clone = element.cloneNode(true) as Element;
    clone.querySelectorAll('rt, rp').forEach(node => node.remove());
    return (clone.textContent || '').trim();
}

/**
 * Get clean character count
 */
export function getCleanCharCount(text: string): number {
    if (!text) return 0;
    const clean = text.replace(NOISE_REGEX, '');
    return Array.from(clean).length;
}

/**
 * Calculate local character offset within a block based on scroll position
 * 
 * This estimates how far into the block the user has read based on
 * what portion of the block is above/left of the reading edge.
 */
export function calculateBlockLocalOffset(
    block: Element,
    container: HTMLElement,
    isVertical: boolean
): number {
    const cleanText = getCleanTextContent(block);
    const totalChars = cleanText.length;

    if (totalChars === 0) return 0;

    const blockRect = block.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    let readRatio: number;

    if (isVertical) {
        // Vertical RTL: text flows right-to-left, top-to-bottom per column
        // Reading position is from the right edge
        const blockWidth = blockRect.width;
        const readWidth = containerRect.right - blockRect.right;

        if (blockWidth <= 0) return 0;

        readRatio = Math.max(0, Math.min(1, readWidth / blockWidth));
    } else {
        const blockHeight = blockRect.height;
        const readHeight = containerRect.top - blockRect.top;

        if (blockHeight <= 0) return 0;

        readRatio = Math.max(0, Math.min(1, -readHeight / blockHeight));
    }

    return Math.floor(totalChars * readRatio);
}

/**
 * Calculate precise offset using text range detection
 * More accurate but more expensive than ratio-based calculation
 */
export function calculatePreciseBlockOffset(
    block: Element,
    container: HTMLElement,
    isVertical: boolean
): number {
    const range = document.createRange();
    range.selectNodeContents(block);
    const rects = Array.from(range.getClientRects());

    if (rects.length === 0) return 0;

    const containerRect = container.getBoundingClientRect();
    let lineIndex = 0;

    if (isVertical) {
        const readingX = containerRect.right - 50;
        for (let i = 0; i < rects.length; i++) {
            if (rects[i].right <= readingX) {
                lineIndex = i;
                break;
            }
        }
    } else {
        const readingY = containerRect.top + 50;
        for (let i = 0; i < rects.length; i++) {
            if (rects[i].top >= readingY) {
                lineIndex = i;
                break;
            }
        }
    }

    const cleanText = getCleanTextContent(block);
    const totalChars = cleanText.length;

    if (totalChars === 0) return 0;

    const lineRatio = lineIndex / Math.max(rects.length, 1);
    return Math.floor(totalChars * lineRatio);
}

/**
 * Extract context snippet around the current position
 * Used for validation during restoration
 */
export function extractContextSnippet(
    block: Element,
    localOffset: number,
    contextLength: number = 20
): string {
    const text = getCleanTextContent(block);

    if (text.length === 0) return '';

    const offset = Math.max(0, Math.min(localOffset, text.length - 1));

    const start = Math.max(0, offset - contextLength);
    const end = Math.min(text.length, offset + contextLength);

    return text.substring(start, end);
}

/**
 * Extract the current sentence at position
 * Uses Japanese/Chinese sentence delimiters
 */
export function extractSentenceAtOffset(
    block: Element,
    localOffset: number
): string {
    const text = getCleanTextContent(block);

    if (text.length === 0) return '';

    const offset = Math.max(0, Math.min(localOffset, text.length - 1));

    const delimiters = /[。！？!?．\n]/;

    let start = offset;
    while (start > 0 && !delimiters.test(text[start - 1])) {
        start--;
    }

    let end = offset;
    while (end < text.length && !delimiters.test(text[end])) {
        end++;
    }

    if (end < text.length && delimiters.test(text[end])) {
        end++;
    }

    return text.substring(start, end).trim();
}

/**
 * Find text node and offset at a specific point in the document
 * Used for precise position detection
 */
export function getTextPositionAtPoint(
    x: number,
    y: number
): { node: Node; offset: number } | null {
    let range: Range | null = null;

    if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(x, y);
    }
    else if ((document as any).caretPositionFromPoint) {
        const pos = (document as any).caretPositionFromPoint(x, y);
        if (pos?.offsetNode) {
            range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
        }
    }

    if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) {
        return null;
    }

    return { node: range.startContainer, offset: range.startOffset };
}

/**
 * Calculate character offset within chapter based on block position
 */
export function calculateChapterCharOffset(
    container: HTMLElement,
    blockId: string,
    blockLocalOffset: number,
    chapterIndex: number
): number {
    const allBlocks = container.querySelectorAll(`[data-block-id^="ch${chapterIndex}-b"]`);

    let totalOffset = 0;

    for (const block of allBlocks) {
        const id = block.getAttribute('data-block-id');

        if (id === blockId) {
            return totalOffset + blockLocalOffset;
        }

        const text = getCleanTextContent(block);
        totalOffset += getCleanCharCount(text);
    }

    return totalOffset + blockLocalOffset;
}

/**
 * Get block order number from block ID
 */
export function getBlockOrder(blockId: string): number {
    const match = blockId.match(/ch\d+-b(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Get chapter index from block ID
 */
export function getChapterIndex(blockId: string): number {
    const match = blockId.match(/ch(\d+)-b\d+/);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Build full reading position from block information
 */
export interface BlockPositionInfo {
    blockId: string;
    blockLocalOffset: number;
    contextSnippet: string;
    chapterIndex: number;
    chapterCharOffset: number;
}

export function buildBlockPosition(
    container: HTMLElement,
    block: Element,
    isVertical: boolean
): BlockPositionInfo | null {
    const blockId = block.getAttribute('data-block-id');
    if (!blockId) return null;

    const chapterIndex = getChapterIndex(blockId);
    const blockLocalOffset = calculateBlockLocalOffset(block, container, isVertical);
    const contextSnippet = extractContextSnippet(block, blockLocalOffset, 20);
    const chapterCharOffset = calculateChapterCharOffset(
        container,
        blockId,
        blockLocalOffset,
        chapterIndex
    );

    return {
        blockId,
        blockLocalOffset,
        contextSnippet,
        chapterIndex,
        chapterCharOffset,
    };
}