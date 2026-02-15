import React, { useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOCR } from '@/Manatan/context/OCRContext';
import { cleanPunctuation, lookupYomitan } from '@/Manatan/utils/api';
import { DictionaryView } from '@/Manatan/components/DictionaryView';

const POPUP_GAP = 10;
const POPUP_MIN_WIDTH_PX = 280;
const POPUP_MAX_WIDTH_PX = 1920;
const POPUP_MIN_HEIGHT_PX = 200;
const POPUP_MAX_HEIGHT_PX = 1080;

const isRTL = (text: string): boolean => {
    const rtlRegex = /[\u0591-\u07FF\u200f\u202b\u202e\uFB1D-\uFDFD\uFE70-\uFEFC]/;
    return rtlRegex.test(text);
};

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
    const { dictPopup, setDictPopup, notifyPopupClosed, settings } = useOCR();
    const popupRef = useRef<HTMLDivElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const [posStyle, setPosStyle] = React.useState<React.CSSProperties>({});

    const popupWidthPxRaw = Number.isFinite(settings.yomitanPopupWidthPx)
        ? settings.yomitanPopupWidthPx
        : 340;
    const popupHeightPxRaw = Number.isFinite(settings.yomitanPopupHeightPx)
        ? settings.yomitanPopupHeightPx
        : 450;
    const popupScaleRaw = Number.isFinite(settings.yomitanPopupScalePercent)
        ? settings.yomitanPopupScalePercent
        : 100;
    const popupScalePercent = Math.min(Math.max(popupScaleRaw, 50), 200);
    const popupScale = popupScalePercent / 100;
    const popupWidthPx = Math.min(Math.max(popupWidthPxRaw, POPUP_MIN_WIDTH_PX), POPUP_MAX_WIDTH_PX);
    const popupHeightPx = Math.min(Math.max(popupHeightPxRaw, POPUP_MIN_HEIGHT_PX), POPUP_MAX_HEIGHT_PX);
    const popupWidthStyle = `${popupWidthPx}px`;

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
            const results = await lookupYomitan(cleanText, 0, 'grouped', 'japanese');
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

        const popupEl = popupRef.current;
        const viewportWidth = viewport.right - viewport.left;
        const viewportHeight = viewport.bottom - viewport.top;
        const maxWidthBase = Math.max(POPUP_MIN_WIDTH_PX, (viewportWidth - POPUP_GAP * 2) / popupScale);
        const baseWidth = Math.min(popupWidthPx, maxWidthBase);
        const maxHeightViewport = Math.max(120, (viewportHeight - POPUP_GAP * 2) / popupScale);
        const baseMaxHeight = Math.min(popupHeightPx, maxHeightViewport);
        const popupWidth = popupEl?.offsetWidth || baseWidth;
        const measuredHeight = popupEl?.offsetHeight || 0;
        const popupHeight = measuredHeight > 0 ? Math.min(measuredHeight, baseMaxHeight) : baseMaxHeight;
        const popupWidthScaled = popupWidth * popupScale;
        const popupHeightScaled = popupHeight * popupScale;

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

        const rightSpace = viewport.right - right - POPUP_GAP;
        const leftSpace = left - viewport.left - POPUP_GAP;
        const aboveSpace = top - viewport.top - POPUP_GAP;
        const belowSpace = viewport.bottom - bottom - POPUP_GAP;

        const clamp = (value: number, min: number, max: number) => {
            if (max < min) return min;
            return Math.min(Math.max(value, min), max);
        };

        let finalLeft: number;
        let finalTop: number;

        if (rightSpace >= popupWidthScaled) {
            finalLeft = right + POPUP_GAP;
            finalTop = top;
        } else if (leftSpace >= popupWidthScaled) {
            finalLeft = left - POPUP_GAP - popupWidthScaled;
            finalTop = top;
        } else {
            const placeBelow = belowSpace >= popupHeightScaled || belowSpace >= aboveSpace;
            finalTop = placeBelow ? bottom + POPUP_GAP : top - POPUP_GAP - popupHeightScaled;
            finalLeft = left;
        }

        finalLeft = clamp(finalLeft, viewport.left + POPUP_GAP, viewport.right - popupWidthScaled - POPUP_GAP);
        finalTop = clamp(finalTop, viewport.top + POPUP_GAP, viewport.bottom - popupHeightScaled - POPUP_GAP);

        setPosStyle({ top: finalTop, left: finalLeft, maxHeight: `${baseMaxHeight}px`, width: `${baseWidth}px` });
    }, [
        dictPopup.visible,
        dictPopup.x,
        dictPopup.y,
        dictPopup.highlight,
        popupHeightPx,
        popupWidthPx,
        popupScale,
    ]);

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

    const popupText = processedEntries.length > 0
        ? processedEntries.map(e => e.headword + ' ' + e.reading).join(' ')
        : dictPopup.context?.sentence || '';
    const textDirection = isRTL(popupText) ? 'rtl' : 'ltr';

    const popupStyle: React.CSSProperties = {
        position: 'fixed',
        zIndex: 2147483647,
        width: popupWidthStyle,
        maxWidth: `calc((100% - ${POPUP_GAP * 2}px) / ${popupScale})`,
        overflowY: 'auto',
        backgroundColor: '#1a1d21', color: '#eee', border: '1px solid #444',
        borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        padding: '16px', fontFamily: 'sans-serif', fontSize: '14px', lineHeight: '1.5',
        transform: `scale(${popupScale})`,
        transformOrigin: 'top left',
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
                dir={textDirection}
                style={popupStyle}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                onWheel={e => e.stopPropagation()}
            >
                <DictionaryView
                    results={processedEntries}
                    isLoading={dictPopup.isLoading}
                    systemLoading={dictPopup.systemLoading ?? false}
                    onLinkClick={handleDefinitionLink}
                    context={dictPopup.context}
                    variant="popup"
                />
            </div>
        </>,
        document.body
    );
};
