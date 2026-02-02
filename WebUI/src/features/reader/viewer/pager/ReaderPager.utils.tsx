/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Direction, Theme } from '@mui/material/styles';
import { ComponentProps, ReactNode } from 'react';
import {
    IReaderSettings,
    PageInViewportType,
    ReaderPageScaleMode,
    ReaderPageSpreadState,
    ReaderStatePages,
    ReaderTransitionPageMode,
    ReadingDirection,
    ReadingMode,
} from '@/features/reader/Reader.types.ts';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import {
    getSetReaderWidth,
    isContinuousReadingMode,
    isContinuousVerticalReadingMode,
    shouldApplyReaderWidth,
} from '@/features/reader/settings/ReaderSettings.utils.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { ReaderPage } from '@/features/reader/viewer/components/ReaderPage.tsx';
import { reverseString } from '@/base/utils/Strings.ts';
import { getPage } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.utils.tsx';
import { getOptionForDirection } from '@/features/theme/services/ThemeCreator.ts';
import { READING_DIRECTION_TO_THEME_DIRECTION } from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { coerceIn } from '@/lib/HelperFunctions.ts';
import { NavbarContextType } from '@/features/navigation-bar/NavigationBar.types.ts';

type CSSObject = ReturnType<Theme['applyStyles']>;

const getPageWidthPercentage = (
    pageScaleMode: IReaderSettings['pageScaleMode'],
    isDoublePage: boolean,
    readerWidth: IReaderSettings['readerWidth'],
    isImage: boolean,
): number => {
    if (shouldApplyReaderWidth(readerWidth, pageScaleMode)) {
        const width = readerWidth.value;
        if (isImage && isDoublePage) {
            return width / 100 / 2;
        }

        return width / 100;
    }

    if (isImage && isDoublePage) {
        return 0.5;
    }

    return 1;
};

export const getImagePlaceholderStyling = (
    readingMode: IReaderSettings['readingMode'],
    shouldStretchPage: IReaderSettings['shouldStretchPage'],
    pageScaleMode: IReaderSettings['pageScaleMode'],
    readerWidth: IReaderSettings['readerWidth'],
    widthOffset: number,
    heightOffset: number,
    isDoublePage?: boolean,
    isTabletWidth?: boolean,
): CSSObject => {
    const OVER_9000 = 9000;

    const getMaxWidth = (width: string) => `calc(${width} - ${widthOffset}px)`;
    const getDesktopWidth = (width: number, readerWidthValue?: number) =>
        getMaxWidth(`${coerceIn(readerWidthValue ?? width, Math.min(width, readerWidthValue ?? OVER_9000), width)}vw`);

    const setReaderWidth = getSetReaderWidth(readerWidth, pageScaleMode);
    const fullWidth = getMaxWidth(`${Math.min(100, setReaderWidth ?? OVER_9000)}vw`);
    const fullHeight = `calc(100dvh - ${heightOffset}px)`;

    const DEFAULT_SINGLE_PAGE_WIDTH = isTabletWidth ? fullWidth : getDesktopWidth(40, setReaderWidth);
    const DEFAULT_SINGLE_PAGE_HEIGHT = isTabletWidth ? fullHeight : '85vh';

    const READING_MODE_TO_PLACEHOLDER_SIZE: Record<ReadingMode, { minWidth: string; minHeight: string }> = {
        [ReadingMode.SINGLE_PAGE]: { minWidth: DEFAULT_SINGLE_PAGE_WIDTH, minHeight: DEFAULT_SINGLE_PAGE_HEIGHT },
        [ReadingMode.DOUBLE_PAGE]: {
            minWidth: isTabletWidth ? '50vw' : getDesktopWidth(35, setReaderWidth ? setReaderWidth / 2 : undefined),
            minHeight: DEFAULT_SINGLE_PAGE_HEIGHT,
        },
        [ReadingMode.CONTINUOUS_VERTICAL]: {
            minWidth: DEFAULT_SINGLE_PAGE_WIDTH,
            minHeight: '100dvh',
        },
        [ReadingMode.CONTINUOUS_HORIZONTAL]: {
            minWidth: DEFAULT_SINGLE_PAGE_WIDTH,
            minHeight: DEFAULT_SINGLE_PAGE_HEIGHT,
        },
        [ReadingMode.WEBTOON]: {
            minWidth: DEFAULT_SINGLE_PAGE_WIDTH,
            minHeight: '100dvh',
        },
    };
    const defaultStyling = {
        ...READING_MODE_TO_PLACEHOLDER_SIZE[readingMode],
        // the SpinnerImage placeholder has a default height of 100%, this causes the placeholder to take always take up 100% of the viewport
        height: 'unset',
    };
    const minWidthForStretch = isDoublePage ? `calc(${getMaxWidth(`${setReaderWidth ?? 100}vw`)} / 2)` : fullWidth;

    switch (pageScaleMode) {
        case ReaderPageScaleMode.WIDTH:
            return {
                ...defaultStyling,
                ...applyStyles(shouldStretchPage, {
                    minWidth: minWidthForStretch,
                }),
            };
        case ReaderPageScaleMode.HEIGHT:
            return {
                ...defaultStyling,
                ...applyStyles(shouldStretchPage, {
                    minHeight: fullHeight,
                    ...applyStyles(isContinuousVerticalReadingMode(readingMode), {
                        minHeight: '100dvh',
                    }),
                }),
            };
        case ReaderPageScaleMode.SCREEN:
            return {
                ...defaultStyling,
                ...applyStyles(shouldStretchPage, {
                    minWidth: minWidthForStretch,
                    minHeight: fullHeight,
                    ...applyStyles(isContinuousVerticalReadingMode(readingMode), {
                        minHeight: '100dvh',
                    }),
                }),
            };
        case ReaderPageScaleMode.ORIGINAL:
            return {
                ...defaultStyling,
                ...applyStyles(isContinuousVerticalReadingMode(readingMode), {
                    height: undefined,
                }),
            };
        default:
            throw new Error(`Unexpected "PageScaleMode" (${pageScaleMode})`);
    }
};

const getReaderDimensionStyling = (
    widthPercentage: number,
    readingMode: IReaderSettings['readingMode'],
    shouldStretchPage: IReaderSettings['shouldStretchPage'],
    pageScaleMode: IReaderSettings['pageScaleMode'],
    widthOffset: number,
    heightOffset: number,
): CSSObject => {
    const fullWidth = `calc((100vw - ${widthOffset}px) * ${widthPercentage})`;
    const fullHeight = `calc(100dvh - ${heightOffset}px)`;

    switch (pageScaleMode) {
        case ReaderPageScaleMode.WIDTH:
            return {
                minWidth: 0,
                ...applyStyles(isContinuousReadingMode(readingMode), {
                    minWidth: 'unset',
                }),
                ...applyStyles(shouldStretchPage, {
                    minWidth: fullWidth,
                }),
                maxWidth: fullWidth,
            };
        case ReaderPageScaleMode.HEIGHT:
            return {
                minHeight: 0,
                ...applyStyles(isContinuousReadingMode(readingMode), {
                    minHeight: 'unset',
                }),
                ...applyStyles(shouldStretchPage, {
                    minHeight: fullHeight,
                }),
                maxHeight: fullHeight,
            };
        case ReaderPageScaleMode.SCREEN:
            return {
                minWidth: 0,
                minHeight: 0,
                ...applyStyles(isContinuousReadingMode(readingMode), {
                    minWidth: 'unset',
                    minHeight: 'unset',
                }),
                ...applyStyles(shouldStretchPage, {
                    minWidth: fullWidth,
                    minHeight: fullHeight,
                    ...applyStyles(readingMode === ReadingMode.CONTINUOUS_HORIZONTAL, {
                        minWidth: 'unset',
                        minHeight: fullHeight,
                    }),
                    ...applyStyles(isContinuousVerticalReadingMode(readingMode), {
                        minWidth: fullWidth,
                        minHeight: 'unset',
                    }),
                }),
                maxWidth: fullWidth,
                maxHeight: fullHeight,
            };
        case ReaderPageScaleMode.ORIGINAL:
            return {};
        default:
            throw new Error(`Unexpected "PageScaleMode" (${pageScaleMode})`);
    }
};

export const getReaderImageStyling = (
    readingMode: IReaderSettings['readingMode'],
    shouldStretchPage: IReaderSettings['shouldStretchPage'],
    pageScaleMode: IReaderSettings['pageScaleMode'],
    isDoublePage: boolean,
    readerWidth: IReaderSettings['readerWidth'],
    widthOffset: number,
    heightOffset: number,
): CSSObject => {
    const widthPercentage = getPageWidthPercentage(pageScaleMode, isDoublePage, readerWidth, true);
    return getReaderDimensionStyling(
        widthPercentage,
        readingMode,
        shouldStretchPage,
        pageScaleMode,
        widthOffset,
        heightOffset,
    );
};

export const getImageMarginStyling = (doublePage: boolean, objectFitPosition?: 'left' | 'right'): CSSObject => ({
    m: 'auto',
    ...applyStyles(doublePage, {
        // the margin on the object fit position needs to be removed so that there is no space between both images
        ...applyStyles(objectFitPosition === 'right', { mr: 'unset ' }),
        ...applyStyles(objectFitPosition === 'left', { ml: 'unset ' }),
    }),
});

export const createSinglePageData = (url: string, index: number): ReaderStatePages['pages'][number]['primary'] => ({
    index,
    alt: `Page #${index + 1}`,
    url: `${requestManager.getBaseUrl()}${url}`,
});

export const createPageData = (url: string, index: number): ReaderStatePages['pages'][number] => ({
    name: `${index + 1}`,
    primary: createSinglePageData(url, index),
});

export const createPagesData = (pageUrls: string[]): ReaderStatePages['pages'] => pageUrls.map(createPageData);

const getPageDownloadPriority = (
    currentPageIndex: number,
    pageIndex: number,
    totalPages: number,
    isLoaded: boolean,
    shouldLoad: boolean,
    isPreloadMode: boolean,
): number => {
    if (isLoaded || !shouldLoad || isPreloadMode) {
        return Number.MAX_SAFE_INTEGER;
    }

    const distanceToCurrentPage = Math.abs(pageIndex - currentPageIndex);
    const priorityBasedOnDistance = totalPages - distanceToCurrentPage;

    const isPreviousPage = pageIndex < currentPageIndex;
    if (isPreviousPage) {
        return priorityBasedOnDistance - 1;
    }

    return priorityBasedOnDistance;
};

export const createReaderPage = (
    { primary: { index, alt, url } }: ReaderStatePages['pages'][number],
    pagesIndex: number,
    isPrimaryPage: boolean,
    isLoaded: boolean,
    isPreloadMode: boolean,
    onLoad: ComponentProps<typeof ReaderPage>['onLoad'],
    onError: ComponentProps<typeof ReaderPage>['onError'],
    shouldLoad: boolean,
    display: boolean,
    currentPageIndex: number,
    totalPages: number,
    readingMode: IReaderSettings['readingMode'],
    customFilter: IReaderSettings['customFilter'],
    pageScaleMode: IReaderSettings['pageScaleMode'],
    shouldStretchPage: IReaderSettings['shouldStretchPage'],
    readerWidth: IReaderSettings['readerWidth'],
    readerNavBarWidth: NavbarContextType['readerNavBarWidth'],
    retryKeyPrefix?: string,
    position?: 'left' | 'right',
    isDoublePage?: boolean,
    marginTop?: number,
    setRef?: (pagesIndex: number, ref: HTMLElement | null) => void,
): ReactNode => (
    <ReaderPage
        setRef={setRef}
        pageIndex={index}
        pagesIndex={pagesIndex}
        isPrimaryPage={isPrimaryPage}
        key={url}
        src={url}
        alt={alt}
        display={display}
        priority={getPageDownloadPriority(currentPageIndex, index, totalPages, isLoaded, shouldLoad, isPreloadMode)}
        position={position}
        onLoad={onLoad}
        onError={onError}
        doublePage={isDoublePage}
        shouldLoad={shouldLoad}
        retryKeyPrefix={retryKeyPrefix}
        marginTop={marginTop}
        isLoaded={isLoaded}
        readingMode={readingMode}
        customFilter={customFilter}
        pageScaleMode={pageScaleMode}
        shouldStretchPage={shouldStretchPage}
        readerWidth={readerWidth}
        readerNavBarWidth={readerNavBarWidth}
    />
);

type InViewportThresholds = {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
};
type InViewportOptions = {
    /**
     * The pages aren't always properly scrolled to the start/end (e.g., via scrollIntoView) which results in a side to be slightly
     * visible (e.g. 0.0123px) breaking the visibility detection
     */
    truncateValues?: boolean;
    /**
     * Thresholds are not considered for the detection of an image filling the whole viewport.
     * They are only used for detecting if a specific side of an image is inside the viewport
     */
    thresholds?: InViewportThresholds;
};
const getIsPageInViewportInfo = (
    element: HTMLElement,
    { truncateValues, thresholds: argThresholds }: InViewportOptions = { truncateValues: false, thresholds: {} },
): {
    isLeftInViewport: boolean;
    isRightInViewport: boolean;
    isFillingWidthViewportCompletely: boolean;
    isTopInViewport: boolean;
    isBottomInViewport: boolean;
    isFillingHeightViewportCompletely: boolean;
} => {
    const { top: topRaw, bottom: bottomRaw, left: leftRaw, right: rightRaw } = element.getBoundingClientRect();

    const maybeTruncateValue = (value: number): number => (truncateValues ? Math.trunc(value) : value);
    const top = maybeTruncateValue(topRaw);
    const bottom = maybeTruncateValue(bottomRaw);
    const left = maybeTruncateValue(leftRaw);
    const right = maybeTruncateValue(rightRaw);

    const thresholds = {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        ...argThresholds,
    };

    const isLeftInViewport = left >= thresholds.left && left <= window.innerWidth;
    const isRightInViewport = right >= thresholds.right && right <= window.innerWidth;
    const isFillingWidthViewportCompletely = left <= 0 && right >= window.innerWidth;

    const isTopInViewport = top >= thresholds.top && top <= window.innerHeight;
    const isBottomInViewport = bottom >= thresholds.bottom && bottom <= window.innerHeight;
    const isFillingHeightViewportCompletely = top <= 0 && bottom >= window.innerHeight;

    return {
        isLeftInViewport,
        isRightInViewport,
        isFillingWidthViewportCompletely,
        isTopInViewport,
        isBottomInViewport,
        isFillingHeightViewportCompletely,
    };
};

export const isPageInViewport = (
    element: HTMLElement,
    type: PageInViewportType,
    options?: InViewportOptions,
): boolean => {
    const {
        isLeftInViewport,
        isRightInViewport,
        isFillingWidthViewportCompletely,
        isTopInViewport,
        isBottomInViewport,
        isFillingHeightViewportCompletely,
    } = getIsPageInViewportInfo(element, options);

    const isInViewportX = isLeftInViewport || isRightInViewport || isFillingWidthViewportCompletely;
    const isInViewportY = isTopInViewport || isBottomInViewport || isFillingHeightViewportCompletely;

    switch (type) {
        case PageInViewportType.X:
            return isInViewportX;
        case PageInViewportType.Y:
            return isInViewportY;
        default:
            throw new Error(`unexpected "type" (${type})`);
    }
};

export const isEndOfPageInViewport = (
    element: HTMLElement,
    type: PageInViewportType,
    direction: ReadingDirection,
): boolean => {
    const { isLeftInViewport, isRightInViewport, isBottomInViewport } = getIsPageInViewportInfo(element);

    switch (type) {
        case PageInViewportType.X:
            return direction === ReadingDirection.LTR ? isRightInViewport : isLeftInViewport;
        case PageInViewportType.Y:
            return isBottomInViewport;
        default:
            throw new Error(`unexpected "type" (${type})`);
    }
};

export const getDoublePageModePages = (
    pageUrls: ReaderStatePages['pageUrls'],
    pagesToSpreadState: ReaderPageSpreadState[],
    shouldOffsetDoubleSpreads: IReaderSettings['shouldOffsetDoubleSpreads'],
    direction: ReadingDirection,
): ReaderStatePages['pages'] => {
    const doublePageModePages: ReaderStatePages['pages'] = [];

    // each spread page has to be counted as 2 pages and all trailing page numbers have to be increased by the count
    // of leading spread pages
    const pageToActualPageIndex = pagesToSpreadState.map(
        (_, page) => page + pagesToSpreadState.slice(0, page).filter(({ isSpread }) => isSpread).length,
    );

    pageUrls.forEach((url, index) => {
        /*

        | = page separator
        + = double page
        _ = double spread

        without double spreads:
         without double spread offset: | 0 + 1 | 2 + 3 | 4 + 5 | 6 + 7 |   8   |
         with double spread offset   : |   0   | 1 + 2 | 3 + 4 | 5 + 6 | 7 + 8 |

        with double spreads
          to handle double spreads:
           each double spread has to count as 2 pages, thus, each page number after a double spread has to increase
           by the number of leading double spreads

         without double spread offset: | 0 + 1 |   2   | _3/4_ |   5   | 6 + 7 |   8    | _9/10_  |   11    | 12 + 13 | 14 |
         with double spread offset   : |   0   | 1 + 2 | _3/4_ | 5 + 6 | 7 + 8 | _9/10_ | 11 + 12 | 13 + 14 |

         thus, to get the second page:
          without offset: second page = current page number even ? +1 : -1
          with offset   : second page = current page number even ? -1 : +1

          the second page has to be ignored in case:
           - double spreads are offset, and the current page is the first page
           - either the current or second page is a double spread
         */

        const normalizedIndex = pageToActualPageIndex[index];
        const isCurrentPageEven = !(normalizedIndex % 2);

        const secondPageOffset = (() => {
            const invert = shouldOffsetDoubleSpreads ? -1 : 1;
            const offset = isCurrentPageEven ? 1 : -1;

            return offset * invert;
        })();

        const secondPageIndex = index + secondPageOffset;

        const isPrimaryPage = index < secondPageIndex;
        const isFirstPage = index === 0;
        const isLastPage = index === pageUrls.length - 1;
        const hasSecondPage = isPrimaryPage && !isLastPage;

        const isPrimaryPageSpreadPage = pagesToSpreadState[index].isSpread;
        const isSecondPageSpreadPage = !!pagesToSpreadState[secondPageIndex]?.isSpread;
        const hasSpreadPage = isPrimaryPageSpreadPage || isSecondPageSpreadPage;

        const ignoreSecondPageDueToOffset = isFirstPage && shouldOffsetDoubleSpreads;
        const displaySecondPage = !hasSpreadPage && !ignoreSecondPageDueToOffset;

        if (!isPrimaryPage && displaySecondPage) {
            const doublePageModePage = doublePageModePages[doublePageModePages.length - 1];

            doublePageModePages[doublePageModePages.length - 1] = {
                ...doublePageModePage,
                secondary: createSinglePageData(url, index),
            };
            return;
        }

        const SEPARATOR = '-';
        const pageName = `${index + 1}${hasSecondPage && displaySecondPage ? `${SEPARATOR}${secondPageIndex + 1}` : ''}`;

        doublePageModePages.push({
            name: direction === ReadingDirection.LTR ? pageName : reverseString(pageName, SEPARATOR),
            primary: createSinglePageData(url, index),
        });
    });

    return doublePageModePages;
};

export const isSpreadPage = (image: HTMLImageElement): boolean => {
    const aspectRatio = image.height / image.width;
    return aspectRatio < 1;
};

const MIN_PREVIOUS_NEXT_CHAPTER_IMAGE_LOAD_AMOUNT = 0;
const MAX_PREVIOUS_NEXT_CHAPTER_IMAGE_LOAD_AMOUNT = 1;
const getImagePreLoadAmount = (
    isCurrentChapter: boolean,
    isPreviousChapter: boolean,
    isNextChapter: boolean,
    imagePreLoadAmount: number,
): number => {
    if (isCurrentChapter) {
        return imagePreLoadAmount;
    }

    if (isPreviousChapter || isNextChapter) {
        return coerceIn(
            MAX_PREVIOUS_NEXT_CHAPTER_IMAGE_LOAD_AMOUNT,
            MIN_PREVIOUS_NEXT_CHAPTER_IMAGE_LOAD_AMOUNT,
            imagePreLoadAmount,
        );
    }

    return 0;
};

const PREVIOUS_IMAGE_LOAD_AMOUNT = 2;
export const getPageIndexesToLoad = (
    currentPageIndex: number,
    pages: ReaderStatePages['pages'],
    previousCurrentPageIndex: number,
    imagePreLoadAmount: number,
    readingMode: ReadingMode,
    isCurrentChapter: boolean,
    isPreviousChapter: boolean,
    isNextChapter: boolean,
): number[] => {
    if (!isCurrentChapter && !isPreviousChapter && !isNextChapter) {
        return [];
    }

    const currentPagesIndex = getPage(currentPageIndex, pages).pagesIndex;
    const finalImagePreLoadAmount = getImagePreLoadAmount(
        isCurrentChapter,
        isPreviousChapter,
        isNextChapter,
        imagePreLoadAmount,
    );

    const directionInvert = previousCurrentPageIndex <= currentPageIndex && !isPreviousChapter ? 1 : -1;
    // load at most PREVIOUS_IMAGE_LOAD_AMOUNT of the previous pages to ensure that you do not have to wait too long
    // when going back to the previous pages
    const startPagesIndexTrailingIncluded = Math.max(
        0,
        currentPagesIndex - Math.min(PREVIOUS_IMAGE_LOAD_AMOUNT, finalImagePreLoadAmount) * directionInvert,
    );
    // do not load previous pages for continuous pagers to prevent layout shifts due to leading pages getting loaded
    const startPagesIndex = !isContinuousReadingMode(readingMode) ? startPagesIndexTrailingIncluded : currentPageIndex;
    const endPagesIndex = currentPagesIndex + finalImagePreLoadAmount * directionInvert;
    // add 1 for the current page in case it's the current chapter, otherwise, only the preload amount should get rendered
    const pagesToRenderLength = Math.max(1, Math.abs(endPagesIndex - startPagesIndex) + Number(isCurrentChapter));

    return Array(pagesToRenderLength)
        .fill(1)
        .map((_, index) => startPagesIndex + index * directionInvert);
};

export const isTransitionPageVisible = (
    type: ReaderTransitionPageMode,
    activeMode: ReaderTransitionPageMode,
    readingMode: IReaderSettings['readingMode'],
): boolean => [ReaderTransitionPageMode.BOTH, type].includes(activeMode) || isContinuousReadingMode(readingMode);

export const isATransitionPageVisible = (activeMode: ReaderTransitionPageMode, readingMode: ReadingMode): boolean =>
    activeMode !== ReaderTransitionPageMode.NONE || isContinuousReadingMode(readingMode);

export const getScrollIntoViewInlineOption = (
    themeDirection: Direction,
    readingDirection: ReadingDirection,
): ScrollIntoViewOptions['inline'] => {
    const themeDirectionForReadingDirection = READING_DIRECTION_TO_THEME_DIRECTION[readingDirection];

    if (themeDirection === 'ltr') {
        return getOptionForDirection('start', 'end', themeDirectionForReadingDirection);
    }

    return getOptionForDirection('end', 'start', themeDirectionForReadingDirection);
};

export const getScrollToXForReadingDirection = (
    element: HTMLElement,
    themeDirection: Direction,
    readingDirection: ReadingDirection,
): number => {
    const themeDirectionForReadingDirection = READING_DIRECTION_TO_THEME_DIRECTION[readingDirection];

    if (themeDirection === 'ltr') {
        return getOptionForDirection(0, element.scrollWidth, themeDirectionForReadingDirection);
    }

    return getOptionForDirection(-element.scrollWidth, 0, themeDirectionForReadingDirection);
};

export const isPageOfOutdatedPageLoadStates = (
    url: string,
    pageLoadState: ReaderStatePages['pageLoadStates'][number] | undefined,
): boolean => pageLoadState === undefined || pageLoadState.url !== url;
