/**
 * Text lookup hook for dictionary integration in LN Reader
 */

import { useCallback } from 'react';
import { useOCR } from '@/Manatan/context/OCRContext';
import { lookupYomitan } from '@/Manatan/utils/api';

const BLOCK_TAGS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const SENTENCE_END_SET = new Set(['。', '！', '？', '；', '.', '!', '?', ';']);
const MAX_SENTENCE_LENGTH = 50;
const INTERACTIVE_SELECTORS = 'a, button, input, ruby rt, img, .nav-btn, .reader-progress, .reader-slider-wrap';
const WHITESPACE_REGEX = /\s/;

const textEncoder = new TextEncoder();

const getCaretRange = (x: number, y: number) => {
    const pos = (document as any).caretPositionFromPoint?.(x, y);
    if (pos) {
        const range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        return range;
    }
    return document.caretRangeFromPoint?.(x, y) ?? null;
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
        let currentNode: Node | null;

        while ((currentNode = walker.nextNode())) {
            if (currentNode === targetNode) {
                clickPosition = textParts.join('').length + targetOffset;
            }
            textParts.push(currentNode.textContent || '');
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

        const sentenceContext = getSentenceContext(charInfo.node, charInfo.offset);
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
            isLoading: true,
            systemLoading: false,
            highlight: {
                startChar: charInfo.offset,
                length: 1,
                rects: [],
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

        const matchLen = loadedResults?.[0]?.matchLen || 1;

        // TextBox approach: use selection for visual highlight (faster than rects)
        try {
            const selection = window.getSelection();
            if (selection) {
                const range = document.createRange();
                range.setStart(charInfo.node, charInfo.offset);

                // Find end node/offset for matchLen characters
                let remaining = matchLen;
                let currentNode: Node | null = charInfo.node;
                let endNode = charInfo.node;
                let endOffset = charInfo.offset;

                const walker = document.createTreeWalker(
                    charInfo.node.parentElement || document.body,
                    NodeFilter.SHOW_TEXT
                );
                while (walker.currentNode !== charInfo.node && walker.nextNode());

                while (currentNode && remaining > 0) {
                    const nodeText = currentNode.textContent || '';
                    const nodeStart = currentNode === charInfo.node ? charInfo.offset : 0;
                    const available = nodeText.length - nodeStart;

                    if (remaining <= available) {
                        endNode = currentNode;
                        endOffset = nodeStart + remaining;
                        break;
                    }
                    remaining -= available;
                    currentNode = walker.nextNode();
                    if (currentNode) {
                        endNode = currentNode;
                        endOffset = 0;
                    }
                }

                range.setEnd(endNode, endOffset);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        } catch (e) {
            // Ignore selection errors
        }

        const loadedKanji = results === 'loading' ? [] : ((results as any).kanji || []);

        setDictPopup(prev => ({
            ...prev,
            results: loadedResults || [],
            kanjiResults: loadedKanji,
            isLoading: false,
            systemLoading: false,
            highlight: prev.highlight ? { ...prev.highlight, length: matchLen } : undefined
        }));

        return true;
    }, [settings.enableYomitan, settings.resultGroupingMode, settings.yomitanLanguage, getCharacterAtPoint, getSentenceContext, setDictPopup]);

    return {
        tryLookup,
        enabled: settings.enableYomitan,
        interactionMode: settings.interactionMode,
    };
}
