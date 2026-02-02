import { useIsMobile } from '@/Manatan/hooks/useIsMobile';
import { useRef, useCallback, useEffect, useState, RefObject } from 'react';

interface ZoomState {
    scale: number;
    isZooming: boolean;
}

interface PinchState {
    active: boolean;
    initialDistance: number;
    initialScale: number;
    anchorContentX: number;
    anchorContentY: number;
    initialCenterX: number;
    initialCenterY: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_DELAY = 300;
const DOUBLE_TAP_DISTANCE = 50;
const SNAP_THRESHOLD = 0.1

const getDistance = (touch1: Touch, touch2: Touch): number =>
    Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);

const getCenter = (touch1: Touch, touch2: Touch) => ({
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
});

export const useMobileZoomPan = (
    scrollContainerRef: RefObject<HTMLElement | null>,
    contentRef: RefObject<HTMLElement | null>,
    sizerRef: RefObject<HTMLElement | null>,
    options: {
        enabled?: boolean;
        isVertical?: boolean;
        isRTL?: boolean;
        minScale?: number;
        maxScale?: number;
        doubleTapZoomEnabled?: boolean;
        onScaleChange?: (scale: number) => void;
    } = {}
) => {
    const {
        enabled = true,
        isVertical = true,
        isRTL = false,
        minScale = MIN_SCALE,
        maxScale = MAX_SCALE,
        doubleTapZoomEnabled = true,
        onScaleChange,
    } = options;

    const [zoomState, setZoomState] = useState<ZoomState>({
        scale: 1,
        isZooming: false,
    });

    const scaleRef = useRef(1);
    const pinchState = useRef<PinchState>({
        active: false,
        initialDistance: 0,
        initialScale: 1,
        anchorContentX: 0,
        anchorContentY: 0,
        initialCenterX: 0,
        initialCenterY: 0,
    });

    const lastTap = useRef({ time: 0, x: 0, y: 0 });

    const isMobile = useIsMobile();

    // Apply scale directly to DOM for smooth updates during gesture
    const applyScaleToDOM = useCallback((scale: number) => {
        const content = contentRef.current;
        const sizer = sizerRef.current;
        if (!content || !sizer) return;

        if (isVertical) {
            // Vertical scrolling: scale affects width
            sizer.style.width = scale > 1 ? `${scale * 100}%` : '100%';
            sizer.style.minHeight = '100%';
            sizer.style.height = '';
            sizer.style.minWidth = '';

            content.style.width = scale > 1 ? `${100 / scale}%` : '100%';
            content.style.minHeight = '100%';
            content.style.height = '';
            content.style.minWidth = '';
        } else {
            // Horizontal scrolling: scale affects height
            sizer.style.height = scale > 1 ? `${scale * 100}%` : '100%';
            sizer.style.minWidth = '100%';
            sizer.style.width = '';
            sizer.style.minHeight = '';

            content.style.height = scale > 1 ? `${100 / scale}%` : '100%';
            content.style.minWidth = '100%';
            content.style.width = '';
            content.style.minHeight = '';
        }

        content.style.transform = `scale(${scale})`;
        content.style.transformOrigin = isVertical ? 'top left' : (isRTL ? 'top right' : 'top left');

        scaleRef.current = scale;
    }, [contentRef, sizerRef, isVertical, isRTL]);

    // Convert viewport coordinates to content coordinates
    const viewportToContent = useCallback((
        viewportX: number,
        viewportY: number,
        scale: number
    ): { x: number; y: number } => {
        const container = scrollContainerRef.current;
        if (!container) return { x: 0, y: 0 };

        const rect = container.getBoundingClientRect();
        const containerX = viewportX - rect.left;
        const containerY = viewportY - rect.top;

        let contentX: number;
        let contentY: number;

        if (isVertical) {
            // Vertical mode: horizontal axis is scaled, vertical is natural scroll
            contentX = (container.scrollLeft + containerX) / scale;
            contentY = (container.scrollTop + containerY) / scale;
        } else {
            // Horizontal mode: vertical axis is scaled, horizontal is natural scroll
            if (isRTL) {
                const maxScrollLeft = container.scrollWidth - container.clientWidth;
                const scrollFromRight = maxScrollLeft - container.scrollLeft;
                const containerXFromRight = rect.width - containerX;
                contentX = (scrollFromRight + containerXFromRight) / scale;
            } else {
                contentX = (container.scrollLeft + containerX) / scale;
            }
            contentY = (container.scrollTop + containerY) / scale;
        }

        return { x: contentX, y: contentY };
    }, [scrollContainerRef, isVertical, isRTL]);

    // Scroll to keep a content point at a viewport position
    const scrollToKeepContentAt = useCallback((
        contentX: number,
        contentY: number,
        viewportX: number,
        viewportY: number,
        scale: number
    ) => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const containerX = viewportX - rect.left;
        const containerY = viewportY - rect.top;

        if (isVertical) {
            const targetScrollLeft = contentX * scale - containerX;
            const targetScrollTop = contentY * scale - containerY;
            container.scrollLeft = Math.max(0, targetScrollLeft);
            container.scrollTop = Math.max(0, targetScrollTop);
        } else {
            if (isRTL) {
                const containerXFromRight = rect.width - containerX;
                const targetScrollFromRight = contentX * scale - containerXFromRight;
                const maxScrollLeft = container.scrollWidth - container.clientWidth;
                container.scrollLeft = Math.max(0, maxScrollLeft - targetScrollFromRight);
            } else {
                const targetScrollLeft = contentX * scale - containerX;
                container.scrollLeft = Math.max(0, targetScrollLeft);
            }
            const targetScrollTop = contentY * scale - containerY;
            container.scrollTop = Math.max(0, targetScrollTop);
        }
    }, [scrollContainerRef, isVertical, isRTL]);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (!enabled || !isMobile) return;

        const container = scrollContainerRef.current;
        if (!container) return;

        if (e.touches.length === 2) {
            e.preventDefault();

            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const center = getCenter(touch1, touch2);
            const distance = getDistance(touch1, touch2);

            const anchor = viewportToContent(center.x, center.y, scaleRef.current);

            pinchState.current = {
                active: true,
                initialDistance: distance,
                initialScale: scaleRef.current,
                anchorContentX: anchor.x,
                anchorContentY: anchor.y,
                initialCenterX: center.x,
                initialCenterY: center.y,
            };

            setZoomState(prev => ({ ...prev, isZooming: true }));

        } else if (e.touches.length === 1) {
            const touch = e.touches[0];
            const now = Date.now();
            const { time, x, y } = lastTap.current;

            if (
                now - time < DOUBLE_TAP_DELAY &&
                Math.hypot(touch.clientX - x, touch.clientY - y) < DOUBLE_TAP_DISTANCE
            ) {
                e.preventDefault();
                if (doubleTapZoomEnabled) {
                    const targetScale = scaleRef.current > 1.1 ? 1 : 2.5;
                    const anchor = viewportToContent(touch.clientX, touch.clientY, scaleRef.current);

                    applyScaleToDOM(targetScale);

                    if (targetScale === 1) {
                        container.scrollLeft = isRTL && !isVertical
                            ? container.scrollWidth - container.clientWidth
                            : 0;
                        container.scrollTop = 0;
                    } else {
                        requestAnimationFrame(() => {
                            scrollToKeepContentAt(anchor.x, anchor.y, touch.clientX, touch.clientY, targetScale);
                        });
                    }

                    setZoomState({ scale: targetScale, isZooming: false });
                    onScaleChange?.(targetScale);
                }
                lastTap.current = { time: 0, x: 0, y: 0 };
            } else {
                lastTap.current = { time: now, x: touch.clientX, y: touch.clientY };
            }
        }
    }, [enabled, scrollContainerRef, viewportToContent, applyScaleToDOM, scrollToKeepContentAt, onScaleChange, isVertical, isRTL, doubleTapZoomEnabled]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!enabled || !isMobile) return;
        if (!pinchState.current.active || e.touches.length !== 2) return;

        e.preventDefault();

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = getDistance(touch1, touch2);
        const currentCenter = getCenter(touch1, touch2);

        const distanceRatio = currentDistance / pinchState.current.initialDistance;
        const newScale = Math.max(
            minScale,
            Math.min(maxScale, pinchState.current.initialScale * distanceRatio)
        );

        applyScaleToDOM(newScale);

        scrollToKeepContentAt(
            pinchState.current.anchorContentX,
            pinchState.current.anchorContentY,
            currentCenter.x,
            currentCenter.y,
            newScale
        );
    }, [enabled, minScale, maxScale, applyScaleToDOM, scrollToKeepContentAt]);

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        if (!pinchState.current.active) return;

        if (e.touches.length < 2) {
            pinchState.current.active = false;

            let finalScale = scaleRef.current;
            if (Math.abs(finalScale - 1) < SNAP_THRESHOLD) {
                finalScale = 1;
                applyScaleToDOM(1);
            }

            setZoomState({ scale: finalScale, isZooming: false });
            onScaleChange?.(finalScale);
        }
    }, [applyScaleToDOM, onScaleChange]);

    // Reset zoom when direction changes
    useEffect(() => {
        applyScaleToDOM(1);
        setZoomState({ scale: 1, isZooming: false });
        scaleRef.current = 1;
    }, [isVertical, isRTL, applyScaleToDOM]);

    // Prevent default browser zoom
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || !enabled || !isMobile) return;

        const preventDefault = (e: TouchEvent) => {
            if (e.touches.length >= 2) e.preventDefault();
        };

        container.addEventListener('touchmove', preventDefault, { passive: false });
        return () => container.removeEventListener('touchmove', preventDefault);
    }, [enabled, scrollContainerRef]);

    // Main event listeners
    useEffect(() => {
        if (!enabled || !isMobile) return;

        const container = scrollContainerRef.current;
        if (!container) return;

        const opts: AddEventListenerOptions = { passive: false };

        container.addEventListener('touchstart', handleTouchStart, opts);
        container.addEventListener('touchmove', handleTouchMove, opts);
        container.addEventListener('touchend', handleTouchEnd);
        container.addEventListener('touchcancel', handleTouchEnd);

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [enabled, scrollContainerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

    const resetZoom = useCallback(() => {
        applyScaleToDOM(1);
        setZoomState({ scale: 1, isZooming: false });
        onScaleChange?.(1);

        const container = scrollContainerRef.current;
        if (container) {
            container.scrollLeft = isRTL && !isVertical
                ? container.scrollWidth - container.clientWidth
                : 0;
            container.scrollTop = 0;
        }
    }, [applyScaleToDOM, scrollContainerRef, onScaleChange, isVertical, isRTL]);

    return {
        scale: zoomState.scale,
        isZooming: zoomState.isZooming,
        isZoomed: zoomState.scale > 1,
        resetZoom,
    };
};
