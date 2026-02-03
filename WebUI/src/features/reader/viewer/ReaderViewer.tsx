/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ForwardedRef, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import { useLocation } from 'react-router-dom';
import { useMergedRef } from '@mantine/hooks';
import {
    PageInViewportType,
    ReaderOpenChapterLocationState,
    ReaderResumeMode,
    ReadingDirection,
    ReadingMode,
} from '@/features/reader/Reader.types.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { ReaderControls } from '@/features/reader/services/ReaderControls.ts';
import {
    isContinuousReadingMode,
    isContinuousVerticalReadingMode,
    shouldApplyReaderWidth,
} from '@/features/reader/settings/ReaderSettings.utils.tsx';
import { useMouseDragScroll } from '@/base/hooks/useMouseDragScroll.tsx';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { withPropsFrom } from '@/base/hoc/withPropsFrom.tsx';
import { useReaderAutoScroll } from '@/features/reader/auto-scroll/hooks/useReaderAutoScroll.ts';
import { useReaderHideOverlayOnUserScroll } from '@/features/reader/overlay/hooks/useReaderHideOverlayOnUserScroll.ts';
import { useReaderHorizontalModeRevampScrolling } from '@/features/reader/viewer/hooks/useReaderHorizontalModeRevampScrolling.ts';
import { useReaderHideCursorOnInactivity } from '@/features/reader/viewer/hooks/useReaderHideCursorOnInactivity.ts';
import { useReaderScrollToStartOnPageChange } from '@/features/reader/viewer/hooks/useReaderScrollToStartOnPageChange.ts';
import { useReaderHandlePageSelection } from '@/features/reader/viewer/hooks/useReaderHandlePageSelection.ts';
import { ReaderChapterViewer } from '@/features/reader/viewer/ReaderChapterViewer.tsx';
import {
    getPreviousNextChapterVisibility,
    getReaderChapterViewerCurrentPageIndex,
    getReaderChapterViewResumeMode,
} from '@/features/reader/Reader.utils.ts';
import { coerceIn, noOp } from '@/lib/HelperFunctions.ts';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { NavbarContextType } from '@/features/navigation-bar/NavigationBar.types.ts';
import { useReaderPreserveScrollPosition } from '@/features/reader/viewer/hooks/useReaderPreserveScrollPosition.ts';

import { ChapterIdInfo } from '@/features/chapter/Chapter.types.ts';
import {
    getReaderStore,
    useReaderAutoScrollStore,
    useReaderChaptersStore,
    useReaderOverlayStore,
    useReaderPagesStore,
    useReaderSettingsStore,
    useReaderTapZoneStore,
} from '@/features/reader/stores/ReaderStore.ts';
import { ReaderZoomWrapper } from '@/features/reader/zoom/ReaderZoomWrapper';
import { useIsMobile } from '@/Manatan/hooks/useIsMobile';

const READING_MODE_TO_IN_VIEWPORT_TYPE: Record<ReadingMode, PageInViewportType> = {
    [ReadingMode.SINGLE_PAGE]: PageInViewportType.X,
    [ReadingMode.DOUBLE_PAGE]: PageInViewportType.X,
    [ReadingMode.CONTINUOUS_VERTICAL]: PageInViewportType.Y,
    [ReadingMode.CONTINUOUS_HORIZONTAL]: PageInViewportType.X,
    [ReadingMode.WEBTOON]: PageInViewportType.Y,
};

const BaseReaderViewer = ({
    readerNavBarWidth,
    updateCurrentPageIndex,
    ref,
}: Pick<NavbarContextType, 'readerNavBarWidth'> & {
    updateCurrentPageIndex: ReturnType<typeof ReaderControls.useUpdateCurrentPageIndex>;
    ref?: ForwardedRef<HTMLDivElement | null>;
}) => {
    const { direction: themeDirection } = useTheme();
    const isOverlayVisible = useReaderOverlayStore((state) => state.overlay.isVisible);
    
    // --- TOP LEVEL HOOKS START ---
    const scrollElementRef = useRef<HTMLDivElement | null>(null);
    const scrollTimeout = useRef<number | undefined>(undefined);

    const zoomWrapperRef = useRef<HTMLDivElement | null>(null);

    const isMobile = useIsMobile();

    useEffect(() => {
        if (!isMobile) return;

        const handleInputMove = (e: Event) => {
            const ce = e as CustomEvent;
            const { dx, dy } = ce.detail;
            
            // Only manually scroll if we are NOT in zoom mode
            if (!document.body.classList.contains('disable-native-scroll') && scrollElementRef.current) {
                if (dy !== 0) scrollElementRef.current.scrollTop += dy;
                if (dx !== 0) scrollElementRef.current.scrollLeft += dx;
            }
        };

        window.addEventListener('ocr-input-move', handleInputMove);
        return () => window.removeEventListener('ocr-input-move', handleInputMove);
    }, []);
    // ----------------------------

    const {
        currentPageIndex,
        pageToScrollToIndex,
        setPageToScrollToIndex,
        pages,
        totalPages,
        setPages,
        setPageLoadStates,
        setTotalPages,
        setCurrentPageIndex,
        transitionPageMode,
        retryFailedPagesKeyPrefix,
        setTransitionPageMode,
    } = useReaderPagesStore((state) => ({
        currentPageIndex: state.pages.currentPageIndex,
        pageToScrollToIndex: state.pages.pageToScrollToIndex,
        setPageToScrollToIndex: state.pages.setPageToScrollToIndex,
        pages: state.pages.pages,
        totalPages: state.pages.totalPages,
        setPages: state.pages.setPages,
        setPageLoadStates: state.pages.setPageLoadStates,
        setTotalPages: state.pages.setTotalPages,
        setCurrentPageIndex: state.pages.setCurrentPageIndex,
        transitionPageMode: state.pages.transitionPageMode,
        retryFailedPagesKeyPrefix: state.pages.retryFailedPagesKeyPrefix,
        setTransitionPageMode: state.pages.setTransitionPageMode,
    }));
    const { initialChapter, currentChapter, chapters, visibleChapters, isCurrentChapterReady } = useReaderChaptersStore(
        (state) => ({
            initialChapter: state.chapters.initialChapter,
            currentChapter: state.chapters.currentChapter,
            chapters: state.chapters.chapters,
            visibleChapters: state.chapters.visibleChapters,
            setReaderStateChapters: state.chapters.setReaderStateChapters,
            isCurrentChapterReady: state.chapters.isCurrentChapterReady,
        }),
    );
    const {
        readingMode,
        readingDirection,
        readerWidth,
        pageScaleMode,
        shouldOffsetDoubleSpreads,
        imagePreLoadAmount,
        pageGap,
        customFilter,
        shouldStretchPage,
        isStaticNav,
    } = useReaderSettingsStore((state) => ({
        readingMode: state.settings.readingMode.value,
        readingDirection: state.settings.readingDirection.value,
        readerWidth: state.settings.readerWidth.value,
        pageScaleMode: state.settings.pageScaleMode.value,
        shouldOffsetDoubleSpreads: state.settings.shouldOffsetDoubleSpreads.value,
        imagePreLoadAmount: state.settings.imagePreLoadAmount,
        pageGap: state.settings.pageGap.value,
        customFilter: state.settings.customFilter,
        shouldStretchPage: state.settings.shouldStretchPage.value,
        isStaticNav: state.settings.isStaticNav,
    }));
    const { showPreview, setShowPreview } = useReaderTapZoneStore((state) => ({
        showPreview: state.tapZone.showPreview,
        setShowPreview: state.tapZone.setShowPreview,
    }));
    const { resumeMode = ReaderResumeMode.START } = useLocation<ReaderOpenChapterLocationState>().state ?? {
        resumeMode: ReaderResumeMode.START,
    };

    const mergedRef = useMergedRef(ref, scrollElementRef);

    const isContinuousVerticalReadingModeActive = isContinuousVerticalReadingMode(readingMode);
    const isContinuousReadingModeActive = isContinuousReadingMode(readingMode);
    const isDragging = useMouseDragScroll(scrollElementRef);
    // If true wrap entire chapter viewer for continuous scrolling
    const isZoomEnabled = isContinuousReadingModeActive && isMobile; 

    const automaticScrolling = useReaderAutoScrollStore((state) => ({
        isPaused: state.autoScroll.isPaused,
        pause: state.autoScroll.pause,
        resume: state.autoScroll.resume,
        setScrollRef: state.autoScroll.setScrollRef,
    }));

    useEffect(() => automaticScrolling.setScrollRef(scrollElementRef.current), []);

    const scrollbarXSize = MediaQuery.useGetScrollbarSize('width', scrollElementRef.current);
    const scrollbarYSize = MediaQuery.useGetScrollbarSize('height', scrollElementRef.current);
    useLayoutEffect(() => {
        const { scrollbar } = getReaderStore();
        scrollbar.setXSize(scrollbarXSize);
        scrollbar.setYSize(scrollbarYSize);
    }, [scrollbarXSize, scrollbarYSize]);

    const imageRefs = useRef<(HTMLElement | null)[]>(pages.map(() => null));
    const [{ minChapterViewWidth, minChapterViewHeight, minChapterSizeSourceChapterId }, setChapterViewerSize] =
        useState({
            minChapterViewWidth: 0,
            minChapterViewHeight: 0,
            minChapterSizeSourceChapterId: -1,
        });

    const [, setTriggerReRender] = useState({});

    const inViewportType = READING_MODE_TO_IN_VIEWPORT_TYPE[readingMode];
    const isLtrReadingDirection = readingDirection === ReadingDirection.LTR;
    const initialChapterIndex = useMemo(
        () => chapters.findIndex((chapter) => chapter.id === initialChapter?.id),
        [chapters, initialChapter?.id],
    );
    const chaptersToRender = useMemo(
        () =>
            chapters.slice(
                Math.max(0, initialChapterIndex - visibleChapters.trailing),
                Math.min(chapters.length, initialChapterIndex + visibleChapters.leading + 1),
            ),
        [chapters, initialChapterIndex, visibleChapters.trailing, visibleChapters.leading],
    );
    const currentChapterIndex = useMemo(
        () => chaptersToRender.findIndex((chapter) => chapter.id === currentChapter?.id),
        [currentChapter, chaptersToRender],
    );

    const onChapterViewSizeChange = useCallback(
        (width: number, height: number, chapterId: ChapterIdInfo['id']) => {
            if (!isContinuousReadingModeActive) {
                return;
            }

            const isSameChapterId = chapterId === minChapterSizeSourceChapterId;

            if (isContinuousVerticalReadingModeActive) {
                if (!isSameChapterId && minChapterViewWidth >= width) {
                    return;
                }

                setChapterViewerSize({
                    minChapterViewWidth: width,
                    minChapterViewHeight: 0,
                    minChapterSizeSourceChapterId: chapterId,
                });
                return;
            }

            if (isSameChapterId || minChapterViewHeight < height) {
                setChapterViewerSize({
                    minChapterViewWidth: 0,
                    minChapterViewHeight: height,
                    minChapterSizeSourceChapterId: chapterId,
                });
            }
        },
        [
            isContinuousReadingModeActive,
            isContinuousVerticalReadingModeActive,
            minChapterViewWidth,
            minChapterViewHeight,
            minChapterSizeSourceChapterId,
        ],
    );

    useReaderHandlePageSelection(
        pageToScrollToIndex,
        pages,
        totalPages,
        setPageToScrollToIndex,
        updateCurrentPageIndex,
        isContinuousReadingModeActive,
        imageRefs,
        themeDirection,
        readingDirection,
    );
    useReaderScrollToStartOnPageChange(
        currentPageIndex,
        isContinuousReadingModeActive,
        themeDirection,
        readingDirection,
        scrollElementRef,
    );
    useReaderHideCursorOnInactivity(scrollElementRef);
    useReaderHorizontalModeRevampScrolling(readingMode, readingDirection, scrollElementRef);
    useReaderHideOverlayOnUserScroll(isOverlayVisible, showPreview, setShowPreview, scrollElementRef);
    useReaderAutoScroll(
        isOverlayVisible,
        automaticScrolling.isPaused,
        automaticScrolling.pause,
        automaticScrolling.resume,
        isStaticNav,
    );
    useReaderPreserveScrollPosition(
        scrollElementRef,
        currentChapter?.id,
        currentChapterIndex,
        currentPageIndex,
        chaptersToRender,
        visibleChapters,
        readingMode,
        readingDirection,
        setPageToScrollToIndex,
        pageScaleMode,
        shouldStretchPage,
        readerWidth,
    );

    useLayoutEffect(() => {
        setChapterViewerSize({
            minChapterViewWidth: 0,
            minChapterViewHeight: 0,
            minChapterSizeSourceChapterId: -1,
        });
        setTriggerReRender({});
    }, [readingMode]);

    if (!initialChapter || !currentChapter) {
        throw new Error('ReaderViewer: illegal state - initialChapter and currentChapter should not be undefined');
    }

    const handleScroll = (e: React.UIEvent) => {
        if (!isDragging) {
             ReaderControls.updateCurrentPageOnScroll(
                imageRefs,
                totalPages - 1,
                updateCurrentPageIndex,
                inViewportType,
                readingDirection,
            );
        }
        // Mobile-only glitch fix
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            document.body.classList.add('ocr-interaction');
            window.clearTimeout(scrollTimeout.current);
            scrollTimeout.current = window.setTimeout(() => {
                document.body.classList.remove('ocr-interaction');
                window.dispatchEvent(new Event('resize')); 
            }, 150);
        }
    };

    return (
        <Stack
            ref={mergedRef}
            className="reader-scroll-container"
            sx={{
                width: '100%',
                height: '100%',
                overflow: 'auto',
                flexWrap: 'nowrap',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                ...applyStyles(
                    isContinuousVerticalReadingModeActive && shouldApplyReaderWidth(readerWidth, pageScaleMode),
                    { alignItems: 'center' },
                ),
                ...applyStyles(!isContinuousVerticalReadingModeActive, {
                    ...applyStyles(themeDirection === 'ltr', {
                        flexDirection: isLtrReadingDirection ? 'row' : 'row',
                    }),
                    ...applyStyles(themeDirection === 'rtl', {
                        flexDirection: isLtrReadingDirection ? 'row' : 'row',
                    }),
                }),
            }}
            onClick={(e) => !isDragging && ReaderControls.handleClick(scrollElementRef.current, e)}
            onScroll={handleScroll}
        >
            <ReaderZoomWrapper
                ref={zoomWrapperRef}
                scrollContainerRef={scrollElementRef}
                readingMode={readingMode}
                readingDirection={readingDirection}
                enabled={isZoomEnabled}
            >
                {chaptersToRender.map((_, index) => {
                    const chapterIndex = Math.max(0, chaptersToRender.length - index - 1);
                    const chapter = chaptersToRender[chapterIndex];

                    const previousChapter =
                        chaptersToRender[chapterIndex + 1] ?? chapters[initialChapterIndex + visibleChapters.leading + 1];
                    const nextChapter =
                        chaptersToRender[chapterIndex - 1] ?? chapters[initialChapterIndex - visibleChapters.trailing - 1];

                    const isInitialChapter = chapter.id === initialChapter.id;  
                    const isCurrentChapter = chapter.id === currentChapter.id;  
                    const isPreviousChapter = chapter.id === chaptersToRender[currentChapterIndex + 1]?.id; 
                    const isNextChapter = chapter.id === chaptersToRender[currentChapterIndex - 1]?.id; 
                    const isLeadingChapter = initialChapter.sourceOrder > chapter.sourceOrder;  
                    const isTrailingChapter = initialChapter.sourceOrder < chapter.sourceOrder; 
                    const isLastLeadingChapter = visibleChapters.lastLeadingChapterSourceOrder === chapter.sourceOrder; 
                    const isLastTrailingChapter = visibleChapters.lastTrailingChapterSourceOrder === chapter.sourceOrder;
                    const isPreloadMode =
                        (isLastLeadingChapter && visibleChapters.isLeadingChapterPreloadMode) ||
                        (isLastTrailingChapter && visibleChapters.isTrailingChapterPreloadMode);

                    const previousNextChapterVisibility = getPreviousNextChapterVisibility(
                        chapterIndex,
                        chaptersToRender,
                        visibleChapters,
                    );

                    const isChapterSizeSourceChapter = chapter.id === minChapterSizeSourceChapterId;

                    return (
                        <ReaderChapterViewer
                            key={chapter.id}
                            chapterId={chapter.id}
                            mangaId={chapter.mangaId}
                            chapterSourceOrder={chapter.sourceOrder}
                            previousChapterId={previousChapter?.id}
                            nextChapterId={nextChapter?.id}
                            isPreviousChapterVisible={previousNextChapterVisibility.previous}
                            isNextChapterVisible={previousNextChapterVisibility.next}
                            lastPageRead={coerceIn(chapter.lastPageRead, 0, chapter.pageCount - 1)}
                            currentPageIndex={getReaderChapterViewerCurrentPageIndex(
                                currentPageIndex,
                                chapter,
                                currentChapter,
                                isCurrentChapter,
                                isCurrentChapterReady,
                                isLeadingChapter,
                                isTrailingChapter,
                                visibleChapters,
                            )}
                            isInitialChapter={isInitialChapter}
                            isCurrentChapter={isCurrentChapter}
                            isPreviousChapter={isPreviousChapter}
                            isNextChapter={isNextChapter}
                            isLeadingChapter={isLeadingChapter}
                            isTrailingChapter={isTrailingChapter}
                            isPreloadMode={isPreloadMode}
                            imageRefs={imageRefs}
                            setPages={setPages}
                            setPageLoadStates={setPageLoadStates}
                            setTotalPages={setTotalPages}
                            setCurrentPageIndex={setCurrentPageIndex}
                            setPageToScrollToIndex={setPageToScrollToIndex}
                            transitionPageMode={transitionPageMode}
                            retryFailedPagesKeyPrefix={retryFailedPagesKeyPrefix}
                            readingMode={readingMode}
                            readerWidth={readerWidth}
                            pageScaleMode={pageScaleMode}
                            shouldOffsetDoubleSpreads={shouldOffsetDoubleSpreads}
                            readingDirection={readingDirection}
                            updateCurrentPageIndex={isCurrentChapter ? updateCurrentPageIndex : noOp}
                            scrollIntoView={isCurrentChapter && visibleChapters.scrollIntoView}
                            resumeMode={getReaderChapterViewResumeMode(
                                isCurrentChapter,
                                isInitialChapter,
                                isLeadingChapter,
                                isTrailingChapter,
                                visibleChapters.resumeMode,
                                resumeMode,
                            )}
                            setTransitionPageMode={setTransitionPageMode}
                            pageGap={pageGap}
                            imagePreLoadAmount={imagePreLoadAmount}
                            customFilter={customFilter}
                            shouldStretchPage={shouldStretchPage}
                            readerNavBarWidth={readerNavBarWidth}
                            onSizeChange={onChapterViewSizeChange}
                            minWidth={isChapterSizeSourceChapter ? 0 : minChapterViewWidth}
                            minHeight={isChapterSizeSourceChapter ? 0 : minChapterViewHeight}
                            scrollElement={scrollElementRef.current}
                        />
                    );
                })}
            </ReaderZoomWrapper>
        </Stack>
    );
};

export const ReaderViewer = withPropsFrom(
    memo(BaseReaderViewer),
    [() => ({ updateCurrentPageIndex: ReaderControls.useUpdateCurrentPageIndex() }), useNavBarContext],
    ['readerNavBarWidth', 'updateCurrentPageIndex'],
);
