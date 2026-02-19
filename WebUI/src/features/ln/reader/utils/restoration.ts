
import { BlockIndexMap } from '../types/block';
import { 
    createChapterBlockLookup, 
    findBlockAtOffset,
    getPositionFromCharOffset,
    calculateLocalOffsetFromCharOffset
} from './blockMap';
import { getCleanTextContent } from './blockPosition';

export function hasChapterBlocks(container: HTMLElement, chapterIndex: number): boolean {
    const blocks = container.querySelectorAll(`[data-block-id^="ch${chapterIndex}-b"]`);
    return blocks.length > 0;
}

export interface RestorationResult {
    success: boolean;
    method: 'block' | 'block-offset' | 'block-map' | 'text-search' | 'fallback' | 'failed';
    confidence: 'high' | 'medium' | 'low';
    blockId?: string;
    message?: string;
}

export interface RestorationPosition {
    blockId?: string;
    blockLocalOffset?: number;
    contextSnippet?: string;
    chapterIndex: number;
    chapterCharOffset?: number;
    sentenceText?: string;
}

export interface RestorationOptions {
    isVertical: boolean;
    isRTL?: boolean;
    blockMaps?: BlockIndexMap[];
}

export function restoreReadingPosition(
    container: HTMLElement,
    position: RestorationPosition,
    options: RestorationOptions
): RestorationResult {
    const { isVertical, isRTL = false, blockMaps } = options;
    
    console.log('[Restoration] Attempting restore:', {
        blockId: position.blockId,
        chapterIndex: position.chapterIndex,
        hasContext: !!position.contextSnippet,
        hasCharOffset: !!position.chapterCharOffset,
        hasBlockMaps: !!blockMaps && blockMaps.length > 0,
    });

    if (position.blockId) {
        const block = container.querySelector(`[data-block-id="${position.blockId}"]`);

        if (block) {
            console.log('[Restoration] Block found, applying offset:', {
                blockId: position.blockId,
                blockLocalOffset: position.blockLocalOffset,
                chapterCharOffset: position.chapterCharOffset,
            });

            scrollToBlock(block, container, isVertical, isRTL);

            if (position.blockLocalOffset && position.blockLocalOffset > 0) {
                applyLocalOffset(block, container, position.blockLocalOffset, isVertical, isRTL);
            }

            const confidence = validateContext(block, position.contextSnippet);

            console.log('[Restoration] Block-based success:', {
                blockId: position.blockId,
                blockLocalOffset: position.blockLocalOffset,
                confidence,
            });

            return {
                success: true,
                method: position.blockLocalOffset && position.blockLocalOffset > 0
                    ? 'block-offset'
                    : 'block',
                confidence,
                blockId: position.blockId,
            };
        }

        console.log('[Restoration] Block not found (data-block-id changed?), trying blockMaps fallback');
    }

    if (blockMaps && blockMaps.length > 0 && position.chapterCharOffset && position.chapterCharOffset > 0) {
        console.log('[Restoration] Attempting blockMap restore:', {
            chapterIndex: position.chapterIndex,
            chapterCharOffset: position.chapterCharOffset,
            blockMapsCount: blockMaps.length,
            savedBlockId: position.blockId,
        });
        
        const chapterLookup = createChapterBlockLookup(blockMaps, position.chapterIndex);
        
        console.log('[Restoration] Chapter lookup:', {
            blockCount: chapterLookup.sortedByOffset.length,
            firstBlock: chapterLookup.sortedByOffset[0]?.blockId,
            firstStart: chapterLookup.sortedByOffset[0]?.startOffset,
            lastBlock: chapterLookup.sortedByOffset[chapterLookup.sortedByOffset.length - 1]?.blockId,
            lastEnd: chapterLookup.sortedByOffset[chapterLookup.sortedByOffset.length - 1]?.endOffset,
        });
        
        if (chapterLookup.sortedByOffset.length > 0) {
            const pos = getPositionFromCharOffset(chapterLookup, position.chapterCharOffset);
            
            console.log('[Restoration] Found position:', pos);
            
            if (pos) {
                const block = container.querySelector(`[data-block-id="${pos.blockId}"]`);
                
                console.log('[Restoration] Block in DOM:', block ? 'found' : 'not found');
                
                if (block) {
                    scrollToBlock(block, container, isVertical, isRTL);
                    
                    if (pos.blockLocalOffset > 0) {
                        applyLocalOffset(block, container, pos.blockLocalOffset, isVertical, isRTL);
                    }

                    console.log('[Restoration] BlockMap-based success:', {
                        foundBlockId: pos.blockId,
                        blockLocalOffset: pos.blockLocalOffset,
                        originalCharOffset: position.chapterCharOffset,
                    });

                    return {
                        success: true,
                        method: 'block-map',
                        confidence: 'high',
                        blockId: pos.blockId,
                    };
                }
            }
        }
    } else {
        console.log('[Restoration] Skipping blockMap restore:', {
            hasBlockMaps: !!(blockMaps && blockMaps.length > 0),
            hasCharOffset: !!(position.chapterCharOffset && position.chapterCharOffset > 0),
        });
    }

    if (position.contextSnippet && position.contextSnippet.length >= 5) {
        const result = searchAndScrollToText(container, position.contextSnippet, isVertical, isRTL);

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

    if (position.sentenceText && position.sentenceText.length >= 5) {
        const result = searchAndScrollToText(container, position.sentenceText, isVertical, isRTL);

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

    console.log('[Restoration] All methods failed');
    container.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    return {
        success: false,
        method: 'failed',
        confidence: 'low',
        message: 'Could not restore position',
    };
}

function scrollToBlock(
    block: Element,
    container: HTMLElement,
    isVertical: boolean,
    isRTL: boolean,
    localOffset?: number
): void {
    // For now, use the simpler scrollIntoView approach
    // The applyLocalOffset will handle precise positioning after
    if (isVertical) {
        block.scrollIntoView({
            block: 'start',
            inline: isRTL ? 'start' : 'end',
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

function applyLocalOffset(
    block: Element,
    container: HTMLElement,
    localOffset: number,
    isVertical: boolean,
    isRTL: boolean = false
): void {
    const text = getCleanTextContent(block);
    if (text.length === 0) return;

    // Try precise caret-based positioning first
    const applied = applyLocalOffsetCaret(block, container, localOffset, isVertical, isRTL);
    if (applied) return;

    // Fallback to ratio-based (less precise)
    const ratio = Math.min(1, localOffset / text.length);
    const rect = block.getBoundingClientRect();

    if (isVertical) {
        const scrollAmount = rect.width * ratio;
        const direction = isRTL ? 1 : -1;
        container.scrollBy({ left: scrollAmount * direction, behavior: 'auto' });
    } else {
        const scrollAmount = rect.height * ratio;
        container.scrollBy({ top: scrollAmount, behavior: 'auto' });
    }
}

function applyLocalOffsetCaret(
    block: Element,
    container: HTMLElement,
    localOffset: number,
    isVertical: boolean,
    isRTL: boolean = false
): boolean {
    try {
        const text = getCleanTextContent(block);
        if (text.length === 0 || localOffset <= 0) return false;

        // Find the text node that contains our target offset
        let currentOffset = 0;
        let targetNode: Text | null = null;
        let targetNodeStart = 0;

        const walker = document.createTreeWalker(
            block,
            NodeFilter.SHOW_TEXT,
            null
        );

        while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            const nodeLength = node.textContent?.length || 0;

            if (currentOffset + nodeLength >= localOffset) {
                targetNode = node;
                targetNodeStart = currentOffset;
                break;
            }
            currentOffset += nodeLength;
        }

        if (!targetNode) return false;

        const offsetInNode = localOffset - targetNodeStart;
        const range = document.createRange();
        
        try {
            range.setStart(targetNode, Math.min(offsetInNode, targetNode.length));
            range.collapse(true);
        } catch {
            return false;
        }

        const rect = range.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) return false;

        const containerRect = container.getBoundingClientRect();

        if (isVertical) {
            let scrollLeft: number;
            if (isRTL) {
                scrollLeft = container.scrollLeft + rect.left - containerRect.left;
            } else {
                scrollLeft = container.scrollLeft + rect.right - containerRect.right;
            }
            const scrollTop = container.scrollTop + rect.top - containerRect.top;
            container.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'auto' });
        } else {
            const scrollTop = container.scrollTop + rect.top - containerRect.top;
            container.scrollTo({ top: scrollTop, left: container.scrollLeft, behavior: 'auto' });
        }

        console.log('[Restoration] Applied precise caret offset:', { localOffset, offsetInNode, isVertical, isRTL });
        return true;
    } catch (e) {
        console.warn('[Restoration] Caret positioning failed:', e);
        return false;
    }
}

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

    if (text.includes(contextSnippet.substring(0, 10))) {
        return 'medium';
    }

    return 'low';
}

function searchAndScrollToText(
    container: HTMLElement,
    searchText: string,
    isVertical: boolean,
    isRTL: boolean
): { blockId: string } | null {
    const allBlocks = container.querySelectorAll('[data-block-id]');

    for (const block of allBlocks) {
        const text = getCleanTextContent(block);

        if (text.includes(searchText)) {
            scrollToBlock(block, container, isVertical, isRTL);
            const blockId = block.getAttribute('data-block-id');
            return blockId ? { blockId } : null;
        }
    }

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
