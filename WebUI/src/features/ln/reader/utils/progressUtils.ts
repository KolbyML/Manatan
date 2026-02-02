

import { BookStats } from '@/lib/storage/AppStorage';

export interface ReadingPosition {
    chapterIndex: number;
    pageIndex?: number;
    chapterCharOffset: number;
    totalCharsRead: number;
    sentenceText: string;
    chapterProgress: number;
    totalProgress: number;
    timestamp: number;
}


export function getTextAtReadingPosition(
    container: HTMLElement,
    isVertical: boolean
): { node: Node; offset: number } | null {
    const rect = container.getBoundingClientRect();


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


export function findNodeBySentence(
    chapterElement: Element,
    sentenceText: string
): { node: Node; offset: number } | null {
    if (!sentenceText || sentenceText.length < 5) {
        return null;
    }

    const walker = document.createTreeWalker(chapterElement, NodeFilter.SHOW_TEXT);
    let node: Node | null;


    const searchText = sentenceText.substring(0, 30);

    while ((node = walker.nextNode())) {
        const text = node.textContent || '';
        const index = text.indexOf(searchText);

        if (index !== -1) {
            return { node, offset: index };
        }
    }


    const walker2 = document.createTreeWalker(chapterElement, NodeFilter.SHOW_TEXT);
    while ((node = walker2.nextNode())) {
        const text = node.textContent || '';
        const index = text.indexOf(shortSearch);

        if (index !== -1) {
            return { node, offset: index };
        }
    }

    return null;
}


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


    if (charOffset > 0) {
        const nodeInfo = findNodeAtCharOffset(chapterElement, charOffset);

        if (nodeInfo) {
            console.log('[restoreReadingPosition] Found by charOffset');
            return scrollToTextNode(container, nodeInfo.node, nodeInfo.offset, isVertical, isRTL);
        }
    }


    if (sentenceText) {
        const nodeInfo = findNodeBySentence(chapterElement, sentenceText);

        if (nodeInfo) {
            console.log('[restoreReadingPosition] Found by sentence');
            return scrollToTextNode(container, nodeInfo.node, nodeInfo.offset, isVertical, isRTL);
        }
    }


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


export function buildReadingPosition(
    container: HTMLElement,
    chapterIndex: number,
    pageIndex: number | undefined,
    stats: BookStats,
    isVertical: boolean,
    isRTL: boolean = false
): ReadingPosition | null {
    const chapterProgress = calculateScrollProgress(container, isVertical, isRTL);
    const { totalCharsRead, totalProgress } = calculateTotalProgress(
        chapterIndex,
        chapterProgress,
        stats
    );

    let sentenceText = '';
    let chapterCharOffset = 0;

    const textPos = getTextAtReadingPosition(container, isVertical);
    if (textPos) {
        sentenceText = extractSentenceContext(textPos.node, textPos.offset);


        let chapterEl: Element | null = container.querySelector(`[data-chapter="${chapterIndex}"]`);
        if (!chapterEl) {
            chapterEl = container.querySelector('.paged-content') || container;
        }

        if (chapterEl) {
            chapterCharOffset = calculateChapterCharOffset(chapterEl, textPos.node, textPos.offset);
        }
    }

    if (!sentenceText && totalProgress === 0) {
        return null;
    }

    return {
        chapterIndex,
        pageIndex,
        chapterCharOffset,
        totalCharsRead,
        sentenceText,
        chapterProgress,
        totalProgress,
        timestamp: Date.now(),
    };
}