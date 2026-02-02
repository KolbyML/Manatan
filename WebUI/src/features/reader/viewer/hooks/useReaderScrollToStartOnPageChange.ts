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
import { getScrollToXForReadingDirection } from '@/features/reader/viewer/pager/ReaderPager.utils.tsx';

export const useReaderScrollToStartOnPageChange = (
    currentPageIndex: ReaderStatePages['currentPageIndex'],
    isContinuousReadingModeActive: boolean,
    themeDirection: Direction,
    readingDirection: ReadingDirection,
    scrollElementRef: MutableRefObject<HTMLDivElement | null>,
): void => {
    useLayoutEffect(() => {
        if (!isContinuousReadingModeActive) {
            scrollElementRef.current?.scrollTo(
                getScrollToXForReadingDirection(scrollElementRef.current, themeDirection, readingDirection),
                0,
            );
        }
    }, [currentPageIndex]);
};
