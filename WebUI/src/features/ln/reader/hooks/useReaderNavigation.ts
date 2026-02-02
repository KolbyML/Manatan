// useReaderNavigation.ts

import { useEffect, useCallback, useRef, useState } from 'react';
import {
    NavigationOptions,
    NavigationState,
    calculateTotalPages,
    getCurrentPage,
    scrollToPage,
    navigateNext,
    navigatePrev,
    navigateToStart,
    navigateToEnd,
    getClickZone,
    handleKeyNavigation,
    handleWheelNavigation,
    createTouchState,
    handleTouchEnd,
    calculateProgress,
    TouchState,
} from '../utils/navigation';

interface UseReaderNavigationProps {
    containerRef: React.RefObject<HTMLElement>;
    options: NavigationOptions;
    onToggleUI?: () => void;
    onChapterChange?: (chapterIndex: number) => void;
}

interface UseReaderNavigationReturn {
    state: NavigationState;
    goToPage: (page: number) => void;
    goNext: () => void;
    goPrev: () => void;
    goToStart: () => void;
    goToEnd: () => void;
    handleClick: (e: React.MouseEvent) => void;
    handleTouchStart: (e: React.TouchEvent) => void;
    handleTouchEnd: (e: React.TouchEvent) => void;
}

export function useReaderNavigation({
    containerRef,
    options,
    onToggleUI,
    onChapterChange,
}: UseReaderNavigationProps): UseReaderNavigationReturn {
    const [state, setState] = useState<NavigationState>({
        currentPage: 0,
        totalPages: 1,
        currentChapter: 0,
        totalChapters: 0,
        progress: 0,
    });

    const touchStartRef = useRef<TouchState | null>(null);
    const wheelTimeoutRef = useRef<number | null>(null);
    const lastWheelTime = useRef<number>(0);

    // Update page count when container size changes
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updatePages = () => {
            const total = calculateTotalPages(container, options.isVertical);
            const current = getCurrentPage(container, options);
            const progress = calculateProgress(container, options.isVertical);

            setState(prev => ({
                ...prev,
                totalPages: total,
                currentPage: current,
                progress,
            }));
        };

        updatePages();

        const resizeObserver = new ResizeObserver(updatePages);
        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, [containerRef, options.isVertical, options.isPaged]);

    // Handle scroll events (for tracking position)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const current = getCurrentPage(container, options);
            const progress = calculateProgress(container, options.isVertical);

            setState(prev => {
                if (prev.currentPage !== current || Math.abs(prev.progress - progress) > 1) {
                    return { ...prev, currentPage: current, progress };
                }
                return prev;
            });
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [containerRef, options]);

    // Keyboard navigation
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if in input field
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if (handleKeyNavigation(e, container, options)) {
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [containerRef, options]);

    // Mouse wheel navigation 
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !options.isPaged) return;

        const handleWheel = (e: WheelEvent) => {
            // Debounce wheel events
            const now = Date.now();
            if (now - lastWheelTime.current < 300) {
                e.preventDefault();
                return;
            }

            const handled = handleWheelNavigation(
                e,
                container,
                options,
                state.currentPage,
                (newPage) => {
                    setState(prev => ({ ...prev, currentPage: newPage }));
                    lastWheelTime.current = now;
                }
            );

            if (handled) {
                e.preventDefault();
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [containerRef, options, state.currentPage]);

    // Navigation functions
    const goToPage = useCallback((page: number) => {
        const container = containerRef.current;
        if (!container) return;
        scrollToPage(container, page, options);
    }, [containerRef, options]);

    const goNext = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        navigateNext(container, options, state.currentPage);
    }, [containerRef, options, state.currentPage]);

    const goPrev = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        navigatePrev(container, options, state.currentPage);
    }, [containerRef, options, state.currentPage]);

    const goToStart = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        navigateToStart(container, options);
    }, [containerRef, options]);

    const goToEnd = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        navigateToEnd(container, options);
    }, [containerRef, options]);

    // Click handler
    const handleClick = useCallback((e: React.MouseEvent) => {
        const container = containerRef.current;
        if (!container) return;

        // Ignore clicks on interactive elements
        const target = e.target as HTMLElement;
        if (target.closest('a, button, img, image, input, ruby rt')) return;

        const zone = getClickZone(e, container, options.isVertical);

        switch (zone) {
            case 'next':
                goNext();
                break;
            case 'prev':
                goPrev();
                break;
            case 'center':
                onToggleUI?.();
                break;
        }
    }, [containerRef, options.isVertical, goNext, goPrev, onToggleUI]);

    // Touch handlers
    const handleTouchStartEvent = useCallback((e: React.TouchEvent) => {
        touchStartRef.current = createTouchState(e.nativeEvent);
    }, []);

    const handleTouchEndEvent = useCallback((e: React.TouchEvent) => {
        const container = containerRef.current;
        if (!container || !touchStartRef.current) return;

        const result = handleTouchEnd(e.nativeEvent, touchStartRef.current, container, options);
        touchStartRef.current = null;

        // If no swipe detected, treat as tap
        if (result === null) {
            const touch = e.changedTouches[0];
            const zone = getClickZone(
                { clientX: touch.clientX, clientY: touch.clientY },
                container,
                options.isVertical
            );

            if (zone === 'center') {
                onToggleUI?.();
            }
        }
    }, [containerRef, options, onToggleUI]);

    return {
        state,
        goToPage,
        goNext,
        goPrev,
        goToStart,
        goToEnd,
        handleClick,
        handleTouchStart: handleTouchStartEvent,
        handleTouchEnd: handleTouchEndEvent,
    };
}