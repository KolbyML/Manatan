/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { memo } from 'react';
import { useReaderInfiniteScrollUpdateChapter } from '@/features/reader/infinite-scroll/useReaderInfiniteScrollUpdateChapter.ts';
import { ChapterIdInfo } from '@/features/chapter/Chapter.types.ts';

const BaseReaderInfiniteScrollUpdateChapter = ({
    chapterId,
    previousChapterId,
    nextChapterId,
    isPreviousChapterVisible,
    isCurrentChapter,
    isNextChapterVisible,
    imageWrapper,
    scrollElement,
}: {
    chapterId: ChapterIdInfo['id'];
    previousChapterId?: ChapterIdInfo['id'];
    nextChapterId?: ChapterIdInfo['id'];
    isPreviousChapterVisible: boolean;
    isCurrentChapter: boolean;
    isNextChapterVisible: boolean;
    imageWrapper: HTMLElement | null;
    scrollElement: HTMLElement | null;
}) => {
    useReaderInfiniteScrollUpdateChapter(
        'first',
        chapterId,
        previousChapterId,
        isCurrentChapter,
        isPreviousChapterVisible,
        imageWrapper,
        scrollElement,
    );
    useReaderInfiniteScrollUpdateChapter(
        'last',
        chapterId,
        nextChapterId,
        isCurrentChapter,
        isNextChapterVisible,
        imageWrapper,
        scrollElement,
    );

    return null;
};

export const ReaderInfiniteScrollUpdateChapter = memo(BaseReaderInfiniteScrollUpdateChapter);
