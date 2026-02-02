/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { TReaderProgressCurrentPage } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.types.ts';
import { getOptionForDirection as getOptionForDirectionImpl } from '@/features/theme/services/ThemeCreator.ts';
import { ProgressBarPosition, ReaderStatePages } from '@/features/reader/Reader.types.ts';
import { coerceIn } from '@/lib/HelperFunctions.ts';

export const getPage = (pageIndex: number, pages: ReaderStatePages['pages']): TReaderProgressCurrentPage => {
    const pagesIndex = pages.findIndex(({ primary, secondary }) =>
        [primary.index, secondary?.index].includes(pageIndex),
    );
    const page = pages[coerceIn(pagesIndex, 0, pages.length - 1)];
    return {
        ...page,
        pagesIndex,
    };
};

/**
 * for the double page mode the secondary page index has to be used to be able to correctly detect if the last page is visible
 *
 */
export const getNextIndexFromPage = (page: ReaderStatePages['pages'][number]) =>
    page.secondary?.index ?? page.primary.index;

export const getNextPageIndex = (
    offset: 'previous' | 'next',
    pagesIndex: number,
    pages: ReaderStatePages['pages'],
): number => {
    switch (offset) {
        case 'previous':
            return getNextIndexFromPage(pages[Math.max(0, pagesIndex - 1)]);
        case 'next':
            return getNextIndexFromPage(pages[Math.min(pages.length - 1, pagesIndex + 1)]);
        default:
            throw new Error(`Unexpected offset "${offset}"`);
    }
};

export const getPageForMousePos = (
    coordinates: { clientX: number; clientY: number },
    element: HTMLElement,
    pages: ReaderStatePages['pages'],
    isHorizontalPosition: boolean,
    fullSegmentClicks: boolean,
    getOptionForDirection: typeof getOptionForDirectionImpl,
): ReaderStatePages['pages'][number] => {
    const pos = isHorizontalPosition ? coordinates.clientX : coordinates.clientY;

    const { paddingTop, paddingBottom, paddingLeft, paddingRight } = getComputedStyle(element);
    const elementRect = element.getBoundingClientRect();
    const padding = isHorizontalPosition
        ? parseFloat(paddingLeft) + parseFloat(paddingRight)
        : parseFloat(paddingTop) + parseFloat(paddingBottom);

    const rectPos = isHorizontalPosition ? elementRect.left : elementRect.top;
    const rectSizeWithPadding = isHorizontalPosition ? elementRect.width : elementRect.height;
    const rectSize = rectSizeWithPadding - padding;

    const mousePosRelativeToProgressBar = pos - rectPos - padding / 2;

    const totalPages = pages.length - Number(!fullSegmentClicks);

    const segmentWidth = rectSize / totalPages;
    const clickedSegmentIndex = Math.floor(mousePosRelativeToProgressBar / segmentWidth);
    const segmentMiddlePoint = (clickedSegmentIndex + (fullSegmentClicks ? 1 : 0.5)) * segmentWidth;
    const actualClickedSegmentIndex =
        mousePosRelativeToProgressBar <= segmentMiddlePoint ? clickedSegmentIndex : clickedSegmentIndex + 1;

    const minPageIndex = Math.max(0, actualClickedSegmentIndex);
    const maxPageIndex = Math.min(minPageIndex, pages.length - 1);
    const newPageIndex = getOptionForDirection(maxPageIndex, pages.length - 1 - maxPageIndex);

    return pages[newPageIndex];
};

export const getProgressBarPositionInfo = (
    position: ProgressBarPosition,
): {
    isBottom: boolean;
    isLeft: boolean;
    isRight: boolean;
    isHorizontal: boolean;
    isVertical: boolean;
} => {
    const isBottom = position === ProgressBarPosition.BOTTOM;
    const isLeft = position === ProgressBarPosition.LEFT;
    const isRight = position === ProgressBarPosition.RIGHT;
    const isHorizontal = isBottom;
    const isVertical = isLeft || isRight;

    return {
        isBottom,
        isLeft,
        isRight,
        isHorizontal,
        isVertical,
    };
};
