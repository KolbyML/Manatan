/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTheme } from '@mui/material/styles';
import { memo } from 'react';
import { BasePager } from '@/features/reader/viewer/pager/components/BasePager.tsx';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { IReaderSettings, ReaderPagerProps, ReadingDirection } from '@/features/reader/Reader.types.ts';
import { createReaderPage } from '@/features/reader/viewer/pager/ReaderPager.utils.tsx';

const BaseReaderHorizontalPager = ({
    onLoad,
    onError,
    pageLoadStates,
    retryFailedPagesKeyPrefix,
    isPreloadMode,
    ...props
}: ReaderPagerProps & Pick<IReaderSettings, 'pageGap' | 'readingDirection'>) => {
    const { currentPageIndex, totalPages, pageGap, readingDirection } = props;

    const { direction: themeDirection } = useTheme();

    const isLtrReadingDirection = readingDirection === ReadingDirection.LTR;

    return (
        <BasePager
            {...props}
            createPage={(page, pagesIndex, shouldLoad, _, setRef, ...baseProps) =>
                createReaderPage(
                    page,
                    pagesIndex,
                    true,
                    pageLoadStates[page.primary.index].loaded,
                    isPreloadMode,
                    onLoad,
                    onError,
                    shouldLoad || pageLoadStates[page.primary.index].loaded,
                    !isPreloadMode,
                    currentPageIndex,
                    totalPages,
                    ...baseProps,
                    pageLoadStates[page.primary.index].error ? retryFailedPagesKeyPrefix : undefined,
                    undefined,
                    undefined,
                    undefined,
                    setRef,
                )
            }
            slots={{
                boxProps: {
                    sx: {
                        my: 'auto',
                        display: 'flex',
                        flexWrap: 'nowrap',
                        alignItems: 'center',
                        gap: `${pageGap}px`,
                        ...applyStyles(themeDirection === 'ltr', {
                            flexDirection: isLtrReadingDirection ? 'row' : 'row-reverse',
                            justifyContent: isLtrReadingDirection ? 'flex-start' : 'flex-end',
                        }),
                        ...applyStyles(themeDirection === 'rtl', {
                            flexDirection: isLtrReadingDirection ? 'row-reverse' : 'row',
                            justifyContent: isLtrReadingDirection ? 'flex-end' : 'flex-start',
                        }),
                    },
                },
            }}
        />
    );
};

export const ReaderHorizontalPager = memo(BaseReaderHorizontalPager);
