/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { t as translate } from 'i18next';
import { DocumentNode, MaybeMasked, Unmasked, useFragment } from '@apollo/client';
import { makeToast } from '@/base/utils/Toast.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { getMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import {
    ChapterListFieldsFragment,
    ChapterType,
    DownloadState,
    DownloadTypeFieldsFragment,
} from '@/lib/graphql/generated/graphql.ts';
import { CHAPTER_LIST_FIELDS } from '@/lib/graphql/chapter/ChapterFragments.ts';

import { MangaIdInfo } from '@/features/manga/Manga.types.ts';
import { ReaderOpenChapterLocationState, ReaderResumeMode } from '@/features/reader/Reader.types.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { DOWNLOAD_TYPE_FIELDS } from '@/lib/graphql/download/DownloadFragments.ts';
import { epochToDate, getDateString } from '@/base/utils/DateHelper.ts';
import {
    CHAPTER_ACTION_TO_CONFIRMATION_REQUIRED,
    CHAPTER_ACTION_TO_TRANSLATION,
} from '@/features/chapter/Chapter.constants.ts';
import {
    ChapterAction,
    ChapterBookmarkInfo,
    ChapterDownloadInfo,
    ChapterIdInfo,
    ChapterMangaInfo,
    ChapterNumberInfo,
    ChapterReadInfo,
    ChapterScanlatorInfo,
    ChapterSourceOrderInfo,
} from '@/features/chapter/Chapter.types.ts';
import { assertIsDefined } from '@/base/Asserts.ts';
import { DirectionOffset } from '@/base/Base.types.ts';
import { Confirmation } from '@/base/AppAwaitableComponent.ts';

export class Chapters {
    static getIds(chapters: { id: number }[]): number[] {
        return chapters.map((chapter) => chapter.id);
    }

    static getFromCache<T = ChapterListFieldsFragment>(
        id: number,
        fragment: DocumentNode = CHAPTER_LIST_FIELDS,
        fragmentName: string = 'CHAPTER_LIST_FIELDS',
    ): Unmasked<T> | null {
        return requestManager.graphQLClient.client.cache.readFragment<T>({
            id: requestManager.graphQLClient.client.cache.identify({
                __typename: 'ChapterType',
                id,
            }),
            fragment,
            fragmentName,
        });
    }

    static getDownloadStatusFromCache<T = DownloadTypeFieldsFragment>(
        id: number,
        fragment: DocumentNode = DOWNLOAD_TYPE_FIELDS,
        fragmentName: string = 'DOWNLOAD_TYPE_FIELDS',
    ): Unmasked<T> | null {
        return requestManager.graphQLClient.client.cache.readFragment<T>({
            id: requestManager.graphQLClient.client.cache.identify({
                __typename: 'DownloadType',
                chapter: {
                    __ref: requestManager.graphQLClient.client.cache.identify({ __typename: 'ChapterType', id }),
                },
            }),
            fragment,
            fragmentName,
        });
    }

    static useDownloadStatusFromCache<T = DownloadTypeFieldsFragment>(
        id: number,
        fragment: DocumentNode = DOWNLOAD_TYPE_FIELDS,
        fragmentName: string = 'DOWNLOAD_TYPE_FIELDS',
    ): MaybeMasked<T> | null {
        const downloadStatus = useFragment<T>({
            from: {
                __typename: 'DownloadType',
                chapter: {
                    __ref: requestManager.graphQLClient.client.cache.identify({ __typename: 'ChapterType', id }),
                },
            },
            fragment,
            fragmentName,
            client: requestManager.graphQLClient.client,
        });

        if (!downloadStatus.complete || !Object.keys(downloadStatus.data ?? {}).length) {
            return null;
        }

        return downloadStatus.data;
    }

    static getReaderUrl<Chapter extends ChapterMangaInfo & ChapterSourceOrderInfo>(chapter: Chapter): string {
        return AppRoutes.reader.path(chapter.mangaId, chapter.sourceOrder);
    }

    static isDownloading(id: number): boolean {
        const activeDownloadStates = [DownloadState.Downloading, DownloadState.Queued];
        const downloadStatus = Chapters.getDownloadStatusFromCache(id);

        return activeDownloadStates.includes(downloadStatus?.state as DownloadState);
    }

    static isDownloaded({ isDownloaded }: ChapterDownloadInfo): boolean {
        return isDownloaded;
    }

    static getDownloaded<Chapter extends ChapterDownloadInfo>(chapters: Chapter[]): Chapter[] {
        return chapters.filter(Chapters.isDownloaded);
    }

    static isDownloadable<Chapter extends ChapterIdInfo & ChapterDownloadInfo>(chapter: Chapter): boolean {
        const downloadStatus = Chapters.getDownloadStatusFromCache(chapter.id);
        return !Chapters.isDownloaded(chapter) && (!downloadStatus || downloadStatus.state === DownloadState.Error);
    }

    static getDownloadable<Chapter extends ChapterIdInfo & ChapterDownloadInfo>(chapters: Chapter[]): Chapter[] {
        return chapters.filter(this.isDownloadable);
    }

    static isDeletable(
        { isBookmarked, ...chapter }: ChapterDownloadInfo & ChapterBookmarkInfo,
        canDeleteBookmarked: boolean = false,
    ): boolean {
        return Chapters.isDownloaded(chapter) && (!isBookmarked || canDeleteBookmarked);
    }

    static getDeletable<Chapters extends ChapterDownloadInfo & ChapterBookmarkInfo>(
        chapters: Chapters[],
        canDeleteBookmarked?: boolean,
    ): Chapters[] {
        return chapters.filter((chapter) => Chapters.isDeletable(chapter, canDeleteBookmarked));
    }

    static isBookmarked({ isBookmarked }: ChapterBookmarkInfo): boolean {
        return isBookmarked;
    }

    static getBookmarked<Chapter extends ChapterBookmarkInfo>(chapters: Chapter[]): Chapter[] {
        return chapters.filter(Chapters.isBookmarked);
    }

    static getNonBookmarked<Chapter extends ChapterBookmarkInfo>(chapters: Chapter[]): Chapter[] {
        return chapters.filter((chapter) => !Chapters.isBookmarked(chapter));
    }

    static isRead({ isRead }: ChapterReadInfo): boolean {
        return isRead;
    }

    static getRead<Chapter extends ChapterReadInfo>(chapters: Chapter[]): Chapter[] {
        return chapters.filter(Chapters.isRead);
    }

    static getNonRead<Chapter extends ChapterReadInfo>(chapters: Chapter[]): Chapter[] {
        return chapters.filter((chapter) => !Chapters.isRead(chapter));
    }

    static getMatchingChapterNumberChapters<Chapter extends ChapterNumberInfo>(
        chaptersA: Chapter[],
        chaptersB: Chapter[],
    ): [ChapterA: Chapter, ChapterB: Chapter][] {
        return chaptersA
            .map((chapterA) => {
                const matchingChapter = chaptersB.find((chapterB) => chapterA.chapterNumber === chapterB.chapterNumber);

                if (!matchingChapter) {
                    return null;
                }

                return [chapterA, matchingChapter];
            })
            .filter((matchingChapters): matchingChapters is [Chapter, Chapter] => matchingChapters !== null);
    }

    static async download(chapterIds: number[], disableConfirmation?: boolean): Promise<void> {
        return Chapters.executeAction(
            'download',
            chapterIds.length,
            () => requestManager.addChaptersToDownloadQueue(chapterIds).response,
            disableConfirmation,
        );
    }

    static async delete(chapterIds: number[], disableConfirmation?: boolean): Promise<void> {
        return Chapters.executeAction(
            'delete',
            chapterIds.length,
            () => requestManager.deleteDownloadedChapters(chapterIds).response,
            disableConfirmation,
        );
    }

    static async markAsRead(
        chapters: (ChapterIdInfo & ChapterDownloadInfo & ChapterBookmarkInfo)[],
        wasManuallyMarkedAsRead: boolean = false,
        trackProgressMangaId?: MangaIdInfo['id'],
        disableConfirmation?: boolean,
    ): Promise<void> {
        const { deleteChaptersManuallyMarkedRead, deleteChaptersWithBookmark, updateProgressManualMarkRead } =
            await getMetadataServerSettings();
        const chapterIdsToDelete =
            deleteChaptersManuallyMarkedRead && wasManuallyMarkedAsRead
                ? Chapters.getIds(Chapters.getDeletable(chapters, deleteChaptersWithBookmark))
                : [];
        return Chapters.executeAction(
            'mark_as_read',
            chapters.length,
            () =>
                requestManager.updateChapters(Chapters.getIds(chapters), {
                    isRead: true,
                    lastPageRead: 0,
                    chapterIdsToDelete,
                    trackProgressMangaId:
                        updateProgressManualMarkRead && wasManuallyMarkedAsRead ? trackProgressMangaId : undefined,
                }).response,
            disableConfirmation,
        );
    }

    static async markAsUnread(chapterIds: number[], disableConfirmation?: boolean): Promise<void> {
        return Chapters.executeAction(
            'mark_as_unread',
            chapterIds.length,
            () => requestManager.updateChapters(chapterIds, { isRead: false }).response,
            disableConfirmation,
        );
    }

    static async bookmark(chapterIds: number[]): Promise<void> {
        return Chapters.executeAction(
            'bookmark',
            chapterIds.length,
            () => requestManager.updateChapters(chapterIds, { isBookmarked: true }).response,
        );
    }

    static async unBookmark(chapterIds: number[]): Promise<void> {
        return Chapters.executeAction(
            'unbookmark',
            chapterIds.length,
            () => requestManager.updateChapters(chapterIds, { isBookmarked: false }).response,
        );
    }

    private static async executeAction(
        action: ChapterAction,
        itemCount: number,
        fnToExecute: () => Promise<unknown>,
        disableConfirmation?: boolean,
    ): Promise<void> {
        const { always, bulkAction, bulkActionCountForce } = CHAPTER_ACTION_TO_CONFIRMATION_REQUIRED[action];
        const requiresConfirmation =
            (!disableConfirmation && (always || (bulkAction && itemCount > 1))) ||
            (bulkActionCountForce && itemCount >= bulkActionCountForce);
        const confirmationMessage = CHAPTER_ACTION_TO_TRANSLATION[action].confirmation;

        try {
            if (requiresConfirmation) {
                assertIsDefined(confirmationMessage);

                try {
                    await Confirmation.show({
                        title: translate('global.label.are_you_sure'),
                        message: translate(confirmationMessage, { count: itemCount }),
                        actions: {
                            confirm: {
                                title: translate('global.button.ok'),
                            },
                        },
                    });
                } catch (_) {
                    return;
                }
            }

            await fnToExecute();
            makeToast(translate(CHAPTER_ACTION_TO_TRANSLATION[action].success, { count: itemCount }), 'success');
        } catch (e) {
            makeToast(
                translate(CHAPTER_ACTION_TO_TRANSLATION[action].error, { count: itemCount }),
                'error',
                getErrorMessage(e),
            );
            throw e;
        }
    }

    static async performAction<Action extends ChapterAction>(
        action: Action,
        chapterIds: number[],
        {
            wasManuallyMarkedAsRead,
            trackProgressMangaId,
            chapters,
        }: Action extends 'mark_as_read'
            ? {
                  wasManuallyMarkedAsRead: boolean;
                  trackProgressMangaId?: MangaIdInfo['id'];
                  chapters: (ChapterIdInfo & ChapterDownloadInfo & ChapterBookmarkInfo & ChapterReadInfo)[];
              }
            : {
                  wasManuallyMarkedAsRead?: never;
                  trackProgressMangaId?: never;
                  chapters?: never;
              },
    ): Promise<void> {
        switch (action) {
            case 'download':
                return Chapters.download(chapterIds);
            case 'delete':
                return Chapters.delete(chapterIds);
            case 'mark_as_read':
                return Chapters.markAsRead(chapters!, wasManuallyMarkedAsRead!, trackProgressMangaId);
            case 'mark_as_unread':
                return Chapters.markAsUnread(chapterIds);
            case 'bookmark':
                return Chapters.bookmark(chapterIds);
            case 'unbookmark':
                return Chapters.unBookmark(chapterIds);
            default:
                throw new Error(`Chapters::performAction: unknown action "${action}"`);
        }
    }

    /**
     * Returns the provided "uniqueChapters" plus their duplicates found in "allChapters"
     */
    static addDuplicates<T extends ChapterScanlatorInfo & ChapterNumberInfo>(
        uniqueChapters: T[],
        allChapters: T[],
    ): T[] {
        const chapterNumberToChapters = Object.groupBy(allChapters, ({ chapterNumber }) => chapterNumber);

        return uniqueChapters
            .map((uniqueChapter) => chapterNumberToChapters[uniqueChapter.chapterNumber] ?? [uniqueChapter])
            .flat();
    }

    static removeDuplicates<T extends ChapterIdInfo & ChapterScanlatorInfo & ChapterNumberInfo>(
        currentChapter: T,
        chapters: T[],
    ): T[] {
        const chapterNumberToChapters = Object.groupBy(chapters, ({ chapterNumber }) => chapterNumber);

        const uniqueChapters = Object.values(chapterNumberToChapters).map(
            (groupedChapters) =>
                // the result of groupBy can't result in undefined values
                groupedChapters!.find((chapter) => chapter.id === currentChapter.id) ??
                groupedChapters!.findLast((chapter) => chapter.scanlator === currentChapter.scanlator) ??
                groupedChapters!.slice(-1)[0],
        );

        // keep the chapters in the same order as they were passed
        return chapters
            .map(({ id }) => uniqueChapters.find((chapter) => chapter.id === id))
            .filter((chapter): chapter is T => !!chapter);
    }

    static getNextChapter<Chapter extends ChapterIdInfo & ChapterScanlatorInfo & ChapterNumberInfo & ChapterReadInfo>(
        currentChapter: Chapter,
        chapters: Chapter[],
        {
            offset = DirectionOffset.NEXT,
            ...options
        }: { offset?: DirectionOffset; onlyUnread?: boolean; skipDupe?: boolean; skipDupeChapter?: Chapter } = {},
    ): Chapter | undefined {
        const nextChapters = Chapters.getNextChapters(currentChapter, chapters, { offset, ...options });

        const isNextChapterOffset = offset === DirectionOffset.NEXT;
        const sliceStartIndex = isNextChapterOffset ? -1 : 0;
        const sliceEndIndex = isNextChapterOffset ? undefined : 1;

        return nextChapters.slice(sliceStartIndex, sliceEndIndex)[0];
    }

    static getNextChapters<Chapter extends ChapterIdInfo & ChapterScanlatorInfo & ChapterNumberInfo & ChapterReadInfo>(
        fromChapter: Chapter,
        chapters: Chapter[],
        {
            offset = DirectionOffset.NEXT,
            onlyUnread = false,
            skipDupe = false,
            skipDupeChapter = fromChapter,
        }: { offset?: DirectionOffset; onlyUnread?: boolean; skipDupe?: boolean; skipDupeChapter?: Chapter } = {},
    ): Chapter[] {
        const fromChapterIndex = chapters.findIndex((chapter) => chapter.id === fromChapter.id);

        const isNextChapterOffset = offset === DirectionOffset.NEXT;
        const sliceStartIndex = isNextChapterOffset ? 0 : fromChapterIndex;
        const sliceEndIndex = isNextChapterOffset ? fromChapterIndex + 1 : undefined;

        const nextChaptersIncludingCurrent = chapters.slice(sliceStartIndex, sliceEndIndex);
        const uniqueNextChapters = skipDupe
            ? Chapters.removeDuplicates(skipDupeChapter, nextChaptersIncludingCurrent)
            : nextChaptersIncludingCurrent;
        const nextChapters = uniqueNextChapters.toSpliced(isNextChapterOffset ? -1 : 0, 1);

        return onlyUnread ? Chapters.getNonRead(nextChapters) : nextChapters;
    }

    static getReaderResumeMode(chapter: ChapterReadInfo): ReaderResumeMode {
        if (chapter.isRead) {
            return ReaderResumeMode.START;
        }

        return ReaderResumeMode.LAST_READ;
    }

    static getReaderOpenChapterLocationState(
        chapter: ChapterReadInfo,
        updateInitialChapter?: boolean,
    ): ReaderOpenChapterLocationState {
        return {
            resumeMode: Chapters.getReaderResumeMode(chapter),
            updateInitialChapter,
        };
    }

    /**
     * Returns the chapters grouped by the passed key representing a timestamp.
     *
     * The timestamp gets mapped to a string via {@link getDateString}
     */
    static groupByDate<
        T extends Pick<ChapterType, 'lastReadAt'> | Pick<ChapterType, 'fetchedAt'> | Pick<ChapterType, 'uploadDate'>,
        K extends keyof ExtractCommon<OmitNotMatching<ChapterType, 'lastReadAt' | 'fetchedAt' | 'uploadDate'>, T>,
    >(chapters: T[], key: K): Record<string, T[]> {
        return Object.groupBy(chapters, (chapter) => getDateString(epochToDate(Number(chapter[key])))) as Record<
            string,
            T[]
        >;
    }

    static getMissingCount<Chapter extends ChapterNumberInfo>(chapters: Chapter[]): number {
        const sortedChapters = chapters.toSorted((a, b) => a.chapterNumber - b.chapterNumber);

        return sortedChapters.reduce(
            (missingChapterCount, chapter, index) =>
                missingChapterCount + Chapters.getGap(chapter, sortedChapters[index - 1]),
            0,
        );
    }

    static getGap<Chapter extends ChapterNumberInfo>(
        chapterA: Chapter | undefined,
        chapterB: Chapter | undefined,
    ): number {
        if (!chapterA || !chapterB) {
            return 0;
        }

        if (chapterA.chapterNumber === -1 || chapterB.chapterNumber === -1) {
            return 0;
        }

        const higherChapterNumber = Math.max(chapterA.chapterNumber, chapterB.chapterNumber);
        const lowerChapterNumber = Math.min(chapterA.chapterNumber, chapterB.chapterNumber);

        return Math.max(0, Math.floor(higherChapterNumber) - Math.floor(lowerChapterNumber) - 1);
    }

    static getScanlators<Chapter extends ChapterScanlatorInfo>(chapters: Chapter[]): string[] {
        return [
            ...new Set(
                chapters.map((chapter) => chapter.scanlator).filter((scanlator) => typeof scanlator === 'string'),
            ),
        ];
    }
}
