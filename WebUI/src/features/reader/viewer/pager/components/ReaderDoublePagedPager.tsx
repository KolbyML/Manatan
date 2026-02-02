/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Direction, useTheme } from '@mui/material/styles';
import { Fragment, memo, useMemo } from 'react';
import { BasePager } from '@/features/reader/viewer/pager/components/BasePager.tsx';
import {
    IReaderSettings,
    ReaderPagerProps,
    ReaderPageScaleMode,
    ReadingDirection,
} from '@/features/reader/Reader.types.ts';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { createReaderPage } from '@/features/reader/viewer/pager/ReaderPager.utils.tsx';
import { getNextIndexFromPage, getPage } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.utils.tsx';

const getPagePosition = (
    pageType: 'first' | 'second',
    themeDirection: Direction,
    readingDirection: ReadingDirection,
): 'left' | 'right' => {
    const isLtrReadingDirection = readingDirection === ReadingDirection.LTR;

    if (pageType === 'first') {
        if (themeDirection === 'ltr') {
            return isLtrReadingDirection ? 'right' : 'left';
        }

        return isLtrReadingDirection ? 'left' : 'right';
    }

    if (themeDirection === 'ltr') {
        return isLtrReadingDirection ? 'left' : 'right';
    }

    return isLtrReadingDirection ? 'right' : 'left';
};

const BaseReaderDoublePagedPager = ({
    onLoad,
    onError,
    pageLoadStates,
    retryFailedPagesKeyPrefix,
    isPreloadMode,
    ...props
}: ReaderPagerProps & Pick<IReaderSettings, 'readingDirection' | 'pageScaleMode'>) => {
    const { currentPageIndex, pages, totalPages, readingDirection, pageScaleMode } = props;

    const { direction: themeDirection } = useTheme();

    const currentPage = useMemo(() => getPage(currentPageIndex, pages), [currentPageIndex, pages]);
    const isLtrReadingDirection = readingDirection === ReadingDirection.LTR;

    return (
        <BasePager
            {...props}
            createPage={(page, pagesIndex, shouldLoad, shouldDisplay, _setRef, ...baseProps) => {
                const { primary, secondary } = page;

                const currentSecondaryPageIndex = getNextIndexFromPage(currentPage);

                const hasSecondaryPage = !!secondary;
                const isPrimaryPage = currentPage.primary.index === primary.index;
                const isSecondaryPage = !!secondary && currentSecondaryPageIndex === secondary.index;

                return (
                    <Fragment key={`${primary.url}_${secondary?.url}`}>
                        {createReaderPage(
                            page,
                            pagesIndex,
                            true,
                            pageLoadStates[primary.index].loaded,
                            isPreloadMode,
                            onLoad,
                            onError,
                            shouldLoad,
                            shouldDisplay && isPrimaryPage && shouldLoad,
                            currentPage.primary.index,
                            totalPages,
                            ...baseProps,
                            pageLoadStates[primary.index].error ? retryFailedPagesKeyPrefix : undefined,
                            hasSecondaryPage ? getPagePosition('first', themeDirection, readingDirection) : undefined,
                            hasSecondaryPage,
                        )}
                        {hasSecondaryPage &&
                            createReaderPage(
                                { ...page, primary: { ...page.secondary! } },
                                pagesIndex,
                                false,
                                pageLoadStates[secondary.index].loaded,
                                isPreloadMode,
                                onLoad,
                                onError,
                                shouldLoad,
                                shouldDisplay && isSecondaryPage && shouldLoad,
                                currentSecondaryPageIndex,
                                totalPages,
                                ...baseProps,
                                pageLoadStates[secondary.index].error ? retryFailedPagesKeyPrefix : undefined,
                                getPagePosition('second', themeDirection, readingDirection),
                                true,
                            )}
                    </Fragment>
                );
            }}
            slots={{
                boxProps: {
                    sx: {
                        ...applyStyles(pageScaleMode === ReaderPageScaleMode.ORIGINAL, {
                            margin: 'auto',
                        }),
                        width: '100%',
                        minWidth: 'fit-content',
                        height: '100%',
                        minHeight: 'fit-content',
                        display: 'flex',
                        flexDirection: 'row',
                        flexWrap: 'nowrap',
                        ...applyStyles(themeDirection === 'ltr', {
                            flexDirection: isLtrReadingDirection ? 'row' : 'row-reverse',
                        }),
                        ...applyStyles(themeDirection === 'rtl', {
                            flexDirection: isLtrReadingDirection ? 'row-reverse' : 'row',
                        }),
                    },
                },
            }}
        />
    );
};

export const ReaderDoublePagedPager = memo(BaseReaderDoublePagedPager);
