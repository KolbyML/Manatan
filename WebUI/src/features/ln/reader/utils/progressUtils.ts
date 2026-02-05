

import { BookStats } from '@/lib/storage/AppStorage';
import { ReadingPosition } from '../types/progress';
import { BlockIndexMap } from '../types/block';
import {
    getCleanTextContent,
    getCleanCharCount,
    calculateBlockLocalOffset,
    extractContextSnippet,
    getChapterIndex,
    getBlockOrder,
} from './blockPosition';
import { detectCurrentBlock } from './blockTracker';

// ============================================================================
// Constants
// ============================================================================

// Whitespace regex (matches blockProcessor.ts)
const WHITESPACE_REGEX = /[\s\u200B-\u200D\uFEFF\u00A0\t\r\n]+/gu;

// ============================================================================
// Text Position Detection (Legacy Support)
// ============================================================================

/**
 * Get text node at reading position using caret detection
 */
export function getTextAtReadingPosition(
    container: HTMLElement,
    isVertical: boolean
): { node: Node; offset: number } | null {
    const rect = container.getBoundingClientRect();

    // Reading position: near right edge for vertical, near top for horizontal
    const x = isVertical ? rect.right - 50 : rect.left + 50;
    const y = rect.top + 50;

    let range: Range | null = null;

    if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(x, y);
    } else if ((document as any).caretPositionFromPoint) {
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
 * Extract sentence context around a text position
 */
export function extractSentenceContext(
    node: Node,
    offset: number,
    length: number = 80
): string {
    const text = node.textContent || '';
    const start = Math.max(0, offset - 20);
    const end = Math.min(text.length, offset + length);
    return text.substring(start, end).trim();
}

/**
 * Calculate character offset within chapter from text node
 */
export function calculateChapterCharOffset(
    chapterElement: Element,
    textNode: Node,
    textOffset: number
): number {
    const walker = document.createTreeWalker(chapterElement, NodeFilter.SHOW_TEXT);
    let totalOffset = 0;
    let current: Node | null;

    while ((current = walker.nextNode())) {
        if (current === textNode) {
            return totalOffset + textOffset;
        }
        totalOffset += (current.textContent || '').length;
    }

    return totalOffset;
}

// ============================================================================
// Block-Based Position Detection
// ============================================================================

/**
 * Detect current reading position using block tracking
 */
export function detectReadingPosition(
    container: HTMLElement,
    chapterIndex: number,
    isVertical: boolean,
    blockMap?: BlockIndexMap
): {
    blockId: string;
    blockLocalOffset: number;
    contextSnippet: string;
    chapterCharOffset: number;
} | null {
    // Try to detect current block
    const detected = detectCurrentBlock(container, isVertical);

    if (!detected) {
        return null;
    }

    const { blockId, element } = detected;

    // Calculate local offset within the block
    const blockLocalOffset = calculateBlockLocalOffset(element, container, isVertical);

    // Extract context for validation
    const contextSnippet = extractContextSnippet(element, blockLocalOffset, 20);

    // Calculate chapter character offset
    let chapterCharOffset = blockLocalOffset;

    if (blockMap) {
        // Use block map for accurate calculation
        const block = blockMap.blocks.find(b => b.id === blockId);
        if (block) {
            chapterCharOffset = block.cleanCharStart + blockLocalOffset;
        }
    } else {
        // Fallback: count chars from previous blocks
        const blockOrder = getBlockOrder(blockId);
        const detectedChapterIndex = getChapterIndex(blockId);

        for (let i = 0; i < blockOrder; i++) {
            const prevBlock = container.querySelector(
                `[data-block-id="ch${detectedChapterIndex}-b${i}"]`
            );
            if (prevBlock) {
                const text = getCleanTextContent(prevBlock);
                chapterCharOffset += getCleanCharCount(text);
            }
        }
    }

    return {
        blockId,
        blockLocalOffset,
        contextSnippet,
        chapterCharOffset,
    };
}

// ============================================================================
// Scroll Progress Calculation
// ============================================================================

/**
 * Calculate scroll progress percentage
 */
export function calculateScrollProgress(
    container: HTMLElement,
    isVertical: boolean,
    isRTL: boolean = false
): number {
    if (isVertical) {
        const maxScroll = Math.abs(container.scrollWidth - container.clientWidth);
        if (maxScroll <= 1) return 0;

        const current = Math.abs(container.scrollLeft);
        return Math.min(100, Math.max(0, (current / maxScroll) * 100));
    } else {
        const maxScroll = container.scrollHeight - container.clientHeight;
        if (maxScroll <= 0) return 0;
        return Math.min(100, Math.max(0, (container.scrollTop / maxScroll) * 100));
    }
}

/**
 * Calculate total book progress from chapter progress
 */
export function calculateTotalProgress(
    chapterIndex: number,
    chapterProgress: number,
    stats: BookStats
): { totalCharsRead: number; totalProgress: number } {
    if (stats.totalLength === 0) {
        return { totalCharsRead: 0, totalProgress: 0 };
    }

    let charsBeforeChapter = 0;
    for (let i = 0; i < chapterIndex; i++) {
        charsBeforeChapter += stats.chapterLengths[i] || 0;
    }

    const currentChapterLength = stats.chapterLengths[chapterIndex] || 0;
    const charsInChapter = Math.floor(currentChapterLength * (chapterProgress / 100));
    const totalCharsRead = charsBeforeChapter + charsInChapter;
    const totalProgress = (totalCharsRead / stats.totalLength) * 100;

    return {
        totalCharsRead,
        totalProgress: Math.min(100, Math.max(0, totalProgress)),
    };
}

/**
 * Calculate progress from block position
 */
export function calculateProgressFromBlock(
    blockId: string,
    blockLocalOffset: number,
    chapterIndex: number,
    stats: BookStats,
    blockMap?: BlockIndexMap
): {
    chapterProgress: number;
    totalProgress: number;
    totalCharsRead: number;
    chapterCharOffset: number;
} {
    // Calculate chapter character offset
    let chapterCharOffset = blockLocalOffset;

    if (blockMap) {
        const block = blockMap.blocks.find(b => b.id === blockId);
        if (block) {
            chapterCharOffset = block.cleanCharStart + Math.min(blockLocalOffset, block.cleanCharCount);
        }
    }

    // Calculate chapter progress
    const chapterLength = stats.chapterLengths[chapterIndex] || 1;
    const chapterProgress = Math.min(100, (chapterCharOffset / chapterLength) * 100);

    // Calculate total progress
    const { totalCharsRead, totalProgress } = calculateTotalProgress(
        chapterIndex,
        chapterProgress,
        stats
    );

    return {
        chapterProgress,
        totalProgress,
        totalCharsRead,
        chapterCharOffset,
    };
}

// ============================================================================
// Position Building
// ============================================================================

/**
 * Build complete reading position from current state
 */
export function buildReadingPosition(
    container: HTMLElement,
    chapterIndex: number,
    pageIndex: number | undefined,
    stats: BookStats,
    isVertical: boolean,
    isRTL: boolean = false,
    blockMap?: BlockIndexMap
): ReadingPosition | null {
    // Try block-based detection first
    const blockPosition = detectReadingPosition(container, chapterIndex, isVertical, blockMap);

    let blockId: string | undefined;
    let blockLocalOffset = 0;
    let contextSnippet = '';
    let chapterCharOffset = 0;
    let sentenceText = '';

    if (blockPosition) {
        blockId = blockPosition.blockId;
        blockLocalOffset = blockPosition.blockLocalOffset;
        contextSnippet = blockPosition.contextSnippet;
        chapterCharOffset = blockPosition.chapterCharOffset;
        sentenceText = contextSnippet; // Use context as sentence for legacy compatibility
    } else {
        // Fallback to legacy text detection
        const textPos = getTextAtReadingPosition(container, isVertical);
        if (textPos) {
            sentenceText = extractSentenceContext(textPos.node, textPos.offset);

            let chapterEl: Element | null = container.querySelector(
                `[data-chapter="${chapterIndex}"]`
            );
            if (!chapterEl) {
                chapterEl = container.querySelector('.paged-content') || container;
            }

            if (chapterEl) {
                chapterCharOffset = calculateChapterCharOffset(
                    chapterEl,
                    textPos.node,
                    textPos.offset
                );
            }
        }
    }

    // Calculate progress
    const chapterProgress = stats.chapterLengths[chapterIndex] > 0
        ? (chapterCharOffset / stats.chapterLengths[chapterIndex]) * 100
        : calculateScrollProgress(container, isVertical, isRTL);

    const { totalCharsRead, totalProgress } = calculateTotalProgress(
        chapterIndex,
        chapterProgress,
        stats
    );

    // Don't save if no meaningful position detected
    if (!blockId && !sentenceText && totalProgress === 0) {
        return null;
    }

    return {
        // Block-based (new)
        blockId,
        blockLocalOffset,
        contextSnippet,

        // Chapter info
        chapterIndex,
        pageIndex,

        // Character-based
        chapterCharOffset,
        totalCharsRead,

        // Legacy
        sentenceText: sentenceText || contextSnippet,

        // Progress
        chapterProgress,
        totalProgress,

        // Metadata
        timestamp: Date.now(),
    };
}

// ============================================================================
// Position Restoration (Legacy - kept for backwards compatibility)
// ============================================================================

/**
 * Find text node at character offset
 */
export function findNodeAtCharOffset(
    chapterElement: Element,
    targetCharOffset: number
): { node: Node; offset: number } | null {
    const walker = document.createTreeWalker(chapterElement, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let current: Node | null;

    while ((current = walker.nextNode())) {
        const nodeLength = (current.textContent || '').length;

        if (currentOffset + nodeLength >= targetCharOffset) {
            const offsetInNode = targetCharOffset - currentOffset;
            return {
                node: current,
                offset: Math.min(offsetInNode, nodeLength)
            };
        }

        currentOffset += nodeLength;
    }

    return null;
}

/**
 * Find text node by sentence text
 */
export function findNodeBySentence(
    chapterElement: Element,
    sentenceText: string
): { node: Node; offset: number } | null {
    if (!sentenceText || sentenceText.length < 5) {
        return null;
    }

    const walker = document.createTreeWalker(chapterElement, NodeFilter.SHOW_TEXT);
    let node: Node | null;

    // Try full text first
    const searchText = sentenceText.substring(0, 30);

    while ((node = walker.nextNode())) {
        const text = node.textContent || '';
        const index = text.indexOf(searchText);

        if (index !== -1) {
            return { node, offset: index };
        }
    }

    // Try shorter search
    if (sentenceText.length > 15) {
        const shortSearch = sentenceText.substring(0, 15);
        const walker2 = document.createTreeWalker(chapterElement, NodeFilter.SHOW_TEXT);

        while ((node = walker2.nextNode())) {
            const text = node.textContent || '';
            const index = text.indexOf(shortSearch);

            if (index !== -1) {
                return { node, offset: index };
            }
        }
    }

    return null;
}

/**
 * Scroll to a text node position
 */
export function scrollToTextNode(
    container: HTMLElement,
    node: Node,
    offset: number,
    isVertical: boolean,
    isRTL: boolean = false
): boolean {
    try {
        const range = document.createRange();
        range.setStart(node, offset);
        const len = (node.textContent || '').length;
        range.setEnd(node, Math.min(offset + 1, len));

        if (isVertical) {
            const span = document.createElement('span');
            span.style.cssText = 'position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;';
            range.insertNode(span);

            span.scrollIntoView({
                behavior: 'auto',
                block: 'start',
                inline: 'center'
            });

            span.parentNode?.removeChild(span);
        } else {
            const rect = range.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const currentScroll = container.scrollTop;
            const textPositionInViewport = rect.top - containerRect.top;
            const textAbsolutePosition = currentScroll + textPositionInViewport;
            const targetScroll = textAbsolutePosition - (containerRect.height * 0.1);
            const maxScroll = container.scrollHeight - container.clientHeight;
            container.scrollTop = Math.max(0, Math.min(maxScroll, targetScroll));
        }

        return true;
    } catch (err) {
        console.error('[scrollToTextNode] Error:', err);
        return false;
    }
}

/**
 * Legacy restore function (kept for backwards compatibility)
 * New code should use restoration.ts instead
 */
export function restoreReadingPosition(
    container: HTMLElement,
    chapterIndex: number,
    charOffset: number,
    sentenceText: string,
    isVertical: boolean,
    isRTL: boolean = false
): boolean {
    let chapterElement: Element | null = container.querySelector(
        `[data-chapter="${chapterIndex}"]`
    );

    if (!chapterElement) {
        chapterElement = container.querySelector('.paged-content');
    }

    if (!chapterElement) {
        chapterElement = container;
    }

    console.log('[restoreReadingPosition] Attempting restore:', {
        chapterIndex,
        charOffset,
        sentenceText: sentenceText?.substring(0, 30) + '...',
        isVertical,
    });

    // Try character offset first
    if (charOffset > 0) {
        const nodeInfo = findNodeAtCharOffset(chapterElement, charOffset);

        if (nodeInfo) {
            console.log('[restoreReadingPosition] Found by charOffset');
            return scrollToTextNode(container, nodeInfo.node, nodeInfo.offset, isVertical, isRTL);
        }
    }

    // Try sentence text
    if (sentenceText) {
        const nodeInfo = findNodeBySentence(chapterElement, sentenceText);

        if (nodeInfo) {
            console.log('[restoreReadingPosition] Found by sentence');
            return scrollToTextNode(container, nodeInfo.node, nodeInfo.offset, isVertical, isRTL);
        }
    }

    // Fallback: scroll to chapter start
    if (chapterElement !== container) {
        const chapterRect = chapterElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        if (isVertical) {
            const offset = chapterRect.left - containerRect.left + container.scrollLeft;
            container.scrollLeft = Math.max(0, offset - containerRect.width * 0.9);
        } else {
            const offset = chapterRect.top - containerRect.top + container.scrollTop;
            container.scrollTop = Math.max(0, offset);
        }
    }

    return false;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get character count from HTML (for legacy compatibility)
 */
export function getCharacterCount(text: string): number {
    if (!text) return 0;
    const clean = text.replace(WHITESPACE_REGEX, '');
    return Array.from(clean).length;
}

/**
 * Find the nearest sentence end from a specific text offset
 */
export function findSentenceEnd(text: string, offset: number): number {
    const delimiters = ['。', '！', '？', '!', '?', '\n', '」'];

    for (let i = offset; i < text.length; i++) {
        if (delimiters.includes(text[i])) {
            return i + 1;
        }
        if (i - offset > 200) break;
    }

    return offset;
}

/**
 * Calculate book stats from chapters (for legacy compatibility)
 */
export function calculateBookStats(chapters: string[]): number[] {
    return chapters.map(html => {
        const text = html.replace(/<[^>]*>/g, '');
        return getCharacterCount(text);
    });
}