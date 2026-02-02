/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { NamedExoticComponent, RefAttributes } from 'react';
import {
    IReaderSettings,
    IReaderSettingsWithDefaultFlag,
    ProgressBarPosition,
    ProgressBarPositionAutoVertical,
    ReaderPagerProps,
    ReaderPageScaleMode,
    ReadingMode,
} from '@/features/reader/Reader.types.ts';
import { MangaGenreInfo, MangaSourceLngInfo, MangaSourceNameInfo } from '@/features/manga/Manga.types.ts';
import { Mangas } from '@/features/manga/services/Mangas.ts';
import { ReaderPagedPager } from '@/features/reader/viewer/pager/components/ReaderPagedPager.tsx';
import { ReaderDoublePagedPager } from '@/features/reader/viewer/pager/components/ReaderDoublePagedPager.tsx';
import { ReaderVerticalPager } from '@/features/reader/viewer/pager/components/ReaderVerticalPager.tsx';
import { ReaderHorizontalPager } from '@/features/reader/viewer/pager/components/ReaderHorizontalPager.tsx';

export const isOffsetDoubleSpreadPagesEditable = (readingMode: IReaderSettings['readingMode']): boolean =>
    readingMode === ReadingMode.DOUBLE_PAGE;

export const isReaderWidthEditable = (pageScaleMode: ReaderPageScaleMode): boolean =>
    [ReaderPageScaleMode.WIDTH, ReaderPageScaleMode.SCREEN].includes(pageScaleMode);

export const isWidthPageScaleMode = (pageScaleMode: ReaderPageScaleMode) => isReaderWidthEditable(pageScaleMode);

export const isHeightPageScaleMode = (pageScaleMode: ReaderPageScaleMode): boolean =>
    [ReaderPageScaleMode.HEIGHT, ReaderPageScaleMode.SCREEN].includes(pageScaleMode);

export const shouldApplyReaderWidth = (
    readerWidth: IReaderSettings['readerWidth'] | undefined,
    pageScaleMode: IReaderSettings['pageScaleMode'],
): boolean => !!readerWidth?.enabled && isReaderWidthEditable(pageScaleMode);

export const getSetReaderWidth = (
    readerWidth: IReaderSettings['readerWidth'] | undefined,
    pageScaleMode: IReaderSettings['pageScaleMode'],
): number | undefined => {
    if (!shouldApplyReaderWidth(readerWidth, pageScaleMode)) {
        return undefined;
    }

    return readerWidth?.value;
};

export const isContinuousReadingMode = (readingMode: IReaderSettings['readingMode']): boolean =>
    [ReadingMode.CONTINUOUS_VERTICAL, ReadingMode.CONTINUOUS_HORIZONTAL, ReadingMode.WEBTOON].includes(readingMode);

export const isContinuousVerticalReadingMode = (readingMode: IReaderSettings['readingMode']): boolean =>
    [ReadingMode.CONTINUOUS_VERTICAL, ReadingMode.WEBTOON].includes(readingMode);

export const isAutoWebtoonMode = (
    manga: MangaGenreInfo & MangaSourceNameInfo & MangaSourceLngInfo,
    shouldUseAutoWebtoonMode: IReaderSettings['shouldUseAutoWebtoonMode'],
    readingMode: IReaderSettingsWithDefaultFlag['readingMode'],
): boolean => shouldUseAutoWebtoonMode && readingMode.isDefault && Mangas.isLongStripType(manga);

export const getPagerForReadingMode = (
    readingMode: ReadingMode,
): NamedExoticComponent<ReaderPagerProps & RefAttributes<HTMLDivElement>> => {
    switch (readingMode) {
        case ReadingMode.SINGLE_PAGE:
            return ReaderPagedPager;
        case ReadingMode.DOUBLE_PAGE:
            return ReaderDoublePagedPager;
        case ReadingMode.CONTINUOUS_VERTICAL:
        case ReadingMode.WEBTOON:
            return ReaderVerticalPager;
        case ReadingMode.CONTINUOUS_HORIZONTAL:
            return ReaderHorizontalPager;
        default:
            throw new Error(`Unexpected "ReadingMode" (${readingMode})`);
    }
};

export const getProgressBarPosition = (
    progressBarPosition: ProgressBarPosition,
    progressBarPositionAutoVertical: keyof typeof ProgressBarPositionAutoVertical,
    offsetY: number = 0,
    offsetX: number = 0,
): Exclude<ProgressBarPosition, ProgressBarPosition.AUTO> => {
    if (progressBarPosition !== ProgressBarPosition.AUTO) {
        return progressBarPosition;
    }

    const isVerticalSpaceLarger = window.innerHeight - offsetY > window.innerWidth - offsetX;

    if (isVerticalSpaceLarger) {
        return progressBarPositionAutoVertical;
    }

    return ProgressBarPosition.BOTTOM;
};
