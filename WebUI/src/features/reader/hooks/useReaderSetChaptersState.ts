/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { GetChaptersReaderQuery } from '@/lib/graphql/generated/graphql.ts';
import {
    IReaderSettings,
    ReaderOpenChapterLocationState,
    ReaderStateChapters,
} from '@/features/reader/Reader.types.ts';
import { filterChapters } from '@/features/chapter/utils/ChapterList.util.tsx';
import { ChapterListOptions } from '@/features/chapter/Chapter.types.ts';
import { getReaderChapterFromCache } from '@/features/reader/Reader.utils.ts';
import { DirectionOffset } from '@/base/Base.types.ts';
import { getReaderChaptersStore } from '@/features/reader/stores/ReaderStore.ts';

import { READER_DEFAULT_CHAPTERS_STATE } from '@/features/reader/stores/ReaderChaptersStore.ts';

export const useReaderSetChaptersState = (
    chaptersResponse: ReturnType<typeof requestManager.useGetMangaChapters<GetChaptersReaderQuery>>,
    chapterSourceOrder: number,
    mangaChapters: ReaderStateChapters['mangaChapters'],
    initialChapter: ReaderStateChapters['initialChapter'],
    chapterForDuplicatesHandling: ReaderStateChapters['chapterForDuplicatesHandling'],
    shouldSkipDupChapters: IReaderSettings['shouldSkipDupChapters'],
    shouldSkipFilteredChapters: IReaderSettings['shouldSkipFilteredChapters'],
    chapterListOptions: ChapterListOptions,
) => {
    const navigate = useNavigate();
    const locationState = useLocation<ReaderOpenChapterLocationState>().state;

    const { updateInitialChapter } = locationState ?? {};
    const finalInitialChapter = updateInitialChapter ? undefined : initialChapter;

    useEffect(() => {
        const newMangaChapters = chaptersResponse.data?.chapters.nodes;
        const newCurrentChapter = newMangaChapters
            ? (newMangaChapters[newMangaChapters.length - chapterSourceOrder] ?? null)
            : undefined;
        const newInitialChapter = finalInitialChapter ?? newCurrentChapter;
        const newChapterForDuplicatesHandling = chapterForDuplicatesHandling ?? newCurrentChapter;

        const visibleChapters = (() => {
            if (!newMangaChapters || !newChapterForDuplicatesHandling) {
                return [];
            }

            const filteredChapters = shouldSkipFilteredChapters
                ? filterChapters(mangaChapters ?? newMangaChapters, chapterListOptions)
                : newMangaChapters;
            const uniqueChapters = shouldSkipDupChapters
                ? Chapters.removeDuplicates(newChapterForDuplicatesHandling, filteredChapters)
                : filteredChapters;

            return uniqueChapters.map((chapter) => getReaderChapterFromCache(chapter.id)!);
        })();
        const nextChapter =
            newCurrentChapter &&
            Chapters.getNextChapter(newCurrentChapter, visibleChapters, {
                offset: DirectionOffset.NEXT,
            });
        const previousChapter =
            newCurrentChapter &&
            Chapters.getNextChapter(newCurrentChapter, visibleChapters, {
                offset: DirectionOffset.PREVIOUS,
            });

        const hasInitialChapterChanged = newInitialChapter != null && newInitialChapter.id !== finalInitialChapter?.id;

        if (hasInitialChapterChanged) {
            navigate('', { replace: true, state: { ...locationState, updateInitialChapter: undefined } });
        }

        getReaderChaptersStore().setReaderStateChapters((prevState) => {
            const hasCurrentChapterChanged = newCurrentChapter?.id !== prevState.currentChapter?.id;

            return {
                ...prevState,
                mangaChapters: prevState.mangaChapters ?? newMangaChapters,
                chapters: visibleChapters,
                initialChapter: newInitialChapter,
                chapterForDuplicatesHandling: newChapterForDuplicatesHandling,
                currentChapter: newCurrentChapter,
                nextChapter,
                previousChapter,
                isCurrentChapterReady: hasCurrentChapterChanged ? false : prevState.isCurrentChapterReady,
                visibleChapters: hasInitialChapterChanged
                    ? {
                          ...READER_DEFAULT_CHAPTERS_STATE.chapters.visibleChapters,
                          lastLeadingChapterSourceOrder:
                              newInitialChapter?.sourceOrder ??
                              READER_DEFAULT_CHAPTERS_STATE.chapters.visibleChapters.lastLeadingChapterSourceOrder,
                          lastTrailingChapterSourceOrder:
                              newInitialChapter?.sourceOrder ??
                              READER_DEFAULT_CHAPTERS_STATE.chapters.visibleChapters.lastTrailingChapterSourceOrder,
                          isLeadingChapterPreloadMode: false,
                          isTrailingChapterPreloadMode: false,
                          // do not set "scrollIntoView" to "true" for the initial render
                          scrollIntoView: !!prevState.initialChapter,
                      }
                    : prevState.visibleChapters,
            };
        });
    }, [
        chaptersResponse.data?.chapters.nodes,
        chapterSourceOrder,
        shouldSkipDupChapters,
        shouldSkipFilteredChapters,
        finalInitialChapter,
        chapterListOptions,
    ]);
};
