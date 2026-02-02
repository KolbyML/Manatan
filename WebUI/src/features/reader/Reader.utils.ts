/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    ReaderPageSpreadState,
    ReaderResumeMode,
    ReaderStateChapters,
    ReaderStatePages,
    ReadingMode,
} from '@/features/reader/Reader.types.ts';
import { UpdateChapterPatchInput } from '@/lib/graphql/generated/graphql.ts';
import { ChapterIdInfo, TChapterReader } from '@/features/chapter/Chapter.types.ts';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { CHAPTER_READER_FIELDS } from '@/lib/graphql/chapter/ChapterFragments.ts';
import { isPageOfOutdatedPageLoadStates, isSpreadPage } from '@/features/reader/viewer/pager/ReaderPager.utils.tsx';
import { coerceIn } from '@/lib/HelperFunctions.ts';

import { DirectionOffset } from '@/base/Base.types.ts';

export const getInitialReaderPageIndex = (
    resumeMode: ReaderResumeMode,
    lastReadPageIndex: number,
    lastPageIndex: number,
): number => {
    if (resumeMode === ReaderResumeMode.START) {
        return 0;
    }

    if (resumeMode === ReaderResumeMode.END) {
        return lastPageIndex;
    }

    return coerceIn(lastReadPageIndex, 0, lastPageIndex);
};

export const getReaderChapterFromCache = (id: ChapterIdInfo['id']): TChapterReader | null =>
    Chapters.getFromCache<TChapterReader>(id, CHAPTER_READER_FIELDS, 'CHAPTER_READER_FIELDS')!;

export const getChapterIdsToDeleteForChapterUpdate = (
    chapter: TChapterReader,
    chapters: TChapterReader[],
    previousChapters: TChapterReader[],
    patch: UpdateChapterPatchInput,
    deleteChaptersWhileReading: number,
    deleteChaptersWithBookmark: boolean,
    shouldSkipDupChapters: boolean,
): TChapterReader['id'][] => {
    const isAutoDeletionEnabled = !!patch.isRead && !!deleteChaptersWhileReading;
    if (!isAutoDeletionEnabled) {
        return [];
    }

    const maybeChapterToDelete = [chapter, ...previousChapters][deleteChaptersWhileReading - 1];
    if (!maybeChapterToDelete) {
        return [];
    }

    const maybeChaptersToDelete = shouldSkipDupChapters
        ? Chapters.addDuplicates([maybeChapterToDelete], chapters)
        : [maybeChapterToDelete];
    const chaptersToDelete = maybeChaptersToDelete
        .map(({ id }) => getReaderChapterFromCache(id))
        .filter((chapterToDeleteUpToDateData) => chapterToDeleteUpToDateData !== null)
        .filter((chapterToDeleteUpToDateData) =>
            Chapters.isDeletable(chapterToDeleteUpToDateData, deleteChaptersWithBookmark),
        );

    if (!chaptersToDelete.length) {
        return [];
    }

    return Chapters.getIds(chaptersToDelete);
};

export const isInDownloadAheadRange = (
    currentPageIndex: number,
    pageCount: number,
    direction: DirectionOffset = DirectionOffset.NEXT,
): boolean => {
    const progress = (currentPageIndex + 1) / pageCount;

    if (direction === DirectionOffset.PREVIOUS) {
        return progress < 0.75;
    }

    return progress > 0.25;
};

export const getChapterIdsForDownloadAhead = (
    chapter: TChapterReader,
    nextChapter: TChapterReader | undefined,
    nextChapters: TChapterReader[],
    currentPageIndex: number,
    downloadAheadLimit: number,
): TChapterReader['id'][] => {
    const chapterUpToDateData = getReaderChapterFromCache(chapter.id);
    if (!chapterUpToDateData || !nextChapter) {
        return [];
    }

    const isDownloadAheadEnabled = !!downloadAheadLimit;
    const shouldCheckDownloadAhead =
        isDownloadAheadEnabled &&
        chapterUpToDateData.isDownloaded &&
        isInDownloadAheadRange(currentPageIndex, chapterUpToDateData.pageCount);
    if (!shouldCheckDownloadAhead) {
        return [];
    }

    const nextChapterUpToDateData = getReaderChapterFromCache(nextChapter.id);

    if (!nextChapterUpToDateData?.isDownloaded) {
        return [];
    }

    const unreadNextChaptersUpToDateData = Chapters.getNonRead(nextChapters)
        .map((unreadNextChapter) => getReaderChapterFromCache(unreadNextChapter.id))
        .filter((unreadNextChapterUpToDateData) => !!unreadNextChapterUpToDateData);

    return unreadNextChaptersUpToDateData
        .slice(-downloadAheadLimit)
        .filter((unreadNextChapter) => !unreadNextChapter.isDownloaded)
        .map((unreadUnDownloadedNextChapter) => unreadUnDownloadedNextChapter.id)
        .filter((id) => !Chapters.isDownloading(id));
};

export const createUpdateReaderPageLoadState =
    (
        actualPages: ReaderStatePages['pages'],
        setPagesToSpreadState: React.Dispatch<React.SetStateAction<ReaderPageSpreadState[]>>,
        setPageLoadStates: ReaderStatePages['setPageLoadStates'],
        readingMode: ReadingMode,
    ) =>
    (pagesIndex: number, url: string, isPrimary: boolean = true) => {
        if (pagesIndex > actualPages.length - 1) {
            return;
        }

        const page = actualPages[pagesIndex];
        const { index } = isPrimary ? page.primary : page.secondary!;

        if (readingMode === ReadingMode.DOUBLE_PAGE) {
            const img = new Image();
            img.onload = () => {
                const isSpreadPageFlag = isSpreadPage(img);
                if (!isSpreadPageFlag) {
                    return;
                }

                setPagesToSpreadState((prevState) => {
                    const pageSpreadState = prevState[index];

                    const isOfOutdatedSpreadState = pageSpreadState === undefined || pageSpreadState.url !== url;
                    if (isOfOutdatedSpreadState) {
                        return prevState;
                    }

                    if (pageSpreadState.isSpread === isSpreadPageFlag) {
                        return prevState;
                    }

                    return prevState.toSpliced(index, 1, { url, isSpread: isSpreadPageFlag });
                });
            };
            img.crossOrigin = 'anonymous';
            img.src = url;
        }

        setPageLoadStates((statePageLoadStates) => {
            const pageLoadState = statePageLoadStates[index];

            if (isPageOfOutdatedPageLoadStates(url, pageLoadState)) {
                return statePageLoadStates;
            }

            if (pageLoadState.loaded) {
                return statePageLoadStates;
            }

            return statePageLoadStates.toSpliced(index, 1, { url: pageLoadState.url, loaded: true });
        });
    };

export const getReaderOpenChapterResumeMode = (
    isSpecificChapterMode: boolean,
    isPreviousChapter: boolean,
): ReaderResumeMode | undefined => {
    if (!isSpecificChapterMode) {
        return undefined;
    }

    if (isPreviousChapter) {
        return ReaderResumeMode.END;
    }

    return ReaderResumeMode.START;
};

export const createHandleReaderPageLoadError =
    (setPageLoadStates: ReaderStatePages['setPageLoadStates']) => (pageIndex: number, url: string) => {
        setPageLoadStates((statePageLoadStates) => {
            const pageLoadState = statePageLoadStates[pageIndex];

            if (isPageOfOutdatedPageLoadStates(url, pageLoadState)) {
                return statePageLoadStates;
            }

            return statePageLoadStates.toSpliced(pageIndex, 1, {
                ...pageLoadState,
                loaded: false,
                error: true,
            });
        });
    };

export const updateReaderStateVisibleChapters = (
    isPreviousChapter: boolean,
    state: Omit<ReaderStateChapters, 'setReaderStateChapters'>,
    chapterToOpenSourceOrder: TChapterReader['sourceOrder'],
    scrollIntoView: boolean,
    isLeadingChapterPreloadMode?: boolean,
    isTrailingChapterPreloadMode?: boolean,
): Omit<ReaderStateChapters, 'setReaderStateChapters'> => {
    const { leading, trailing, lastLeadingChapterSourceOrder, lastTrailingChapterSourceOrder } = state.visibleChapters;

    const isNewLeadingChapter = isPreviousChapter && chapterToOpenSourceOrder < lastLeadingChapterSourceOrder;
    const isNewTrailingChapter = !isPreviousChapter && chapterToOpenSourceOrder > lastTrailingChapterSourceOrder;

    return {
        ...state,
        visibleChapters: {
            ...state.visibleChapters,
            leading: leading + Number(isNewLeadingChapter),
            trailing: trailing + Number(isNewTrailingChapter),
            lastLeadingChapterSourceOrder: isNewLeadingChapter
                ? chapterToOpenSourceOrder
                : lastLeadingChapterSourceOrder,
            lastTrailingChapterSourceOrder: isNewTrailingChapter
                ? chapterToOpenSourceOrder
                : lastTrailingChapterSourceOrder,
            isLeadingChapterPreloadMode:
                isLeadingChapterPreloadMode !== undefined
                    ? isLeadingChapterPreloadMode
                    : state.visibleChapters.isLeadingChapterPreloadMode,
            isTrailingChapterPreloadMode:
                isTrailingChapterPreloadMode !== undefined
                    ? isTrailingChapterPreloadMode
                    : state.visibleChapters.isTrailingChapterPreloadMode,
            scrollIntoView,
            resumeMode: isPreviousChapter ? ReaderResumeMode.END : ReaderResumeMode.START,
        },
    };
};

export const getReaderChapterViewerCurrentPageIndex = (
    currentPageIndex: number,
    chapter: TChapterReader,
    currentChapter: TChapterReader,
    isCurrentChapter: boolean,
    isCurrentChapterReady: boolean,
    isLeadingChapter: boolean,
    isTrailingChapter: boolean,
    visibleChapters: ReaderStateChapters['visibleChapters'],
): number => {
    if (isCurrentChapter) {
        if (isCurrentChapterReady) {
            return coerceIn(currentPageIndex, 0, chapter.pageCount - 1);
        }

        if (visibleChapters.scrollIntoView && visibleChapters.resumeMode !== undefined) {
            return getInitialReaderPageIndex(visibleChapters.resumeMode, 0, chapter.pageCount - 1);
        }

        if (isLeadingChapter) {
            return Math.max(0, chapter.pageCount - 1);
        }

        if (isTrailingChapter) {
            return 0;
        }
    }

    const isPreviousChapter = chapter.sourceOrder < currentChapter.sourceOrder;
    if (isPreviousChapter) {
        return Math.max(chapter.pageCount - 1, 0);
    }

    return 0;
};

export const getReaderChapterViewResumeMode = (
    isCurrentChapter: boolean,
    isInitialChapter: boolean,
    isLeadingChapter: boolean,
    isTrailingChapter: boolean,
    forcedResumeMode: ReaderResumeMode | undefined,
    resumeMode: ReaderResumeMode,
): ReaderResumeMode => {
    if (isCurrentChapter && forcedResumeMode !== undefined) {
        return forcedResumeMode;
    }

    if (isInitialChapter) {
        return resumeMode;
    }

    if (isLeadingChapter) {
        return ReaderResumeMode.END;
    }

    if (isTrailingChapter) {
        return ReaderResumeMode.START;
    }

    return ReaderResumeMode.START;
};

export const getPreviousNextChapterVisibility = (
    chapterIndex: number,
    chaptersToRender: TChapterReader[],
    visibleChapters: ReaderStateChapters['visibleChapters'],
): { previous: boolean; next: boolean } => {
    const isPreviousChapterLoaded = !!chaptersToRender[chapterIndex + 1];
    const isPreviousChapterLastLeadingChapter = chapterIndex + 1 >= chaptersToRender.length - 1;
    const isPreviousChapterPreloading =
        isPreviousChapterLastLeadingChapter && visibleChapters.isLeadingChapterPreloadMode;
    const isPreviousChapterVisible = isPreviousChapterLoaded && !isPreviousChapterPreloading;

    const isNextChapterLoaded = !!chaptersToRender[chapterIndex - 1];
    const isNextChapterLastTrailingChapter = chapterIndex - 1 <= 0;
    const isNextChapterPreloading = isNextChapterLastTrailingChapter && visibleChapters.isTrailingChapterPreloadMode;
    const isNextChapterVisible = isNextChapterLoaded && !isNextChapterPreloading;

    return {
        previous: isPreviousChapterVisible,
        next: isNextChapterVisible,
    };
};
