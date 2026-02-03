/**
 * Text lookup hook for dictionary integration in LN Reader
 */

import { useCallback } from 'react';
import { useOCR } from '@/Manatan/context/OCRContext';
import { lookupYomitan } from '@/Manatan/utils/api';
import { Rect } from '@/Manatan/types';

export function useTextLookup() {
    const { settings, setDictPopup } = useOCR();

    const getCharacterAtPoint = useCallback((x: number, y: number): {
        node: Node;
        offset: number;
        character: string; 
    } | null => {
        let range: Range | null = null;

        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(x, y);
        } else if ((document as any).caretPositionFromPoint) {
            const pos = (document as any).caretPositionFromPoint(x, y);
            if (pos) {
                range = document.createRange();
                range.setStart(pos.offsetNode, pos.offset);
            }
        }

        if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) {
            return null;
        }

        const node = range.startContainer;
        const textLen = node.textContent?.length || 0;

        if (textLen === 0) return null;

        // Build candidates
        let offset = range.startOffset;
        const candidates: number[] = [];

        if (offset > 0) candidates.push(offset - 1);
        if (offset < textLen) candidates.push(offset);
        if (offset + 1 < textLen) candidates.push(offset + 1);
        if (candidates.length === 0) candidates.push(0);

        let bestOffset: number | null = null;
        let bestDistance = Infinity;

        const MARGIN_X = 40;
        const MARGIN_Y = 50;

        for (const candidateOffset of candidates) {
            try {
                const charRange = document.createRange();
                charRange.setStart(node, candidateOffset);
                charRange.setEnd(node, candidateOffset + 1);
                const rect = charRange.getBoundingClientRect();

                const insideX = x >= rect.left - MARGIN_X && x <= rect.right + MARGIN_X;
                const insideY = y >= rect.top - MARGIN_Y && y <= rect.bottom + MARGIN_Y;

                if (!insideX || !insideY) continue;

                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const distance = Math.sqrt(
                    Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
                );

                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestOffset = candidateOffset;
                }
            } catch (err) {
                // Ignore
            }
        }

        if (bestOffset === null) return null;

        const character = node.textContent?.[bestOffset] || '';

        return { node, offset: bestOffset, character };
    }, []);

    const getSentenceContext = useCallback((
        targetNode: Node,
        targetOffset: number
    ): { sentence: string; byteOffset: number } | null => {

        // Find block element
        let contextElement: Element | null = targetNode.parentElement;
        const BLOCK_TAGS = ['P', 'DIV', 'SECTION', 'ARTICLE', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

        while (contextElement && contextElement.parentElement && !BLOCK_TAGS.includes(contextElement.tagName)) {
            contextElement = contextElement.parentElement;
        }

        if (!contextElement) {
            const text = targetNode.textContent || '';
            const encoder = new TextEncoder();
            const prefix = text.substring(0, targetOffset);
            return { sentence: text, byteOffset: encoder.encode(prefix).length };
        }

        // Single pass: build text + track position
        const walker = document.createTreeWalker(
            contextElement,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (node.parentElement?.closest('rt, rp')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let fullText = '';
        let clickPosition: number | null = null;
        let currentNode: Node | null;

        while ((currentNode = walker.nextNode())) {
            const nodeText = currentNode.textContent || '';

            // Mark position BEFORE adding text
            if (currentNode === targetNode) {
                clickPosition = fullText.length + targetOffset;
            }

            fullText += nodeText;
        }

        if (clickPosition === null) {
            console.warn('❌ Target node not found in walker');
            const text = targetNode.textContent || '';
            const encoder = new TextEncoder();
            const prefix = text.substring(0, targetOffset);
            return { sentence: text, byteOffset: encoder.encode(prefix).length };
        }

        console.log(`📝 Full text (${fullText.length} chars): "${fullText}"`);
        console.log(`👆 Clicked character: "${fullText[clickPosition]}"`);

        // Find sentence boundaries
        const SENTENCE_END = '。！？.!?';
        let start = 0;
        let end = fullText.length;

        for (let i = clickPosition - 1; i >= 0; i--) {
            if (SENTENCE_END.includes(fullText[i])) {
                start = i + 1;
                break;
            }
        }

        for (let i = clickPosition; i < fullText.length; i++) {
            if (SENTENCE_END.includes(fullText[i])) {
                end = i + 1;
                break;
            }
        }

        // Extract and trim
        const sentenceRaw = fullText.substring(start, end);
        const leadingSpaces = sentenceRaw.length - sentenceRaw.trimStart().length;
        const sentence = sentenceRaw.trim();

        const posInSentence = clickPosition - start - leadingSpaces;



        // Convert to byte offset
        const encoder = new TextEncoder();
        const prefix = sentence.substring(0, Math.max(0, posInSentence));
        const byteOffset = encoder.encode(prefix).length;


        return { sentence, byteOffset };
    }, []);
    /**
     * Attempt to lookup text at click position
     * @returns true if lookup was triggered, false if clicked on empty space
     */
    const tryLookup = useCallback(async (e: React.MouseEvent): Promise<boolean> => {
        if (!settings.enableYomitan) return false;

        // Don't lookup if clicking on interactive elements
        const target = e.target as HTMLElement;
        if (target.closest('a, button, input, ruby rt, img, .nav-btn, .reader-progress, .reader-slider-wrap')) {
            return false;
        }

        // Check for existing text selection
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) return false;

        // Try to get character at click point
        const charInfo = getCharacterAtPoint(e.clientX, e.clientY);
        if (!charInfo) return false;

        // Check if we actually clicked on text (not whitespace)
        const text = charInfo.node.textContent || '';
        if (!text.trim()) return false;

        // Check if the character at offset is whitespace
        const charAtOffset = text[charInfo.offset];
        if (!charAtOffset || /\s/.test(charAtOffset)) return false;

        const sentenceContext = getSentenceContext(charInfo.node, charInfo.offset);
        if (!sentenceContext) return false;
        const { sentence, byteOffset } = sentenceContext;

        if (!sentence.trim()) return false;

        // Calculate Initial Highlight Rect (Length 1)
        let initialRects: Rect[] = [];
        try {
            const range = document.createRange();
            range.setStart(charInfo.node, charInfo.offset);
            range.setEnd(charInfo.node, Math.min(charInfo.node.textContent?.length || 0, charInfo.offset + 1));
            const clientRects = range.getClientRects();
            initialRects = Array.from(clientRects).map(r => ({
                x: r.left, y: r.top, width: r.width, height: r.height
            }));
        } catch (e) { }

        // Show loading state with initial highlight
        setDictPopup({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            results: [],
            isLoading: true,
            systemLoading: false,
            highlight: {
                startChar: charInfo.offset,
                length: 1,
                rects: initialRects,
                source: { kind: 'ln' }
            },
            context: { sentence }
        });

        // Perform lookup
        const results = await lookupYomitan(
            sentence,
            byteOffset,
            settings.resultGroupingMode || 'grouped',
            settings.yomitanLanguage
        );

        if (results === 'loading') {
            setDictPopup(prev => ({
                ...prev,
                results: [],
                isLoading: false,
                systemLoading: true
            }));
        } else {
            // Calculate Highlight Rects
            let rects: Rect[] = [];
            const matchLen = (results && results[0]?.matchLen) || 1;

            try {
                const highlightRange = document.createRange();
                highlightRange.setStart(charInfo.node, charInfo.offset);

                // Traverse text nodes to find word end that spans MatchLen chars
                const contextElement = charInfo.node.parentElement || document.body;
                const walker = document.createTreeWalker(contextElement, NodeFilter.SHOW_TEXT);

                // Move walker to current node
                while (walker.nextNode() && walker.currentNode !== charInfo.node);

                let remaining = matchLen;
                let endNode = charInfo.node;
                let endOffset = charInfo.offset;

                let currentNode: Node | null = charInfo.node;
                while (currentNode && remaining > 0) {
                    const nodeText = currentNode.textContent || '';
                    const availableInNode = nodeText.length - (currentNode === charInfo.node ? charInfo.offset : 0);

                    if (remaining <= availableInNode) {
                        endNode = currentNode;
                        endOffset = (currentNode === charInfo.node ? charInfo.offset : 0) + remaining;
                        remaining = 0;
                    } else {
                        remaining -= availableInNode;
                        currentNode = walker.nextNode();
                        if (currentNode) {
                            endNode = currentNode;
                            endOffset = currentNode.textContent?.length || 0;
                        }
                    }
                }

                highlightRange.setEnd(endNode, endOffset);

                const clientRects = highlightRange.getClientRects();
                rects = Array.from(clientRects).map(r => ({
                    x: r.left,
                    y: r.top,
                    width: r.width,
                    height: r.height
                }));
            } catch (err) {
                console.error("Failed to calculate highlight rects", err);
            }

            setDictPopup(prev => ({
                ...prev,
                results: results || [],
                isLoading: false,
                systemLoading: false,
                highlight: prev.highlight ? {
                    ...prev.highlight,
                    length: matchLen,
                    rects
                } : undefined
            }));
        }

        return true; // Lookup was triggered
    }, [settings.enableYomitan, settings.resultGroupingMode, getCharacterAtPoint, getSentenceContext, setDictPopup]);

    return {
        tryLookup,
        enabled: settings.enableYomitan,
        interactionMode: settings.interactionMode,
    };
}
