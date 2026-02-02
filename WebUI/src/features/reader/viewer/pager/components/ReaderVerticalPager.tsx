/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { memo } from 'react';
import { BasePager } from '@/features/reader/viewer/pager/components/BasePager.tsx';
import { ReaderPagerProps, ReadingMode } from '@/features/reader/Reader.types.ts';
import { createReaderPage } from '@/features/reader/viewer/pager/ReaderPager.utils.tsx';

const BaseReaderVerticalPager = ({
    onLoad,
    onError,
    pageLoadStates,
    retryFailedPagesKeyPrefix,
    isPreloadMode,
    ...props
}: ReaderPagerProps) => {
    const { currentPageIndex, totalPages, readingMode, pageGap } = props;

    const isWebtoonMode = readingMode === ReadingMode.WEBTOON;
    const actualPageGap = isWebtoonMode ? 0 : pageGap;

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
                    page.primary.index !== 0 ? actualPageGap : 0,
                    setRef,
                )
            }
            slots={{ boxProps: { sx: { margin: 'auto' } } }}
        />
    );
};

export const ReaderVerticalPager = memo(BaseReaderVerticalPager);
