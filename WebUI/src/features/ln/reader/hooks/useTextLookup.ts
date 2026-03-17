/**
 * Text lookup hook for dictionary integration in LN Reader
 */

import { useCallback } from 'react';
import type { YomitanLanguage } from '@/Manatan/types';
import { useOCR } from '@/Manatan/context/OCRContext';
import { lookupYomitan } from '@/Manatan/utils/api';
import { isNoSpaceLanguage } from '@/Manatan/utils/language';

const BLOCK_TAGS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const SENTENCE_END_SET = new Set(['。', '！', '？', '；', '.', '!', '?', ';']);
const MAX_SENTENCE_LENGTH = 50;
const INTERACTIVE_SELECTORS = 'a, button, input, ruby rt, img, .nav-btn, .reader-progress, .reader-slider-wrap';
const WHITESPACE_REGEX = /\s/;
const LOOKUP_ROOT_SELECTOR = '[data-block-id], p, li, td, th, blockquote, h1, h2, h3, h4, h5, h6, section, article';
const UNICODE_WORD_CHAR_REGEX = /[\p{L}\p{N}]/u;
const WORD_CONNECTORS = new Set(["'", '’', '-', '‐', '‑', '–', '—']);

const textEncoder = new TextEncoder();

const isNodeInDocument = (node: Node | null | undefined): boolean =>
    !!node && node.isConnected && node.ownerDocument === document;

const clampOffset = (offset: number, textLength: number): number => Math.min(Math.max(offset, 0), textLength);
const isWordChar = (value: string): boolean => UNICODE_WORD_CHAR_REGEX.test(value);

const isWordContinuationAt = (text: string, index: number): boolean => {
    if (index < 0 || index >= text.length) {
        return false;
    }

    const char = text[index];
    if (isWordChar(char)) {
        return true;
    }

    if (!WORD_CONNECTORS.has(char)) {
        return false;
    }

    if (index <= 0 || index + 1 >= text.length) {
        return false;
    }

    return isWordChar(text[index - 1]) && isWordChar(text[index + 1]);
};

const getLookupStartOffset = (text: string, offset: number, language?: YomitanLanguage): number => {
    const safeOffset = clampOffset(offset, text.length);
    if (safeOffset <= 0 || isNoSpaceLanguage(language)) {
        return safeOffset;
    }

    let wordStart = safeOffset;
    while (
        wordStart > 0
        && !WHITESPACE_REGEX.test(text[wordStart - 1])
        && isWordContinuationAt(text, wordStart - 1)
    ) {
        wordStart -= 1;
    }
    return wordStart;
};

const getCaretRange = (x: number, y: number) => {
    const pos = (document as any).caretPositionFromPoint?.(x, y);
    if (pos) {
        const range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        return range;
    }
    return document.caretRangeFromPoint?.(x, y) ?? null;
};

const getRectsFromRange = (range: Range) =>
    Array.from(range.getClientRects())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
        }));

const getLookupRootNode = (startNode: Node): Node => {
    const preferredRoot = startNode.parentElement?.closest(LOOKUP_ROOT_SELECTOR);
    if (preferredRoot) {
        return preferredRoot;
    }

    let contextElement: Element | null = startNode.parentElement;
    while (contextElement?.parentElement && !BLOCK_TAGS.has(contextElement.tagName)) {
        contextElement = contextElement.parentElement;
    }

    return contextElement || document.body;
};

const createVisibleTextWalker = (root: Node) =>
    document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        (node) => node.parentElement?.closest('rt, rp')
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT
    );

const getRootCharIndex = (root: Node, targetNode: Node, targetOffset: number): number | null => {
    const walker = createVisibleTextWalker(root);
    let total = 0;
    let current: Node | null;

    while ((current = walker.nextNode())) {
        if (current === targetNode) {
            const length = current.textContent?.length || 0;
            return total + clampOffset(targetOffset, length);
        }
        total += current.textContent?.length || 0;
    }

    return null;
};

const getNodeOffsetAtRootCharIndex = (root: Node, charIndex: number): { node: Node; offset: number } | null => {
    const walker = createVisibleTextWalker(root);
    let remaining = Math.max(0, charIndex);
    let current: Node | null;
    let lastNode: Node | null = null;

    while ((current = walker.nextNode())) {
        lastNode = current;
        const length = current.textContent?.length || 0;
        if (remaining <= length) {
            return { node: current, offset: remaining };
        }
        remaining -= length;
    }

    if (lastNode) {
        const length = lastNode.textContent?.length || 0;
        return { node: lastNode, offset: length };
    }

    return null;
};

const getBlockById = (blockId: string): Element | null => {
    const blocks = document.querySelectorAll('[data-block-id]');
    for (const block of Array.from(blocks)) {
        if (block.getAttribute('data-block-id') === blockId) {
            return block;
        }
    }
    return null;
};

export function useTextLookup() {
    const { settings, setDictPopup } = useOCR();

    const getCharacterAtPoint = useCallback((x: number, y: number): {
        node: Node;
        offset: number;
        character: string;
        rect: DOMRect;
    } | null => {
        const range = getCaretRange(x, y);

        if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) {
            return null;
        }

        const node = range.startContainer;
        const text = node.textContent;
        if (!text?.length) return null;

        const caretOffset = range.startOffset;

        // TextBox approach: only check backward character (most common)
        if (caretOffset > 0) {
            const char = text[caretOffset - 1];
            if (!WHITESPACE_REGEX.test(char)) {
                try {
                    const testRange = document.createRange();
                    testRange.setStart(node, caretOffset - 1);
                    testRange.setEnd(node, caretOffset);
                    const rect = testRange.getBoundingClientRect();

                    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                        return { node, offset: caretOffset - 1, character: char, rect };
                    }
                } catch (e) { }
            }
        }

        // Fallback: use caret position with bounding rect check
        if (caretOffset < text.length) {
            const char = text[caretOffset];
            if (!WHITESPACE_REGEX.test(char)) {
                try {
                    const testRange = document.createRange();
                    testRange.setStart(node, caretOffset);
                    testRange.setEnd(node, caretOffset + 1);
                    const rect = testRange.getBoundingClientRect();

                    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                        return { node, offset: caretOffset, character: char, rect };
                    }
                } catch (e) { }
            }
        }

        return null;
    }, []);

    const getSentenceContext = useCallback((
        targetNode: Node,
        targetOffset: number
    ): { sentence: string; byteOffset: number } | null => {
        // Find block-level ancestor
        let contextElement: Element | null = targetNode.parentElement;
        while (contextElement?.parentElement && !BLOCK_TAGS.has(contextElement.tagName)) {
            contextElement = contextElement.parentElement;
        }

        if (!contextElement) {
            const text = targetNode.textContent || '';
            return {
                sentence: text,
                byteOffset: textEncoder.encode(text.substring(0, targetOffset)).length
            };
        }

        // Walk the tree to get full text and find position
        const walker = document.createTreeWalker(
            contextElement,
            NodeFilter.SHOW_TEXT,
            (node) => node.parentElement?.closest('rt, rp')
                ? NodeFilter.FILTER_REJECT
                : NodeFilter.FILTER_ACCEPT
        );

        const textParts: string[] = [];
        let clickPosition = -1;
        let currentLength = 0;
        let currentNode: Node | null;

        while ((currentNode = walker.nextNode())) {
            if (currentNode === targetNode) {
                clickPosition = currentLength + targetOffset;
            }
            const nodeText = currentNode.textContent || '';
            textParts.push(nodeText);
            currentLength += nodeText.length;
        }

        const fullText = textParts.join('');

        if (clickPosition === -1) {
            return {
                sentence: fullText,
                byteOffset: textEncoder.encode(fullText.substring(0, targetOffset)).length
            };
        }

        // Find sentence boundaries
        let start = 0;
        for (let i = clickPosition - 1; i >= 0; i--) {
            if (SENTENCE_END_SET.has(fullText[i])) {
                start = i + 1;
                break;
            }
            if (clickPosition - i > MAX_SENTENCE_LENGTH) {
                start = clickPosition - MAX_SENTENCE_LENGTH;
                break;
            }
        }

        let end = fullText.length;
        for (let i = clickPosition; i < fullText.length; i++) {
            if (SENTENCE_END_SET.has(fullText[i])) {
                end = i + 1;
                break;
            }
            if (i - clickPosition > MAX_SENTENCE_LENGTH) {
                end = clickPosition + MAX_SENTENCE_LENGTH;
                break;
            }
        }

        const sentenceRaw = fullText.substring(start, end);
        const trimStart = sentenceRaw.search(/\S/);
        const sentence = sentenceRaw.trim();
        const posInSentence = clickPosition - start - (trimStart > 0 ? trimStart : 0);

        return {
            sentence,
            byteOffset: textEncoder.encode(sentence.substring(0, Math.max(0, posInSentence))).length
        };
    }, []);

    const tryLookup = useCallback(async (e: React.MouseEvent): Promise<boolean> => {
        if (!settings.enableYomitan) return false;

        const target = e.target as HTMLElement;
        if (target.closest(INTERACTIVE_SELECTORS)) return false;

        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) return false;

        const charInfo = getCharacterAtPoint(e.clientX, e.clientY);
        if (!charInfo || WHITESPACE_REGEX.test(charInfo.character)) {
            console.log('[TextLookup] No valid character found at point:', { x: e.clientX, y: e.clientY, charInfo });
            return false;
        }

        const lookupOffset = getLookupStartOffset(
            charInfo.node.textContent || '',
            charInfo.offset,
            settings.yomitanLanguage
        );
        const initialLookupRoot = getLookupRootNode(charInfo.node);
        const initialRootCharIndex = getRootCharIndex(initialLookupRoot, charInfo.node, lookupOffset);
        const initialBlockId = initialLookupRoot.nodeType === Node.ELEMENT_NODE
            ? (initialLookupRoot as Element).getAttribute('data-block-id')
            : null;

        const sentenceContext = getSentenceContext(charInfo.node, lookupOffset);
        if (!sentenceContext?.sentence.trim()) return false;

        const { sentence, byteOffset } = sentenceContext;

        // Use actual text position for popup, not click coordinates
        const popupX = charInfo.rect.left + charInfo.rect.width / 2;
        const popupY = charInfo.rect.top;

        setDictPopup({
            visible: true,
            x: popupX,
            y: popupY,
            results: [],
            kanjiResults: [],
            isLoading: true,
            systemLoading: false,
            highlight: {
                startChar: lookupOffset,
                length: 1,
                rects: [{
                    x: charInfo.rect.left,
                    y: charInfo.rect.top,
                    width: charInfo.rect.width,
                    height: charInfo.rect.height,
                }],
                source: { kind: 'ln' }
            },
            context: { sentence }
        });

        const results = await lookupYomitan(
            sentence,
            byteOffset,
            settings.resultGroupingMode || 'grouped',
            settings.yomitanLanguage
        );

        const loadedResults = results === 'loading' ? [] : ((results as any).terms || results || []);

        if (results === 'loading') {
            setDictPopup(prev => ({ ...prev, results: [], isLoading: false, systemLoading: true }));
            return true;
        }

        const matchLen = (loadedResults && loadedResults[0]?.matchLen) || 1;
        let highlightRects: Array<{ x: number; y: number; width: number; height: number }> = [];
        let highlightStartOffset = lookupOffset;

        try {
            const selection = window.getSelection();
            if (selection) {
                let startNode = charInfo.node;
                let traversalRoot = getLookupRootNode(startNode);

                if (!isNodeInDocument(startNode)) {
                    let liveRoot: Node | null = null;

                    if (initialBlockId) {
                        liveRoot = getBlockById(initialBlockId);
                    }
                    if (!liveRoot && isNodeInDocument(initialLookupRoot)) {
                        liveRoot = initialLookupRoot;
                    }
                    if (!liveRoot) {
                        const fallbackRoot = (e.target as HTMLElement | null)?.closest(LOOKUP_ROOT_SELECTOR);
                        if (fallbackRoot && isNodeInDocument(fallbackRoot)) {
                            liveRoot = fallbackRoot;
                        }
                    }

                    if (liveRoot && initialRootCharIndex !== null) {
                        const remapped = getNodeOffsetAtRootCharIndex(liveRoot, initialRootCharIndex);
                        if (remapped && isNodeInDocument(remapped.node)) {
                            startNode = remapped.node;
                            highlightStartOffset = remapped.offset;
                            traversalRoot = liveRoot;
                        }
                    }

                    if (!isNodeInDocument(startNode)) {
                        const startCharInfo = getCharacterAtPoint(e.clientX, e.clientY);
                        if (startCharInfo && isNodeInDocument(startCharInfo.node)) {
                            startNode = startCharInfo.node;
                            highlightStartOffset = getLookupStartOffset(
                                startCharInfo.node.textContent || '',
                                startCharInfo.offset,
                                settings.yomitanLanguage
                            );
                            traversalRoot = getLookupRootNode(startNode);
                        }
                    }
                }

                if (!isNodeInDocument(startNode)) {
                } else {

                const range = document.createRange();
                range.setStart(startNode, highlightStartOffset);

                // Find end node/offset for matchLen characters
                let remaining = matchLen;
                let endNode = startNode;
                let endOffset = highlightStartOffset;

                const walker = createVisibleTextWalker(traversalRoot);
                
                walker.currentNode = startNode;
                let currentNode: Node | null = walker.currentNode;
                let traversalSteps = 0;

                while (currentNode && remaining > 0) {
                    traversalSteps += 1;
                    const nodeText = currentNode.textContent || '';
                    const nodeStart = currentNode === startNode ? highlightStartOffset : 0;
                    const available = nodeText.length - nodeStart;

                    if (remaining <= available) {
                        endNode = currentNode;
                        endOffset = nodeStart + remaining;
                        break;
                    }
                    
                    remaining -= available;
                    const nextNode = walker.nextNode();
                    if (!nextNode) {
                        endNode = currentNode;
                        endOffset = nodeText.length;
                        break;
                    }
                    currentNode = nextNode;
                }

                range.setEnd(endNode, endOffset);
                highlightRects = getRectsFromRange(range);
                // Intentionally do not call selection.addRange(range) to avoid native blue selection flash.
                }
            }
        } catch (e) {
            // Ignore selection errors
        }

        const loadedKanji = (results as any).kanji || [];

        setDictPopup(prev => ({
            ...prev,
            results: loadedResults || [],
            kanjiResults: loadedKanji,
            isLoading: false,
            systemLoading: false,
            highlight: prev.highlight
                ? {
                    ...prev.highlight,
                    startChar: highlightStartOffset,
                    length: matchLen,
                    rects: highlightRects.length ? highlightRects : prev.highlight.rects,
                }
                : undefined
        }));

        return true;
    }, [settings.enableYomitan, settings.resultGroupingMode, settings.yomitanLanguage, getCharacterAtPoint, getSentenceContext, setDictPopup]);

    return {
        tryLookup,
        enabled: settings.enableYomitan,
        interactionMode: settings.interactionMode,
    };
}
