/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { RefObject, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useWindowEvent } from '@mantine/hooks';
import {
    IReaderSettingsManga,
    ReaderPageScaleMode,
    ReaderStateChapters,
    ReaderStatePages,
    ReadingDirection,
    ReadingMode,
} from '@/features/reader/Reader.types.ts';
import {
    isContinuousReadingMode,
    isContinuousVerticalReadingMode,
    isHeightPageScaleMode,
    isWidthPageScaleMode,
} from '@/features/reader/settings/ReaderSettings.utils.tsx';
import { getPreviousNextChapterVisibility } from '@/features/reader/Reader.utils.ts';
import { ChapterIdInfo, TChapterReader } from '@/features/chapter/Chapter.types.ts';

const shouldPreserveOnResizeChange = (
    readingMode: ReadingMode,
    pageScaleMode: ReaderPageScaleMode,
    previousWidth: number,
    previousHeight: number,
): boolean => {
    if (!isContinuousReadingMode(readingMode)) {
        return false;
    }

    const isWidthPageScaleModeActive = isWidthPageScaleMode(pageScaleMode);
    const isHeightPageScaleModeActive = isHeightPageScaleMode(pageScaleMode);

    const didWidthChange = previousWidth !== window.innerWidth;
    const didHeightChange = previousHeight !== window.innerHeight;

    const handleWidthChange = isWidthPageScaleModeActive && didWidthChange;
    const handleHeightChange = isHeightPageScaleModeActive && didHeightChange;

    return handleWidthChange || handleHeightChange;
};

const usePreserveOnValueChange = (
    value: unknown,
    currentPageIndex: number,
    setPageToScrollToIndex: ReaderStatePages['setPageToScrollToIndex'],
) => {
    useLayoutEffect(() => {
        setPageToScrollToIndex(currentPageIndex);
    }, [value]);
};

const usePreserveOnWindowResize = (
    readingMode: ReadingMode,
    pageScaleMode: ReaderPageScaleMode,
    setPageToScrollToIndex: (index: number | null) => void,
    pageIndex: number,
) => {
    const previousDimensionsRef = useRef({ width: window.innerWidth, height: window.innerHeight });
    const isResizeInProgressRef = useRef(false);
    const activeResizeTimeoutRef = useRef<NodeJS.Timeout>(undefined);
    const pageIndexOnResizeStartRef = useRef<number | null>(null);

    const handleResize = useCallback(() => {
        const { width, height } = previousDimensionsRef.current;
        previousDimensionsRef.current = { width: window.innerWidth, height: window.innerHeight };

        if (!isResizeInProgressRef.current) {
            isResizeInProgressRef.current = true;
            pageIndexOnResizeStartRef.current = pageIndex;
        }

        if (!shouldPreserveOnResizeChange(readingMode, pageScaleMode, width, height)) {
            return;
        }

        setPageToScrollToIndex(pageIndexOnResizeStartRef.current);

        clearTimeout(activeResizeTimeoutRef.current);
        activeResizeTimeoutRef.current = setTimeout(() => {
            isResizeInProgressRef.current = false;
            pageIndexOnResizeStartRef.current = null;
        }, 50);
    }, [readingMode, pageScaleMode, pageIndex]);

    useWindowEvent('resize', handleResize);
};

interface ScrollPreservationInfo {
    left: number;
    top: number;
    visibleElement: HTMLElement | undefined;
    visibleElementLeft: number;
    visibleElementTop: number;
}

const useScrollPreservationData = (
    scrollElementRef: RefObject<HTMLElement | null>,
): RefObject<ScrollPreservationInfo> => {
    const dataRef = useRef<ScrollPreservationInfo>({
        left: 0,
        top: 0,
        visibleElement: undefined,
        visibleElementLeft: 0,
        visibleElementTop: 0,
    });

    useEffect(() => {
        const scrollElement = scrollElementRef.current;

        if (!scrollElement) {
            return () => {};
        }

        const onScroll = () => {
            const { visibleElement } = dataRef.current;
            dataRef.current = {
                ...dataRef.current,
                left: scrollElement.scrollLeft,
                top: scrollElement.scrollTop,
                visibleElementLeft: visibleElement?.offsetLeft ?? 0,
                visibleElementTop: visibleElement?.offsetTop ?? 0,
            };
        };

        scrollElement.addEventListener('scroll', onScroll, { passive: true });

        return () => scrollElement.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        const scrollElement = scrollElementRef.current;
        if (!scrollElement) {
            return () => {};
        }

        const updateObservation = (nodes: NodeList, intersectionAction: (element: Element) => void) =>
            Array.from(nodes)
                .filter((node) => node instanceof HTMLElement)
                .flatMap((element) =>
                    element instanceof HTMLImageElement ? [element] : Array.from(element.querySelectorAll('img')),
                )
                .forEach(intersectionAction);

        const intersectionObserver = new IntersectionObserver((entries) => {
            const firstVisibleElement = entries.find((entry) => entry.isIntersecting);

            if (!(firstVisibleElement?.target instanceof HTMLElement)) {
                return;
            }

            dataRef.current = {
                ...dataRef.current,
                visibleElement: firstVisibleElement.target,
                visibleElementLeft: firstVisibleElement.target.offsetLeft,
                visibleElementTop: firstVisibleElement.target.offsetTop,
            };
        });
        const mutationObserver = new MutationObserver((entries) => {
            for (const entry of entries) {
                updateObservation(entry.addedNodes, (element) => intersectionObserver.observe(element));
                updateObservation(entry.removedNodes, (element) => intersectionObserver.unobserve(element));
            }
        });
        mutationObserver.observe(scrollElement, {
            childList: true,
            subtree: true,
        });
        return () => {
            mutationObserver.disconnect();
            intersectionObserver.disconnect();
        };
    }, []);

    return dataRef;
};

const usePreserveOnLeadingPageRender = (scrollElementRef: RefObject<HTMLElement | null>, readingMode: ReadingMode) => {
    const preservationData = useScrollPreservationData(scrollElementRef);

    const isContinuousReadingModeActive = isContinuousReadingMode(readingMode);
    const isContinuousVerticalReadingModeActive = isContinuousVerticalReadingMode(readingMode);

    useEffect(() => {
        const scrollElement = scrollElementRef.current;

        if (!scrollElement || !isContinuousReadingModeActive) {
            return () => {};
        }

        const preserveScrollPosition: ResizeObserverCallback = (entries) => {
            const { left, top, visibleElement, visibleElementLeft, visibleElementTop } = preservationData.current;

            if (!visibleElement) {
                return;
            }

            const entriesBeforeScrollPosition = entries.filter((entry) => {
                if (!(entry.target instanceof HTMLElement)) {
                    return false;
                }

                const isPreloadPage = !entry.target.clientWidth && !entry.target.clientHeight;
                if (isPreloadPage) {
                    return false;
                }

                if (isContinuousVerticalReadingModeActive) {
                    return entry.target.offsetTop < top;
                }

                return Math.abs(entry.target.offsetLeft) < Math.abs(left);
            });

            const includesElementsBeforeScrollPosition = !!entriesBeforeScrollPosition.length;
            if (!includesElementsBeforeScrollPosition) {
                return;
            }

            const newLeft = left - visibleElementLeft + visibleElement.offsetLeft;
            const newTop = top - visibleElementTop + visibleElement.offsetTop;

            scrollElement.scrollTo(newLeft, newTop);
        };

        const updateObservation = (nodes: NodeList, resizeAction: (element: Element) => void) =>
            Array.from(nodes)
                .filter((node) => node instanceof HTMLElement)
                .flatMap((element) =>
                    element instanceof HTMLImageElement ? [element] : Array.from(element.querySelectorAll('img')),
                )
                .forEach(resizeAction);

        const resizeObserver = new ResizeObserver(preserveScrollPosition);
        const mutationObserver = new MutationObserver((entries) => {
            for (const entry of entries) {
                updateObservation(entry.addedNodes, (element) => resizeObserver.observe(element));
                updateObservation(entry.removedNodes, (element) => resizeObserver.unobserve(element));
            }
        });

        mutationObserver.observe(scrollElement, {
            childList: true,
            subtree: true,
        });

        return () => {
            mutationObserver.disconnect();
            resizeObserver.disconnect();
        };
    }, [isContinuousReadingModeActive, isContinuousVerticalReadingModeActive]);
};

const usePreserveOnInfiniteScrollPreviousChapterInitialRender = (
    scrollElementRef: RefObject<HTMLElement | null>,
    currentChapterId: ChapterIdInfo['id'] | undefined,
    currentChapterIndex: number,
    currentPageIndex: number,
    chaptersToRender: TChapterReader[],
    visibleChapters: ReaderStateChapters['visibleChapters'],
    isContinuousReadingModeActive: boolean,
) => {
    const preservationDataRef = useScrollPreservationData(scrollElementRef);

    const preserveScrollPosition = (): boolean => {
        const scrollElement = scrollElementRef.current;
        const { left, top, visibleElementLeft, visibleElementTop, visibleElement } = preservationDataRef.current;

        if (!scrollElement || !isContinuousReadingModeActive || !visibleElement) {
            return false;
        }

        const previousNextChapterVisibility = getPreviousNextChapterVisibility(
            currentChapterIndex,
            chaptersToRender,
            visibleChapters,
        );

        const isRenderOfPreviousChapter = currentPageIndex === 0;

        // only relevant when prepending content to the dom due to the resulting layout shift
        const isFirstRenderOfPreviousChapter = !previousNextChapterVisibility.previous && isRenderOfPreviousChapter;
        if (!isFirstRenderOfPreviousChapter) {
            return false;
        }

        const newLeft = left - visibleElementLeft + visibleElement.offsetLeft;
        const newTop = top - visibleElementTop + visibleElement.offsetTop;

        scrollElement.scrollTo(newLeft, newTop);
        return true;
    };

    useEffect(() => {
        const scrollElement = scrollElementRef.current;
        if (!scrollElement || !isContinuousReadingModeActive) {
            return () => {};
        }

        let preservedScrollPosition = false;

        const updateObservation = (nodes: NodeList, resizeAction: (element: Element) => void) => {
            Array.from(nodes)
                .filter((node) => node instanceof HTMLElement)
                .flatMap((element) =>
                    element instanceof HTMLImageElement ? [element] : Array.from(element.querySelectorAll('img')),
                )
                .forEach(resizeAction);
        };

        const resizeObserver = new ResizeObserver(() => {
            if (preservedScrollPosition) {
                return;
            }

            preservedScrollPosition = preserveScrollPosition();
            if (preservedScrollPosition) {
                resizeObserver.disconnect();
            }
        });
        const mutationObserver = new MutationObserver((entries) => {
            for (const entry of entries) {
                updateObservation(entry.addedNodes, (element) => resizeObserver.observe(element));
                updateObservation(entry.removedNodes, (element) => resizeObserver.unobserve(element));
            }
        });

        mutationObserver.observe(scrollElement, {
            childList: true,
            subtree: true,
        });

        return () => {
            mutationObserver.disconnect();
            resizeObserver.disconnect();
        };
    }, [currentChapterId]);

    useLayoutEffect(() => {
        preserveScrollPosition();
    }, [currentChapterId]);
};

export const useReaderPreserveScrollPosition = (
    scrollElementRef: RefObject<HTMLElement | null>,
    currentChapterId: ChapterIdInfo['id'] | undefined,
    currentChapterIndex: number,
    currentPageIndex: number,
    chaptersToRender: TChapterReader[],
    visibleChapters: ReaderStateChapters['visibleChapters'],
    readingMode: ReadingMode,
    readingDirection: ReadingDirection,
    setPageToScrollToIndex: ReaderStatePages['setPageToScrollToIndex'],
    pageScaleMode: ReaderPageScaleMode,
    shouldStretchPage: boolean,
    readerWidth: IReaderSettingsManga['readerWidth'],
) => {
    usePreserveOnInfiniteScrollPreviousChapterInitialRender(
        scrollElementRef,
        currentChapterId,
        currentChapterIndex,
        currentPageIndex,
        chaptersToRender,
        visibleChapters,
        isContinuousReadingMode(readingMode),
    );
    usePreserveOnLeadingPageRender(scrollElementRef, readingMode);
    usePreserveOnWindowResize(readingMode, pageScaleMode, setPageToScrollToIndex, currentPageIndex);
    usePreserveOnValueChange(readingDirection, currentPageIndex, setPageToScrollToIndex);
    usePreserveOnValueChange(readingMode, currentPageIndex, setPageToScrollToIndex);
    usePreserveOnValueChange(pageScaleMode, currentPageIndex, setPageToScrollToIndex);
    usePreserveOnValueChange(shouldStretchPage, currentPageIndex, setPageToScrollToIndex);
    usePreserveOnValueChange(`${readerWidth.value}_${readerWidth.enabled}`, currentPageIndex, setPageToScrollToIndex);
};
