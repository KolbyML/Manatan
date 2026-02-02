/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { MutableRefObject, RefObject, useCallback, useEffect } from 'react';
import { Direction } from '@mui/material/styles';
import { t as translate } from 'i18next';
import { d } from 'koration';
import {
    getNextIndexFromPage,
    getNextPageIndex,
    getPage,
    getPageForMousePos,
    getProgressBarPositionInfo,
} from '@/features/reader/overlay/progress-bar/ReaderProgressBar.utils.tsx';
import { getCurrentTheme, getOptionForDirection } from '@/features/theme/services/ThemeCreator.ts';
import { ReaderService } from '@/features/reader/services/ReaderService.ts';
import {
    PageInViewportType,
    ProgressBarPosition,
    ReaderScrollAmount,
    ReaderStatePages,
    ReaderTransitionPageMode,
    ReadingDirection,
    ReadingMode,
} from '@/features/reader/Reader.types.ts';
import { DirectionOffset, ScrollDirection, ScrollOffset, TranslationKey } from '@/base/Base.types.ts';
import { READING_DIRECTION_TO_THEME_DIRECTION } from '@/features/reader/settings/ReaderSettings.constants.tsx';
import {
    isATransitionPageVisible,
    isEndOfPageInViewport,
    isPageInViewport,
} from '@/features/reader/viewer/pager/ReaderPager.utils.tsx';
import { TapZoneRegionType, TReaderTapZoneContext } from '@/features/reader/tap-zones/TapZoneLayout.types.ts';
import { ReaderTapZoneService } from '@/features/reader/tap-zones/ReaderTapZoneService.ts';
import { isContinuousReadingMode } from '@/features/reader/settings/ReaderSettings.utils.tsx';
import {
    getReaderChapterFromCache,
    getReaderOpenChapterResumeMode,
    updateReaderStateVisibleChapters,
} from '@/features/reader/Reader.utils.ts';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { ChapterIdInfo, TChapterReader } from '@/features/chapter/Chapter.types.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { TReaderProgressCurrentPage } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.types.ts';
import {
    getReaderChaptersStore,
    getReaderOverlayStore,
    getReaderPagesStore,
    getReaderSettingsStore,
    getReaderStore,
    getReaderTapZoneStore,
} from '@/features/reader/stores/ReaderStore.ts';
import { Confirmation } from '@/base/AppAwaitableComponent.ts';

const getScrollDirectionInvert = (
    scrollDirection: ScrollDirection,
    scrollOffset: ScrollOffset,
    themeDirection: Direction,
): 1 | -1 => {
    if (scrollDirection === ScrollDirection.X) {
        if (scrollOffset === ScrollOffset.BACKWARD) {
            if (themeDirection === 'ltr') {
                return -1;
            }

            return 1;
        }

        if (scrollOffset === ScrollOffset.FORWARD) {
            if (themeDirection === 'ltr') {
                return 1;
            }

            return -1;
        }
    }

    // handle ScrollDirection.XY the same as ScrollDirection.Y
    if (scrollOffset === ScrollOffset.BACKWARD) {
        return -1;
    }

    return 1;
};

export class ReaderControls {
    private static updateCurrentPageTimeout: NodeJS.Timeout;

    static scroll(
        offset: ScrollOffset,
        direction: ScrollDirection,
        readingMode: ReadingMode,
        readingDirection: ReadingDirection,
        element: HTMLElement,
        setShowPreview: TReaderTapZoneContext['setShowPreview'],
        scrollAmountPercentage: number = ReaderScrollAmount.LARGE,
    ): void {
        if (!element) {
            return;
        }

        const themeDirectionOfReadingDirection = READING_DIRECTION_TO_THEME_DIRECTION[readingDirection];
        const areReadingDirectionsEqual = getCurrentTheme().direction === themeDirectionOfReadingDirection;
        const isContinuousReadingModeActive = isContinuousReadingMode(readingMode);

        const isAtStartY = Math.abs(element.scrollTop) <= 1;
        const isAtEndY =
            Math.floor(element.scrollTop) === element.scrollHeight - element.clientHeight ||
            Math.ceil(element.scrollTop) === element.scrollHeight - element.clientHeight;
        const isAtStartX = Math.abs(element.scrollLeft) <= 1;
        const isAtEndX =
            element.scrollWidth - element.clientWidth - Math.floor(Math.abs(element.scrollLeft)) <= 1 ||
            element.scrollWidth - element.clientWidth - Math.ceil(Math.abs(element.scrollLeft)) <= 1;
        const isAtStartXForDirection = areReadingDirectionsEqual ? isAtStartX : isAtEndX;
        const isAtEndXForDirection = areReadingDirectionsEqual ? isAtEndX : isAtStartX;

        const scrollAmount = scrollAmountPercentage / 100;
        const scrollDirection = getScrollDirectionInvert(direction, offset, themeDirectionOfReadingDirection);

        const getNewScrollPosition = (currentPos: number, elementSize: number) =>
            currentPos + elementSize * scrollAmount * scrollDirection;

        getReaderOverlayStore().setIsVisible(false);
        setShowPreview(false);

        const doScroll = (
            isAtStartForDirection: boolean,
            isAtEndForDirection: boolean,
            scrollToOptions: ScrollToOptions,
        ) => {
            if (isAtStartForDirection && offset === ScrollOffset.BACKWARD && isContinuousReadingModeActive) {
                ReaderControls.openChapter('previous');
                return;
            }

            if (isAtEndForDirection && offset === ScrollOffset.FORWARD && isContinuousReadingModeActive) {
                ReaderControls.openChapter('next');
                return;
            }

            element.scroll({
                ...scrollToOptions,
                behavior: 'smooth',
            });
        };

        switch (direction) {
            case ScrollDirection.X:
                doScroll(isAtStartXForDirection, isAtEndXForDirection, {
                    left: getNewScrollPosition(element.scrollLeft, element.clientWidth),
                });
                break;
            case ScrollDirection.Y:
                doScroll(isAtStartY, isAtEndY, { top: getNewScrollPosition(element.scrollTop, element.clientHeight) });
                break;
            default:
                throw new Error(`Unexpected "ScrollDirection" (${direction})`);
        }
    }

    static openChapter(
        offset: 'previous' | 'next' | ChapterIdInfo['id'],
        doTransitionCheck: boolean = true,
        scrollIntoView: boolean = true,
    ): void {
        const {
            currentChapter,
            previousChapter,
            nextChapter,
            chapters,
            visibleChapters: { lastLeadingChapterSourceOrder, lastTrailingChapterSourceOrder },
            setReaderStateChapters,
        } = getReaderChaptersStore();
        const { shouldInformAboutMissingChapter, shouldInformAboutScanlatorChange, shouldUseInfiniteScroll } =
            getReaderSettingsStore();

        if (!currentChapter) {
            return;
        }

        const isSpecificChapterMode = typeof offset === 'number';
        const isPreviousOffset = offset === 'previous';

        const doesPreviousChapterExist = isPreviousOffset && !!previousChapter;
        const doesNextChapterExist = !isPreviousOffset && !!nextChapter;

        const canOpenNextChapter = isSpecificChapterMode || doesPreviousChapterExist || doesNextChapterExist;
        if (!canOpenNextChapter) {
            return;
        }

        const doOpenChapter = async () => {
            const chapterToOpen = (() => {
                if (isSpecificChapterMode) {
                    return chapters.find((chapter) => chapter.id === offset);
                }

                if (isPreviousOffset) {
                    return previousChapter;
                }

                return nextChapter;
            })();

            if (!chapterToOpen) {
                return;
            }

            const isPreviousChapter = chapterToOpen.sourceOrder < currentChapter.sourceOrder;

            try {
                if (doTransitionCheck) {
                    await ReaderControls.checkNextChapterConsistency(
                        isPreviousChapter ? 'previous' : 'next',
                        currentChapter,
                        chapterToOpen,
                        shouldInformAboutMissingChapter,
                        shouldInformAboutScanlatorChange,
                    );
                }

                const isAlreadyLoaded =
                    lastLeadingChapterSourceOrder <= chapterToOpen.sourceOrder &&
                    lastTrailingChapterSourceOrder >= chapterToOpen.sourceOrder;
                const keepRenderedChapters = shouldUseInfiniteScroll && (!scrollIntoView || isAlreadyLoaded);

                if (keepRenderedChapters) {
                    setReaderStateChapters((prevState) =>
                        updateReaderStateVisibleChapters(
                            isPreviousChapter,
                            prevState,
                            chapterToOpen.sourceOrder,
                            scrollIntoView,
                            isPreviousChapter ? false : undefined,
                            !isPreviousChapter ? false : undefined,
                        ),
                    );
                }

                ReaderService.navigateToChapter(chapterToOpen, {
                    resumeMode: getReaderOpenChapterResumeMode(
                        isSpecificChapterMode || !keepRenderedChapters,
                        isPreviousChapter,
                    ),
                    updateInitialChapter: !keepRenderedChapters,
                });
            } catch (error) {
                defaultPromiseErrorHandler('ReaderControls#useOpenChapter#doOpenChapter:')(error);
            }
        };

        doOpenChapter().catch(defaultPromiseErrorHandler('ReaderControls#useOpenChapter'));
    }

    private static async checkNextChapterConsistency(
        offset: 'previous' | 'next',
        currentChapter: TChapterReader | null | undefined,
        chapterToOpen: TChapterReader | null | undefined,
        shouldInformAboutMissingChapter: boolean,
        shouldInformAboutScanlatorChange: boolean,
    ): Promise<void> {
        if (!currentChapter || !chapterToOpen) {
            return;
        }

        const missingChapters = Chapters.getGap(currentChapter, chapterToOpen);
        const isSameScanlator =
            !shouldInformAboutScanlatorChange || currentChapter.scanlator === chapterToOpen.scanlator;
        const isContinuousChapter = !shouldInformAboutMissingChapter || !missingChapters;

        const showWarning = !isSameScanlator || !isContinuousChapter;
        if (!showWarning) {
            return;
        }

        const offsetToTranslationKeys: Record<typeof offset, Record<'scanlator' | 'chapter_number', TranslationKey>> = {
            previous: {
                scanlator: 'reader.chapter_transition.warning.previous.scanlator',
                chapter_number: 'reader.chapter_transition.warning.previous.chapter_number',
            },
            next: {
                scanlator: 'reader.chapter_transition.warning.next.scanlator',
                chapter_number: 'reader.chapter_transition.warning.next.chapter_number',
            },
        };

        const sameScanlator = isSameScanlator
            ? ''
            : translate(offsetToTranslationKeys[offset].scanlator, {
                  nextScanlator: chapterToOpen.scanlator,
                  currentScanlator: currentChapter.scanlator,
              });
        const continuousChapter = isContinuousChapter
            ? ''
            : translate(offsetToTranslationKeys[offset].chapter_number, {
                  count: missingChapters,
                  nextChapter: `#${chapterToOpen.chapterNumber} ${chapterToOpen.name}`,
                  currentChapter: `#${currentChapter.chapterNumber} ${currentChapter.name}`,
              });
        const warningLineBreak = !isSameScanlator && !isContinuousChapter ? '\n\n' : '';
        const warning = `${sameScanlator}${warningLineBreak}${continuousChapter}`;

        await Confirmation.show({
            title: translate('reader.chapter_transition.warning.title'),
            message: warning,
            actions: {
                confirm: {
                    title: translate('global.button.open'),
                },
            },
        });
    }

    static openPage(page: number | 'previous' | 'next', forceDirection?: Direction, hideOverlay: boolean = true): void {
        const { currentPageIndex, setPageToScrollToIndex, pages, transitionPageMode, setTransitionPageMode } =
            getReaderPagesStore();
        const { readingDirection, readingMode, shouldShowTransitionPage } = getReaderSettingsStore();

        const direction = READING_DIRECTION_TO_THEME_DIRECTION[readingDirection.value];

        const convertedPage = getOptionForDirection(
            page,
            page === 'previous' ? 'next' : 'previous',
            forceDirection ?? direction,
        );

        const currentPage = getPage(currentPageIndex, pages);
        const previousPageIndex = getNextPageIndex('previous', currentPage.pagesIndex, pages);
        const nextPageIndex = getNextPageIndex('next', currentPage.pagesIndex, pages);
        const indexOfFirstPage = getNextIndexFromPage(pages[0]);
        const indexOfLastPage = getNextIndexFromPage(pages[pages.length - 1]);

        const isFirstPage = currentPage.primary.index === 0;
        const isLastPage = currentPageIndex === indexOfLastPage;
        const isATransitionPageVisibleFlag = isATransitionPageVisible(transitionPageMode, readingMode.value);
        const isContinuousReadingModeActive = isContinuousReadingMode(readingMode.value);

        if (hideOverlay) {
            getReaderOverlayStore().setIsVisible(false);
            getReaderTapZoneStore().setShowPreview(false);
        }

        const hideTransitionPage = () => setTransitionPageMode(ReaderTransitionPageMode.NONE);

        if (typeof page === 'number') {
            setPageToScrollToIndex(page);
            hideTransitionPage();
            return;
        }

        const areContinuousPagerTransitionPagesVisible = isContinuousReadingModeActive && isATransitionPageVisibleFlag;
        const isPreviousTransitionPageVisible =
            (!isContinuousReadingModeActive && transitionPageMode === ReaderTransitionPageMode.PREVIOUS) ||
            areContinuousPagerTransitionPagesVisible;
        const isNextTransitionPageVisible =
            (!isContinuousReadingModeActive && transitionPageMode === ReaderTransitionPageMode.NEXT) ||
            areContinuousPagerTransitionPagesVisible;

        const shouldOpenPreviousChapter =
            isFirstPage &&
            (!shouldShowTransitionPage || isPreviousTransitionPageVisible) &&
            convertedPage === 'previous' &&
            !!getReaderChaptersStore().previousChapter;
        if (shouldOpenPreviousChapter) {
            ReaderControls.openChapter('previous');
            return;
        }

        const shouldOpenNextChapter =
            isLastPage &&
            (!shouldShowTransitionPage || isNextTransitionPageVisible) &&
            convertedPage === 'next' &&
            !!getReaderChaptersStore().nextChapter;
        if (shouldOpenNextChapter) {
            ReaderControls.openChapter('next');
            return;
        }

        const isPreviousMode = convertedPage === 'previous';
        const isNextMode = convertedPage === 'next';

        const closePreviousTransitionPage = isPreviousTransitionPageVisible && isNextMode;
        const closeNextTransitionPage = isNextTransitionPageVisible && isPreviousMode;

        const needToHideTransitionPage =
            isATransitionPageVisibleFlag &&
            !isContinuousReadingModeActive &&
            (closePreviousTransitionPage || closeNextTransitionPage);
        if (needToHideTransitionPage) {
            hideTransitionPage();
            setPageToScrollToIndex(isPreviousTransitionPageVisible ? indexOfFirstPage : indexOfLastPage);

            return;
        }

        const needToOpenTransitionPage =
            ((isFirstPage && isPreviousMode) || (isLastPage && isNextMode)) && !isContinuousReadingModeActive;
        if (needToOpenTransitionPage) {
            setTransitionPageMode(isPreviousMode ? ReaderTransitionPageMode.PREVIOUS : ReaderTransitionPageMode.NEXT);
            return;
        }

        setPageToScrollToIndex(isPreviousMode ? previousPageIndex : nextPageIndex);
    }

    static useUpdateCurrentPageIndex(): (
        pageIndex: number,
        debounceChapterUpdate?: boolean,
        endReached?: boolean,
    ) => void {
        const updateChapter = ReaderService.useUpdateChapter();
        const {
            settings: { downloadAheadLimit },
        } = useMetadataServerSettings();

        return useCallback(
            (pageIndex, debounceChapterUpdate = true, endReached = false) => {
                const { currentPageIndex, setCurrentPageIndex } = getReaderPagesStore();
                const {
                    currentChapter,
                    chapters,
                    previousChapter,
                    nextChapter,
                    visibleChapters,
                    setReaderStateChapters,
                } = getReaderChaptersStore();

                if (pageIndex === currentPageIndex && !endReached) {
                    return;
                }

                setCurrentPageIndex(pageIndex);

                if (!currentChapter) {
                    return;
                }

                const nextChapters = Chapters.getNextChapters(currentChapter, chapters, {
                    offset: DirectionOffset.NEXT,
                });

                const direction = currentPageIndex > pageIndex ? DirectionOffset.PREVIOUS : DirectionOffset.NEXT;

                ReaderService.downloadAhead(currentChapter, nextChapter, nextChapters, pageIndex, downloadAheadLimit);
                ReaderService.preloadChapter(
                    pageIndex,
                    currentChapter.pageCount,
                    direction === DirectionOffset.NEXT ? nextChapter : previousChapter,
                    visibleChapters.lastLeadingChapterSourceOrder,
                    visibleChapters.lastTrailingChapterSourceOrder,
                    setReaderStateChapters,
                    direction,
                );

                const handleCurrentPageIndexChange = () => {
                    const currentChapterUpToDate = getReaderChapterFromCache(currentChapter.id);
                    if (!currentChapterUpToDate) {
                        return;
                    }

                    const actualPageIndex = endReached ? currentChapterUpToDate.pageCount - 1 : pageIndex;
                    const isLastPage = actualPageIndex === currentChapterUpToDate.pageCount - 1;

                    updateChapter({
                        lastPageRead: actualPageIndex,
                        isRead: isLastPage ? true : undefined,
                    });
                };

                clearTimeout(ReaderControls.updateCurrentPageTimeout);
                if (debounceChapterUpdate) {
                    ReaderControls.updateCurrentPageTimeout = setTimeout(
                        handleCurrentPageIndexChange,
                        d(1).seconds.inWholeMilliseconds,
                    );
                    return;
                }

                handleCurrentPageIndexChange();
            },
            [downloadAheadLimit],
        );
    }

    static updateCurrentPageOnScroll(
        imageRefs: MutableRefObject<(HTMLElement | null)[]>,
        lastPageIndex: number,
        updateCurrentPageIndex: ReturnType<typeof ReaderControls.useUpdateCurrentPageIndex>,
        type: PageInViewportType,
        readingDirection: ReadingDirection,
    ) {
        const themeDirectionOfReadingDirection = READING_DIRECTION_TO_THEME_DIRECTION[readingDirection];
        // In case the reader navigation bar is static, the readers "viewport" x position gets moved, thus, this needs to be considered as a threshold.
        const scrollContainerX = getReaderStore().autoScroll.scrollRef?.current?.getBoundingClientRect().x ?? 0;
        const pageHorizontalEndInViewportThreshold = getOptionForDirection(
            scrollContainerX + 1,
            window.innerWidth + 1,
            themeDirectionOfReadingDirection,
        );

        const firstVisibleImageIndex = imageRefs.current.findIndex(
            (image) =>
                image &&
                isPageInViewport(image, type, {
                    truncateValues: true,
                    thresholds: {
                        bottom: 1,
                        left: getOptionForDirection(
                            0,
                            pageHorizontalEndInViewportThreshold,
                            themeDirectionOfReadingDirection,
                        ),
                        right: getOptionForDirection(
                            pageHorizontalEndInViewportThreshold,
                            0,
                            themeDirectionOfReadingDirection,
                        ),
                    },
                }),
        );
        const lastPage = imageRefs.current?.[imageRefs.current.length - 1];
        const isEndReached = lastPage && isEndOfPageInViewport(lastPage, type, readingDirection);

        if (firstVisibleImageIndex === -1) {
            return;
        }

        // handle cases where the last page is too small to ever be the "firstVisibleImageIndex"
        if (isEndReached) {
            updateCurrentPageIndex(firstVisibleImageIndex, false, true);
            return;
        }

        updateCurrentPageIndex(firstVisibleImageIndex, firstVisibleImageIndex !== lastPageIndex);
    }

    static handleClick(scrollElement: HTMLElement | null, e: React.MouseEvent<HTMLDivElement, MouseEvent>): void {
        if (!scrollElement) {
            return;
        }

        const { readingMode, readingDirection, isStaticNav, scrollAmount } = getReaderSettingsStore();

        const rect = e.currentTarget.getBoundingClientRect();
        const rectRelativeX = e.clientX - rect.left;
        const rectRelativeY = e.clientY - rect.top;
        const action = ReaderTapZoneService.getAction(rectRelativeX, rectRelativeY);

        getReaderTapZoneStore().setShowPreview(false);

        const isContinuousReadingModeActive = isContinuousReadingMode(readingMode.value);
        const scrollDirection =
            readingMode.value === ReadingMode.CONTINUOUS_HORIZONTAL ? ScrollDirection.X : ScrollDirection.Y;

        switch (action) {
            case TapZoneRegionType.MENU:
                getReaderOverlayStore().setIsVisible(isStaticNav || !getReaderOverlayStore().isVisible);
                break;
            case TapZoneRegionType.PREVIOUS:
            case TapZoneRegionType.NEXT:
                if (isContinuousReadingModeActive) {
                    ReaderControls.scroll(
                        action === TapZoneRegionType.PREVIOUS ? ScrollOffset.BACKWARD : ScrollOffset.FORWARD,
                        scrollDirection,
                        readingMode.value,
                        readingDirection.value,
                        scrollElement,
                        getReaderTapZoneStore().setShowPreview,
                        scrollAmount,
                    );
                } else {
                    ReaderControls.openPage(action === TapZoneRegionType.PREVIOUS ? 'previous' : 'next', 'ltr');
                }
                break;
            default:
                throw new Error(`Unexpected "TapZoneRegionType" (${action})`);
        }
    }

    static useHandleProgressDragging(
        progressBarRef: RefObject<HTMLDivElement | null>,
        isDragging: boolean,
        currentPage: TReaderProgressCurrentPage,
        pages: ReaderStatePages['pages'],
        progressBarPosition: ProgressBarPosition,
        getOptionForDirectionFn: typeof getOptionForDirection,
        fullSegmentClicks: boolean,
    ): void {
        useEffect(() => {
            if (!isDragging) {
                return () => undefined;
            }

            const { isHorizontal } = getProgressBarPositionInfo(progressBarPosition);

            const handleMove = (coordinates: { clientX: number; clientY: number }) => {
                if (!progressBarRef.current) {
                    return;
                }

                const newPageIndex = getNextIndexFromPage(
                    getPageForMousePos(
                        coordinates,
                        progressBarRef.current,
                        pages,
                        isHorizontal,
                        fullSegmentClicks,
                        getOptionForDirectionFn,
                    ),
                );

                const hasCurrentPageIndexChanged = getNextIndexFromPage(currentPage) !== newPageIndex;
                if (!hasCurrentPageIndexChanged) {
                    return;
                }

                ReaderControls.openPage(newPageIndex, undefined, false);
            };

            const handleMouseMove = (e: MouseEvent) => {
                handleMove(e);
            };

            const handleTouchMove = (e: TouchEvent) => {
                if (e.touches.length > 0) {
                    handleMove(e.touches[0]);
                }
            };

            document.addEventListener('mousemove', handleMouseMove, { passive: true });
            document.addEventListener('touchmove', handleTouchMove, { passive: true });

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('touchmove', handleTouchMove);
            };
        }, [isDragging, currentPage, pages, progressBarPosition]);
    }
}
