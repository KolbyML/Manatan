/**
 * Lazy chapter loading hook optimized for "lighter" operation on weak devices.
 * Keeps only a window of chapters in memory to reduce DOM size and memory usage.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseChapterLoaderProps {
    chapters: string[];
    preloadCount?: number;
}

interface UseChapterLoaderReturn {
    loadedChapters: Map<number, string>;
    isChapterLoaded: (index: number) => boolean;
    loadChapter: (index: number, immediate?: boolean) => void;
    loadChaptersAround: (centerIndex: number) => void;
    getChapterHtml: (index: number) => string | null;
    loadingState: Map<number, boolean>;
}

export function useChapterLoader({
    chapters,
    preloadCount = 2,
}: UseChapterLoaderProps): UseChapterLoaderReturn {
    const [loadedChapters, setLoadedChapters] = useState<Map<number, string>>(new Map());
    const [loadingState, setLoadingState] = useState<Map<number, boolean>>(new Map());

    // Use refs to track state without triggering re-renders or being in dependencies
    const loadedRef = useRef<Set<number>>(new Set());
    const loadingInProgressRef = useRef<Set<number>>(new Set());
    const lastCenterIndexRef = useRef<number>(-1);

    const loadChapter = useCallback((index: number, immediate = false) => {
        if (index < 0 || index >= chapters.length) return;

        // If already loaded and NOT requesting immediate refresh, skip
        if (loadedRef.current.has(index) && !immediate) return;

        // If already loading, skip unless it's an immediate request
        if (loadingInProgressRef.current.has(index) && !immediate) return;

        if (immediate) {
            // Immediate load
            const html = chapters[index];

            setLoadedChapters(prev => {
                const next = new Map(prev);
                next.set(index, html);
                return next;
            });

            setLoadingState(prev => {
                const next = new Map(prev);
                next.set(index, false);
                return next;
            });

            loadedRef.current.add(index);
            loadingInProgressRef.current.delete(index);
        } else {
            // Deferred load
            loadingInProgressRef.current.add(index);
            setLoadingState(prev => {
                const next = new Map(prev);
                next.set(index, true);
                return next;
            });

            const task = () => {
                const html = chapters[index];

                setLoadedChapters(prev => {
                    const next = new Map(prev);
                    next.set(index, html);
                    return next;
                });

                setLoadingState(prev => {
                    const next = new Map(prev);
                    next.set(index, false);
                    return next;
                });

                loadedRef.current.add(index);
                loadingInProgressRef.current.delete(index);
            };

            // Use requestIdleCallback for background chapters if available
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(task, { timeout: 2000 });
            } else {
                setTimeout(task, 100);
            }
        }
    }, [chapters]);

    const loadChaptersAround = useCallback((centerIndex: number) => {
        // Only trigger update if we actually moved significantly or are at a new chapter
        if (centerIndex === lastCenterIndexRef.current) return;
        lastCenterIndexRef.current = centerIndex;

        // Determine which chapters to keep (current + window)
        // We keep a slightly larger window than preloadCount to avoid flickering
        const windowSize = preloadCount + 1;
        const keepStart = Math.max(0, centerIndex - windowSize);
        const keepEnd = Math.min(chapters.length - 1, centerIndex + windowSize);

        // Prune off-window chapters from state to keep it "light"
        setLoadedChapters(prev => {
            const next = new Map(prev);
            let changed = false;

            // Prune
            for (const [idx] of next) {
                if (idx < keepStart || idx > keepEnd) {
                    next.delete(idx);
                    loadedRef.current.delete(idx);
                    changed = true;
                }
            }

            // Immediate load of target chapter in same state update
            if (centerIndex >= 0 && centerIndex < chapters.length) {
                const html = chapters[centerIndex];
                if (next.get(centerIndex) !== html) {
                    next.set(centerIndex, html);
                    loadedRef.current.add(centerIndex);
                    changed = true;
                }
            }

            return changed ? next : prev;
        });

        // Update loading state for target if it was loading
        setLoadingState(prev => {
            if (prev.get(centerIndex) === false) return prev;
            const next = new Map(prev);
            next.set(centerIndex, false);
            return next;
        });
        loadingInProgressRef.current.delete(centerIndex);

        // Deferred load neighbors
        for (let i = 1; i <= preloadCount; i++) {
            if (centerIndex + i < chapters.length) loadChapter(centerIndex + i, false);
            if (centerIndex - i >= 0) loadChapter(centerIndex - i, false);
        }
    }, [chapters, preloadCount, loadChapter]);

    const isChapterLoaded = useCallback((index: number): boolean => {
        return loadedChapters.has(index);
    }, [loadedChapters]);

    const getChapterHtml = useCallback((index: number): string | null => {
        return loadedChapters.get(index) || null;
    }, [loadedChapters]);

    // Initialize with first chapter or given initial index
    useEffect(() => {
        if (lastCenterIndexRef.current === -1) {
            loadChaptersAround(0);
        }
    }, [loadChaptersAround]);

    return {
        loadedChapters,
        isChapterLoaded,
        loadChapter,
        loadChaptersAround,
        getChapterHtml,
        loadingState,
    };
}
