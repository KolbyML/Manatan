/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { memo, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import Box, { BoxProps } from '@mui/material/Box';
import { getPageIndexesToLoad, isATransitionPageVisible } from '@/features/reader/viewer/pager/ReaderPager.utils.tsx';
import {
    IReaderSettings,
    ReaderPagerProps,
    ReaderResumeMode,
    ReaderStatePages,
    ReaderTransitionPageMode,
} from '@/features/reader/Reader.types.ts';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { isContinuousReadingMode } from '@/features/reader/settings/ReaderSettings.utils.tsx';

const getPreviousCurrentPageIndex = (resumeMode: ReaderResumeMode): number =>
    resumeMode === ReaderResumeMode.END ? Number.MAX_SAFE_INTEGER : -1;

const BaseBasePager = ({
    currentPageIndex,
    pages,
    transitionPageMode,
    imageRefs,
    createPage,
    slots,
    readingMode,
    imagePreLoadAmount,
    isCurrentChapter,
    isPreviousChapter,
    isNextChapter,
    customFilter,
    pageScaleMode,
    shouldStretchPage,
    readerWidth,
    readerNavBarWidth,
    resumeMode,
    handleAsInitialRender,
    ref,
}: Omit<ReaderPagerProps, 'pageLoadStates' | 'retryFailedPagesKeyPrefix' | 'isPreloadMode'> &
    Pick<IReaderSettings, 'readingMode' | 'imagePreLoadAmount'> & {
        createPage: (
            page: ReaderStatePages['pages'][number],
            pagesIndex: number,
            shouldLoad: boolean,
            shouldDisplay: boolean,
            setRef: (pagesIndex: number, element: HTMLElement | null) => void,
            readingMode: ReaderPagerProps['readingMode'],
            customFilter: ReaderPagerProps['customFilter'],
            pageScaleMode: ReaderPagerProps['pageScaleMode'],
            shouldStretchPage: ReaderPagerProps['shouldStretchPage'],
            readerWidth: ReaderPagerProps['readerWidth'],
            readerNavBarWidth: ReaderPagerProps['readerNavBarWidth'],
        ) => ReactNode;
        slots?: { boxProps?: BoxProps };
    }) => {
    const previousCurrentPageIndex = useRef(getPreviousCurrentPageIndex(resumeMode));

    if (handleAsInitialRender) {
        previousCurrentPageIndex.current = getPreviousCurrentPageIndex(resumeMode);
    }

    const pagesIndexesToRender = useMemo(
        () =>
            getPageIndexesToLoad(
                currentPageIndex,
                pages,
                previousCurrentPageIndex.current,
                imagePreLoadAmount,
                readingMode,
                isCurrentChapter,
                isPreviousChapter,
                isNextChapter,
            ),
        [currentPageIndex, pages, imagePreLoadAmount, readingMode, isCurrentChapter, isPreviousChapter, isNextChapter],
    );
    useEffect(() => {
        if (isCurrentChapter) {
            previousCurrentPageIndex.current = currentPageIndex;
        }
    }, [pagesIndexesToRender, isCurrentChapter]);

    const setRef = useCallback(
        (pagesIndex: number, element: HTMLElement | null) => {
            // eslint-disable-next-line no-param-reassign
            imageRefs.current[pagesIndex] = element;
        },
        [imageRefs],
    );

    return (
        <Box
            ref={ref}
            {...slots?.boxProps}
            sx={[
                {
                    width: 'fit-content',
                    height: 'fit-content',
                },
                ...(Array.isArray(slots?.boxProps?.sx) ? (slots?.boxProps?.sx ?? []) : [slots?.boxProps?.sx]),
                // hide pager, without actually unmounting it to prevent re-renders, while a chapter transition page is taking up the full screen
                applyStyles(
                    !isContinuousReadingMode(readingMode) && isATransitionPageVisible(transitionPageMode, readingMode),
                    {
                        visibility: 'hidden',
                        width: 0,
                        height: 0,
                        m: 0,
                        p: 0,
                    },
                ),
            ]}
        >
            {pages.map((page, pagesIndex) =>
                createPage(
                    page,
                    pagesIndex,
                    pagesIndexesToRender.includes(pagesIndex),
                    [ReaderTransitionPageMode.NONE, ReaderTransitionPageMode.BOTH].includes(transitionPageMode),
                    setRef,
                    readingMode,
                    customFilter,
                    pageScaleMode,
                    shouldStretchPage,
                    readerWidth,
                    readerNavBarWidth,
                ),
            )}
        </Box>
    );
};

export const BasePager = memo(BaseBasePager);
