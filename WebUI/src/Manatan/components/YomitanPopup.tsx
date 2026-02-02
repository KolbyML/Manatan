import React, { useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOCR } from '@/Manatan/context/OCRContext';
import { cleanPunctuation, lookupYomitan } from '@/Manatan/utils/api';
import { DictionaryResult } from '@/Manatan/types';
import { DictionaryView } from '@/Manatan/components/DictionaryView';

const HighlightOverlay = () => {
    const { dictPopup } = useOCR();
    if (!dictPopup.visible || !dictPopup.highlight?.rects) return null;

    return (
        <div
            className="dictionary-highlight-overlay"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 2147483645
            }}
        >
            {dictPopup.highlight.rects.map((rect, i) => (
                <div
                    key={i}
                    style={{
                        position: 'fixed',
                        left: rect.x,
                        top: rect.y,
                        width: rect.width,
                        height: rect.height,
                        backgroundColor: 'rgba(255, 255, 0, 0.3)',
                        borderRadius: '2px',
                        borderBottom: '2px solid rgba(255, 215, 0, 0.8)',
                    }}
                />
            ))}
        </div>
    );
};

export const YomitanPopup = () => {
    const { dictPopup, setDictPopup, notifyPopupClosed } = useOCR();
    const popupRef = useRef<HTMLDivElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const [posStyle, setPosStyle] = React.useState<React.CSSProperties>({});

    const processedEntries = dictPopup.results;

    const handleDefinitionLink = useCallback(async (href: string, text: string) => {
        // Extract lookup text from href
        const safeFallback = text.trim();
        const trimmedHref = href.trim();
        let lookupText = safeFallback;

        if (trimmedHref) {
            const extractQuery = (params: URLSearchParams) =>
                params.get('query') || params.get('text') || params.get('term') || params.get('q') || '';

            if (trimmedHref.startsWith('http://') || trimmedHref.startsWith('https://')) {
                try {
                    const parsed = new URL(trimmedHref);
                    const queryText = extractQuery(parsed.searchParams);
                    if (queryText) lookupText = queryText;
                } catch (err) {
                    console.warn('Failed to parse http link', err);
                }
            } else if (trimmedHref.startsWith('?') || trimmedHref.includes('?')) {
                const queryString = trimmedHref.startsWith('?')
                    ? trimmedHref.slice(1)
                    : trimmedHref.slice(trimmedHref.indexOf('?') + 1);
                const params = new URLSearchParams(queryString);
                const queryText = extractQuery(params);
                if (queryText) lookupText = queryText;
            } else if (trimmedHref.startsWith('term://')) {
                lookupText = decodeURIComponent(trimmedHref.slice('term://'.length));
            } else if (trimmedHref.startsWith('yomitan://')) {
                try {
                    const parsed = new URL(trimmedHref);
                    const queryText = extractQuery(parsed.searchParams);
                    if (queryText) lookupText = queryText;
                    else lookupText = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
                } catch (err) {
                    console.warn('Failed to parse yomitan link', err);
                }
            } else {
                try {
                    lookupText = decodeURIComponent(trimmedHref);
                } catch (err) {
                    lookupText = safeFallback || trimmedHref;
                }
            }
        }

        const cleanText = cleanPunctuation(lookupText, true).trim();
        if (!cleanText) return;

        setDictPopup((prev) => ({
            ...prev,
            visible: true,
            results: [],
            isLoading: true,
            systemLoading: false,
            highlight: prev.highlight,
        }));

        try {
            const results = await lookupYomitan(cleanText, 0, 'group', 'japanese');
            if (results === 'loading') {
                setDictPopup((prev) => ({
                    ...prev,
                    results: [],
                    isLoading: false,
                    systemLoading: true,
                    highlight: prev.highlight,
                }));
                return;
            }
            setDictPopup((prev) => ({
                ...prev,
                results: results || [],
                isLoading: false,
                systemLoading: false,
                highlight: prev.highlight,
            }));
        } catch (err) {
            console.warn('Failed to lookup link definition', err);
            setDictPopup((prev) => ({
                ...prev,
                results: [],
                isLoading: false,
                systemLoading: false,
                highlight: prev.highlight,
            }));
        }
    }, [setDictPopup]);

    useLayoutEffect(() => {
        if (!dictPopup.visible) return;

        const visualViewport = window.visualViewport;
        const viewport = visualViewport
            ? {
                left: visualViewport.offsetLeft,
                top: visualViewport.offsetTop,
                right: visualViewport.offsetLeft + visualViewport.width,
                bottom: visualViewport.offsetTop + visualViewport.height,
            }
            : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };

        const GAP = 10;
        const DEFAULT_WIDTH = 340;
        const MAX_HEIGHT = 450;

        const popupEl = popupRef.current;
        const popupWidth = popupEl?.offsetWidth || DEFAULT_WIDTH;
        const measuredHeight = popupEl?.offsetHeight || 0;
        const maxHeight = Math.min(MAX_HEIGHT, Math.max(120, viewport.bottom - viewport.top - GAP * 2));
        const popupHeight = measuredHeight > 0 ? Math.min(measuredHeight, maxHeight) : maxHeight;

        const selectionRects = (() => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
                return [];
            }
            const range = selection.getRangeAt(0);
            return Array.from(range.getClientRects())
                .map((rect) => ({ x: rect.left, y: rect.top, width: rect.width, height: rect.height }))
                .filter((rect) => rect.width > 0 && rect.height > 0);
        })();

        const sourceRects = dictPopup.highlight?.rects?.length
            ? dictPopup.highlight.rects
            : selectionRects;

        const fallbackRect = { x: dictPopup.x, y: dictPopup.y, width: 1, height: 1 };
        const rects = sourceRects.length ? sourceRects : [fallbackRect];

        let left = rects[0].x;
        let top = rects[0].y;
        let right = rects[0].x + rects[0].width;
        let bottom = rects[0].y + rects[0].height;
        for (let i = 1; i < rects.length; i += 1) {
            const rect = rects[i];
            left = Math.min(left, rect.x);
            top = Math.min(top, rect.y);
            right = Math.max(right, rect.x + rect.width);
            bottom = Math.max(bottom, rect.y + rect.height);
        }

        const rightSpace = viewport.right - right - GAP;
        const leftSpace = left - viewport.left - GAP;
        const aboveSpace = top - viewport.top - GAP;
        const belowSpace = viewport.bottom - bottom - GAP;

        const clamp = (value: number, min: number, max: number) => {
            if (max < min) return min;
            return Math.min(Math.max(value, min), max);
        };

        let finalLeft: number;
        let finalTop: number;

        if (rightSpace >= popupWidth) {
            finalLeft = right + GAP;
            finalTop = top;
        } else if (leftSpace >= popupWidth) {
            finalLeft = left - GAP - popupWidth;
            finalTop = top;
        } else {
            const placeBelow = belowSpace >= popupHeight || belowSpace >= aboveSpace;
            finalTop = placeBelow ? bottom + GAP : top - GAP - popupHeight;
            finalLeft = left;
        }

        finalLeft = clamp(finalLeft, viewport.left + GAP, viewport.right - popupWidth - GAP);
        finalTop = clamp(finalTop, viewport.top + GAP, viewport.bottom - popupHeight - GAP);

        setPosStyle({ top: finalTop, left: finalLeft, maxHeight: `${maxHeight}px` });
    }, [dictPopup.visible, dictPopup.x, dictPopup.y, dictPopup.highlight]);

    useLayoutEffect(() => {
        const el = backdropRef.current;
        if (!el || !dictPopup.visible) return;

        const closePopup = () => {
            notifyPopupClosed();
            setDictPopup(prev => ({ ...prev, visible: false }));
        };

        const onTouchStart = (e: TouchEvent) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
        };

        const onTouchEnd = (e: TouchEvent) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            closePopup();
        };

        const onClick = (e: MouseEvent) => {
            e.stopPropagation();
            closePopup();
        };

        const onBlock = (e: Event) => e.stopPropagation();

        const opts = { passive: false };

        el.addEventListener('touchstart', onTouchStart, opts);
        el.addEventListener('touchend', onTouchEnd, opts);
        el.addEventListener('click', onClick, opts);
        el.addEventListener('mousedown', onBlock, opts);
        el.addEventListener('contextmenu', onClick, opts);

        return () => {
            el.removeEventListener('touchstart', onTouchStart, opts as any);
            el.removeEventListener('touchend', onTouchEnd, opts as any);
            el.removeEventListener('click', onClick, opts as any);
            el.removeEventListener('mousedown', onBlock, opts as any);
            el.removeEventListener('contextmenu', onClick, opts as any);
        };
    }, [dictPopup.visible, setDictPopup, notifyPopupClosed]);

    if (!dictPopup.visible) return null;

    const popupStyle: React.CSSProperties = {
        position: 'fixed', zIndex: 2147483647, width: '340px', overflowY: 'auto',
        backgroundColor: '#1a1d21', color: '#eee', border: '1px solid #444',
        borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        padding: '16px', fontFamily: 'sans-serif', fontSize: '14px', lineHeight: '1.5',
        ...posStyle
    };

    return createPortal(
        <>
            <HighlightOverlay />
            <div
                ref={backdropRef}
                className="yomitan-backdrop"
                style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 2147483646,
                    cursor: 'default',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    touchAction: 'none',
                }}
            />

            <div
                ref={popupRef}
                className="yomitan-popup"
                style={popupStyle}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                onWheel={e => e.stopPropagation()}
            >
                <DictionaryView
                    results={processedEntries}
                    isLoading={dictPopup.isLoading}
                    systemLoading={dictPopup.systemLoading}
                    onLinkClick={handleDefinitionLink}
                    context={dictPopup.context}
                />
            </div>
        </>,
        document.body
    );
};