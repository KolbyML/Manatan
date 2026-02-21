import { useEffect, useState, useCallback, useRef } from 'react';

interface Point {
    x: number;
    y: number;
}

interface TextPosition {
    node: Node;
    offset: number;
    rect: DOMRect;
}

interface SelectionHandlesProps {
    containerRef: React.RefObject<HTMLElement | null>;
    enabled?: boolean;
    theme?: 'light' | 'sepia' | 'dark' | 'black';
    onSelectionComplete?: (text: string, startOffset: number, endOffset: number, blockId: string) => void;
    onSelectionCancel?: () => void;
}

export const SelectionHandles: React.FC<SelectionHandlesProps> = ({
    containerRef,
    enabled = true,
    theme = 'dark',
    onSelectionComplete,
    onSelectionCancel,
}) => {
    const [isActive, setIsActive] = useState(false);
    const [startPos, setStartPos] = useState<TextPosition | null>(null);
    const [endPos, setEndPos] = useState<TextPosition | null>(null);
    const [highlightRects, setHighlightRects] = useState<DOMRect[]>([]);
    const currentTheme = theme;
    
    const isDraggingRef = useRef<'start' | 'end' | null>(null);
    const wasDraggingRef = useRef(false);
    const activeRangeRef = useRef<Range | null>(null);
    const containerRef2 = useRef(containerRef.current);

    useEffect(() => {
        containerRef2.current = containerRef.current;
    }, [containerRef]);

    const getTextPositionAtPoint = useCallback((x: number, y: number): TextPosition | null => {
        const container = containerRef2.current;
        if (!container) return null;

        let range: Range | null = null;

        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(x, y);
        } else if ((document as any).caretPositionFromPoint) {
            const pos = (document as any).caretPositionFromPoint(x, y);
            if (pos) {
                range = document.createRange();
                range.setStart(pos.offsetNode, pos.offset);
                range.collapse(true);
            }
        }

        if (!range) return null;
        if (!container.contains(range.startContainer)) return null;

        const rect = range.getBoundingClientRect();
        
        return {
            node: range.startContainer,
            offset: range.startOffset,
            rect: rect,
        };
    }, []);

    const calculateHighlightRects = useCallback((start: TextPosition, end: TextPosition): DOMRect[] => {
        try {
            const range = document.createRange();
            
            const comparison = start.node.compareDocumentPosition(end.node);
            
            if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) {
                range.setStart(start.node, start.offset);
                range.setEnd(end.node, end.offset);
            } else if (comparison & Node.DOCUMENT_POSITION_PRECEDING) {
                range.setStart(end.node, end.offset);
                range.setEnd(start.node, start.offset);
            } else {
                const startOffset = Math.min(start.offset, end.offset);
                const endOffset = Math.max(start.offset, end.offset);
                range.setStart(start.node, startOffset);
                range.setEnd(end.node, endOffset);
            }

            activeRangeRef.current = range;
            
            const clientRects = range.getClientRects();
            return Array.from(clientRects);
        } catch {
            return [];
        }
    }, []);

    const handleDrag = useCallback((clientX: number, clientY: number, handleType: 'start' | 'end') => {
        const newPos = getTextPositionAtPoint(clientX, clientY);
        if (!newPos) return;

        if (handleType === 'start') {
            setStartPos(newPos);
            if (endPos) {
                const rects = calculateHighlightRects(newPos, endPos);
                setHighlightRects(rects);
            }
        } else {
            setEndPos(newPos);
            if (startPos) {
                const rects = calculateHighlightRects(startPos, newPos);
                setHighlightRects(rects);
            }
        }
    }, [startPos, endPos, getTextPositionAtPoint, calculateHighlightRects]);

    const startDrag = useCallback((handleType: 'start' | 'end', e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        isDraggingRef.current = handleType;

        const onMove = (moveEvent: MouseEvent | TouchEvent) => {
            moveEvent.preventDefault();
            
            let clientX: number, clientY: number;
            if ('touches' in moveEvent) {
                if (moveEvent.touches.length === 0) return;
                clientX = moveEvent.touches[0].clientX;
                clientY = moveEvent.touches[0].clientY;
            } else {
                clientX = moveEvent.clientX;
                clientY = moveEvent.clientY;
            }

            handleDrag(clientX, clientY, handleType);
        };

        const onEnd = () => {
            if (isDraggingRef.current) {
                wasDraggingRef.current = true;
                setTimeout(() => { wasDraggingRef.current = false; }, 100);
            }
            isDraggingRef.current = null;
            
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        };

        if ('touches' in e) {
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);
        } else {
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);
        }
    }, [handleDrag]);

    const expandToSentenceBoundaries = (pos: TextPosition): Range | null => {
        try {
            const textNode = pos.node;
            const text = textNode.textContent || '';
            
            if (text.length === 0) return null;

            const isCJK = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);
            
            let start = pos.offset;
            let end = pos.offset;

            if (isCJK) {
                const cjkEndPunct = /[。！？．?!]/;
                
                while (start > 0) {
                    const char = text[start - 1];
                    if (cjkEndPunct.test(char)) break;
                    start--;
                }
                
                while (end < text.length) {
                    const char = text[end];
                    if (cjkEndPunct.test(char)) {
                        end++;
                        break;
                    }
                    end++;
                }

                if (start === end) {
                    start = Math.max(0, pos.offset - 1);
                    end = Math.min(text.length, pos.offset + 1);
                }
            } else {
                const sentenceEnd = /[.!?。！？]/;
                
                while (start > 0) {
                    if (sentenceEnd.test(text[start - 1])) break;
                    start--;
                }
                
                while (end < text.length) {
                    if (sentenceEnd.test(text[end])) {
                        end++;
                        break;
                    }
                    end++;
                }

                if (start === end) {
                    const wordBoundaryRegex = /\b/;
                    start = pos.offset;
                    end = pos.offset;
                    
                    while (start > 0 && !wordBoundaryRegex.test(text[start - 1])) start--;
                    while (end < text.length && !wordBoundaryRegex.test(text[end])) end++;

                    if (start === end) {
                        while (end < text.length && wordBoundaryRegex.test(text[end])) end++;
                        while (end < text.length && !wordBoundaryRegex.test(text[end])) end++;
                    }
                }
            }

            if (start >= end) {
                start = Math.max(0, pos.offset - 1);
                end = Math.min(text.length, pos.offset + 1);
            }

            const range = document.createRange();
            range.setStart(textNode, start);
            range.setEnd(textNode, Math.min(end, text.length));

            return range;
        } catch {
            return null;
        }
    };

    const initializeSelection = useCallback((clientX: number, clientY: number) => {
        const container = containerRef2.current;
        if (!container || !enabled) return false;

        const pos = getTextPositionAtPoint(clientX, clientY);
        if (!pos) return false;

        if (window.getSelection()) {
            window.getSelection()?.removeAllRanges();
        }

        const expandedRange = expandToSentenceBoundaries(pos);
        
        if (!expandedRange) {
            const range = document.createRange();
            range.setStart(pos.node, pos.offset);
            range.setEnd(pos.node, Math.min(pos.offset + 1, pos.node.textContent?.length || 0));
            
            const startRect = range.getBoundingClientRect();
            const endRect = range.getBoundingClientRect();
            
            setStartPos({ node: range.startContainer, offset: range.startOffset, rect: startRect });
            setEndPos({ node: range.endContainer, offset: range.endOffset, rect: endRect });
            setHighlightRects([startRect]);
            activeRangeRef.current = range;
        } else {
            const startRect = expandedRange.getBoundingClientRect();
            const endRect = expandedRange.getBoundingClientRect();
            
            setStartPos({ 
                node: expandedRange.startContainer, 
                offset: expandedRange.startOffset, 
                rect: startRect 
            });
            setEndPos({ 
                node: expandedRange.endContainer, 
                offset: expandedRange.endOffset, 
                rect: endRect 
            });
            
            const rects = Array.from(expandedRange.getClientRects());
            setHighlightRects(rects);
            activeRangeRef.current = expandedRange;
        }

        setIsActive(true);
        return true;
    }, [enabled, getTextPositionAtPoint]);

    const completeSelection = useCallback(() => {
        if (!activeRangeRef.current || !onSelectionComplete) {
            cancel();
            return;
        }

        const range = activeRangeRef.current;
        const text = range.toString().trim();
        
        if (!text || text.length < 1) {
            cancel();
            return;
        }

        const container = containerRef2.current;
        if (!container) {
            cancel();
            return;
        }

        let blockId = '';
        let blockEl: Element | null = range.startContainer.parentElement;
        while (blockEl && !blockEl.hasAttribute('data-block-id')) {
            blockEl = blockEl.parentElement;
        }
        if (blockEl) {
            blockId = blockEl.getAttribute('data-block-id') || '';
        }

        const preRange = document.createRange();
        preRange.selectNodeContents(container);
        preRange.setEnd(range.startContainer, range.startOffset);
        const startOffset = preRange.toString().length;
        const endOffset = startOffset + text.length;

        onSelectionComplete(text, startOffset, endOffset, blockId);
        cancel();
    }, [onSelectionComplete]);

    const cancel = useCallback(() => {
        setIsActive(false);
        setStartPos(null);
        setEndPos(null);
        setHighlightRects([]);
        activeRangeRef.current = null;
        isDraggingRef.current = null;
        onSelectionCancel?.();
    }, [onSelectionCancel]);

    useEffect(() => {
        const container = containerRef2.current;
        if (!container || !enabled) return;

        let longPressTimer: number | null = null;
        let touchStartPos: Point | null = null;

        const onTouchStart = (e: TouchEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, a, .nav-btn, .dict-popup, .selection-handle')) return;
            
            if (isActive) return;

            touchStartPos = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
            };

            longPressTimer = window.setTimeout(() => {
                if (touchStartPos) {
                    const success = initializeSelection(touchStartPos.x, touchStartPos.y);
                    if (success && navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                }
            }, 500);
        };

        const onTouchMove = (e: TouchEvent) => {
            if (!touchStartPos) return;
            
            const dx = Math.abs(e.touches[0].clientX - touchStartPos.x);
            const dy = Math.abs(e.touches[0].clientY - touchStartPos.y);
            
            if (dx > 10 || dy > 10) {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                touchStartPos = null;
            }
        };

        const onTouchEnd = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            touchStartPos = null;
        };

        const onContextMenu = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, a, img, .nav-btn')) return;
            
            e.preventDefault();
            initializeSelection(e.clientX, e.clientY);
        };

        container.addEventListener('touchstart', onTouchStart, { passive: true });
        container.addEventListener('touchmove', onTouchMove, { passive: true });
        container.addEventListener('touchend', onTouchEnd);
        container.addEventListener('contextmenu', onContextMenu);

        return () => {
            if (longPressTimer) clearTimeout(longPressTimer);
            container.removeEventListener('touchstart', onTouchStart);
            container.removeEventListener('touchmove', onTouchMove);
            container.removeEventListener('touchend', onTouchEnd);
            container.removeEventListener('contextmenu', onContextMenu);
        };
    }, [enabled, isActive, initializeSelection]);

    useEffect(() => {
        if (!isActive) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (isDraggingRef.current || wasDraggingRef.current) return;
            
            const target = e.target as HTMLElement;
            const isToolbar = target.closest('.selection-toolbar');
            const isHandle = target.closest('.selection-handle');
            if (!isToolbar && !isHandle) {
                cancel();
            }
        };

        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);

        return () => document.removeEventListener('click', handleClickOutside);
    }, [isActive, cancel]);

    if (!isActive || highlightRects.length === 0) {
        return null;
    }

    const firstRect = highlightRects[0];
    const lastRect = highlightRects[highlightRects.length - 1];

    const startHandleStyle = {
        left: firstRect.left,
        top: firstRect.top,
    };

    const endHandleStyle = {
        left: lastRect.right,
        top: lastRect.bottom,
    };

    // Toolbar positioned beside the text (to the right)
    const toolbarHeight = 90;
    const toolbarWidth = 140;
    const toolbarX = lastRect.right + 15;
    let toolbarY = (firstRect.top + lastRect.bottom) / 2 - toolbarHeight / 2;

    // Y collision detection
    if (toolbarY < 10) {
        toolbarY = 10;
    } else if (toolbarY + toolbarHeight > window.innerHeight - 10) {
        toolbarY = window.innerHeight - toolbarHeight - 10;
    }

    // X collision detection - prefer right side
    let adjustedX = toolbarX;
    if (toolbarX + toolbarWidth > window.innerWidth - 10) {
        adjustedX = firstRect.left - toolbarWidth - 15;
    }
    if (adjustedX < 10) {
        adjustedX = 10;
    }

    // Theme-based colors
    const themeColors = {
        light: { bg: 'rgba(255, 255, 255, 0.95)', text: '#333333', highlight: '#FFEB3B', copy: '#2196F3', handle: '#2196F3', handleGlow: 'rgba(33, 150, 243, 0.4)' },
        sepia: { bg: 'rgba(60, 50, 40, 0.95)', text: '#f4ecd8', highlight: '#FFD54F', copy: '#81D4FA', handle: '#FFD54F', handleGlow: 'rgba(255, 213, 79, 0.4)' },
        dark: { bg: 'rgba(30, 30, 30, 0.95)', text: '#e0e0e0', highlight: '#FFEB3B', copy: '#64B5F6', handle: '#FFEB3B', handleGlow: 'rgba(255, 235, 59, 0.4)' },
        black: { bg: 'rgba(20, 20, 20, 0.95)', text: '#ffffff', highlight: '#FFEB3B', copy: '#64B5F6', handle: '#FFEB3B', handleGlow: 'rgba(255, 235, 59, 0.4)' },
    };
    const colors = themeColors[currentTheme] || themeColors.dark;

    return (
        <>
            {highlightRects.map((rect, index) => (
                <div
                    key={index}
                    className="selection-overlay"
                    style={{
                        position: 'fixed',
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        backgroundColor: 'rgba(0, 120, 215, 0.4)',
                        pointerEvents: 'none',
                        zIndex: 1000,
                    }}
                />
            ))}

            <div
                className="selection-handle start"
                style={{
                    position: 'fixed',
                    left: startHandleStyle.left,
                    top: startHandleStyle.top,
                    width: 28,
                    height: 28,
                    transform: 'translate(-50%, -50%)',
                    background: `linear-gradient(135deg, ${colors.handle} 0%, ${colors.handle}dd 100%)`,
                    borderRadius: '50%',
                    border: '3px solid white',
                    boxShadow: `0 0 12px ${colors.handleGlow}, 0 2px 8px rgba(0,0,0,0.3)`,
                    cursor: 'grab',
                    touchAction: 'none',
                    zIndex: 1001,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                onMouseDown={(e) => startDrag('start', e)}
                onTouchStart={(e) => startDrag('start', e)}
            >
                <div style={{ width: 8, height: 8, backgroundColor: 'white', borderRadius: '50%', opacity: 0.8 }} />
            </div>

            <div
                className="selection-handle end"
                style={{
                    position: 'fixed',
                    left: endHandleStyle.left,
                    top: endHandleStyle.top,
                    width: 28,
                    height: 28,
                    transform: 'translate(-50%, -50%)',
                    background: `linear-gradient(135deg, ${colors.handle} 0%, ${colors.handle}dd 100%)`,
                    borderRadius: '50%',
                    border: '3px solid white',
                    boxShadow: `0 0 12px ${colors.handleGlow}, 0 2px 8px rgba(0,0,0,0.3)`,
                    cursor: 'grab',
                    touchAction: 'none',
                    zIndex: 1001,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                onMouseDown={(e) => startDrag('end', e)}
                onTouchStart={(e) => startDrag('end', e)}
            >
                <div style={{ width: 8, height: 8, backgroundColor: 'white', borderRadius: '50%', opacity: 0.8 }} />
            </div>

            <div
                className="selection-toolbar"
                style={{
                    position: 'fixed',
                    left: adjustedX,
                    top: toolbarY,
                    backgroundColor: colors.bg,
                    borderRadius: 8,
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    zIndex: 1002,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    minWidth: '140px',
                }}
            >
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        completeSelection();
                    }}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 4,
                        padding: '8px 12px',
                        fontSize: '13px',
                        color: colors.text,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                        (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.1)';
                    }}
                    onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                    }}
                >
                    <span style={{ color: colors.highlight }}>●</span>
                    Highlight
                </button>
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const text = activeRangeRef.current?.toString() || '';
                        if (text) {
                            navigator.clipboard.writeText(text);
                        }
                        cancel();
                    }}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 4,
                        padding: '8px 12px',
                        fontSize: '13px',
                        color: colors.text,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                        (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.1)';
                    }}
                    onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                    }}
                >
                    <span>📋</span>
                    Copy
                </button>
            </div>
        </>
    );
};
