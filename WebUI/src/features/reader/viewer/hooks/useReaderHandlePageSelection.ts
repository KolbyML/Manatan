/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { MutableRefObject, useLayoutEffect } from 'react';
import { Direction } from '@mui/material/styles';
import { ReaderStatePages, ReadingDirection } from '@/features/reader/Reader.types.ts';
import { getNextIndexFromPage, getPage } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.utils.tsx';
import { getScrollIntoViewInlineOption } from '@/features/reader/viewer/pager/ReaderPager.utils.tsx';
import { ReaderControls } from '@/features/reader/services/ReaderControls.ts';

export const useReaderHandlePageSelection = (
    pageToScrollToIndex: ReaderStatePages['pageToScrollToIndex'],
    pages: ReaderStatePages['pages'],
    totalPages: number,
    setPageToScrollToIndex: ReaderStatePages['setPageToScrollToIndex'],
    updateCurrentPageIndex: ReturnType<typeof ReaderControls.useUpdateCurrentPageIndex>,
    isContinuousReadingModeActive: boolean,
    imageRefs: MutableRefObject<(HTMLElement | null)[]>,
    themeDirection: Direction,
    readingDirection: ReadingDirection,
) => {
    useLayoutEffect(() => {
        if (pageToScrollToIndex == null) {
            return;
        }

        const pageToScrollTo = getPage(pageToScrollToIndex, pages);

        if (isContinuousReadingModeActive) {
            const imageRef = imageRefs.current[pageToScrollTo.pagesIndex];

            imageRef?.scrollIntoView({
                block: 'start',
                inline: getScrollIntoViewInlineOption(themeDirection, readingDirection),
            });
        }

        const newPageIndex = getNextIndexFromPage(pageToScrollTo);
        const isLastPage = newPageIndex === totalPages - 1;

        setPageToScrollToIndex(null);
        updateCurrentPageIndex(newPageIndex, !isLastPage, isLastPage);
    }, [pageToScrollToIndex]);
};
