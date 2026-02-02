/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { StringParam, useQueryParam } from 'use-query-params';
import { useMemo } from 'react';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { ChapterType, MangaType, TrackRecordType } from '@/lib/graphql/generated/graphql.ts';
import { enhancedCleanup } from '@/base/utils/Strings.ts';
import { useGetCategoryMetadata } from '@/features/category/services/CategoryMetadata.ts';
import { LibraryOptions, LibrarySortMode } from '@/features/library/Library.types.ts';
import { CategoryIdInfo, CategoryMetadataInfo } from '@/features/category/Category.types.ts';
import {
    MangaChapterCountInfo,
    MangaDownloadInfo,
    MangaIdInfo,
    MangaStatusInfo,
    MangaUnreadInfo,
} from '@/features/manga/Manga.types.ts';
import { SourceDisplayNameInfo } from '@/features/source/Source.types.ts';
import { SearchParam } from '@/base/Base.types.ts';

const triStateFilter = (
    triState: NullAndUndefined<boolean>,
    enabledFilter: () => boolean,
    disabledFilter: () => boolean,
): boolean => {
    switch (triState) {
        case true:
            return enabledFilter();
        case false:
            return disabledFilter();
        default:
            return true;
    }
};

const triStateFilterNumber = (triState: NullAndUndefined<boolean>, count?: number): boolean =>
    triStateFilter(
        triState,
        () => !!count && count >= 1,
        () => count === 0,
    );

const triStateFilterBoolean = (triState: NullAndUndefined<boolean>, status?: boolean): boolean =>
    triStateFilter(
        triState,
        () => !!status,
        () => !status,
    );

const performSearch = (
    queries: NullAndUndefined<string>[] | undefined,
    strings: NullAndUndefined<string>[],
): boolean => {
    const actualQueries = queries?.filter((query) => query != null);
    const actualStrings = strings?.filter((str) => str != null);

    if (!actualQueries?.length) return true;

    const cleanedUpQueries = actualQueries.map(enhancedCleanup);
    const cleanedUpStrings = actualStrings.map(enhancedCleanup).join(', ');

    return cleanedUpQueries.every((query) => cleanedUpStrings.includes(query));
};

type TMangaQueryFilter = Pick<MangaType, 'title' | 'genre' | 'description' | 'artist' | 'author' | 'sourceId'> & {
    source?: NullAndUndefined<SourceDisplayNameInfo>;
};
const querySearchManga = (
    query: NullAndUndefined<string>,
    { title, genre: genres, description, artist, author, source, sourceId }: TMangaQueryFilter,
): boolean =>
    performSearch([query], [title]) ||
    performSearch(
        query?.split(','),
        genres.map((genre) => enhancedCleanup(genre)),
    ) ||
    performSearch([query], [description]) ||
    performSearch([query], [artist]) ||
    performSearch([query], [author]) ||
    performSearch([query], [source?.displayName]) ||
    performSearch([query], [sourceId]);

type TMangaTrackerFilter = { trackRecords: { nodes: Pick<TrackRecordType, 'id' | 'trackerId'>[] } };
const trackerFilter = (trackFilters: LibraryOptions['hasTrackerBinding'], manga: TMangaTrackerFilter): boolean =>
    Object.entries(trackFilters)
        .map(([trackFilterId, trackFilterState]) => {
            const isTrackerBound = manga.trackRecords.nodes.some(
                (trackRecord) => trackRecord.trackerId === Number(trackFilterId),
            );

            return triStateFilter(
                trackFilterState,
                () => isTrackerBound,
                () => !isTrackerBound,
            );
        })
        .every(Boolean);

const statusFilter = (statusFilters: LibraryOptions['hasStatus'], manga: MangaStatusInfo): boolean =>
    Object.entries(statusFilters)
        .map(([status, statusFilterState]) => triStateFilterBoolean(statusFilterState, status === manga.status))
        .every(Boolean);

type TMangaFilterOptions = Pick<
    LibraryOptions,
    | 'hasUnreadChapters'
    | 'hasReadChapters'
    | 'hasDownloadedChapters'
    | 'hasBookmarkedChapters'
    | 'hasDuplicateChapters'
    | 'hasTrackerBinding'
    | 'hasStatus'
>;
type TMangaFilter = Pick<MangaType, 'bookmarkCount' | 'hasDuplicateChapters'> &
    TMangaTrackerFilter &
    MangaStatusInfo &
    MangaChapterCountInfo &
    MangaDownloadInfo &
    MangaUnreadInfo;
const filterManga = (
    manga: TMangaFilter,
    {
        hasDownloadedChapters,
        hasUnreadChapters,
        hasReadChapters,
        hasBookmarkedChapters,
        hasDuplicateChapters,
        hasTrackerBinding,
        hasStatus,
    }: TMangaFilterOptions,
): boolean =>
    triStateFilterNumber(hasDownloadedChapters, manga.downloadCount) &&
    triStateFilterNumber(hasUnreadChapters, manga.unreadCount) &&
    triStateFilterNumber(hasReadChapters, manga.chapters.totalCount - manga.unreadCount) &&
    triStateFilterNumber(hasBookmarkedChapters, manga.bookmarkCount) &&
    triStateFilterBoolean(hasDuplicateChapters, manga.hasDuplicateChapters) &&
    trackerFilter(hasTrackerBinding, manga) &&
    statusFilter(hasStatus, manga);

type TMangasFilter = TMangaQueryFilter & TMangaFilter;
const filterMangas = <Manga extends TMangasFilter>(
    mangas: Manga[],
    query: NullAndUndefined<string>,
    options: TMangaFilterOptions & { ignoreFilters: boolean },
): Manga[] => {
    const ignoreFiltersWhileSearching = options.ignoreFilters && query?.length;

    return mangas.filter((manga) => {
        const matchesSearch = querySearchManga(query, manga);
        const matchesFilters = ignoreFiltersWhileSearching || filterManga(manga, options);

        return matchesSearch && matchesFilters;
    });
};

const sortByNumber = (a: number | string = 0, b: number | string = 0) => Number(a) - Number(b);

const sortByString = (a: string, b: string): number => a.localeCompare(b);

type TMangaSort = Pick<MangaType, 'title' | 'inLibraryAt' | 'unreadCount'> &
    MangaChapterCountInfo & {
        lastReadChapter?: Pick<ChapterType, 'lastReadAt'> | null;
        latestUploadedChapter?: Pick<ChapterType, 'uploadDate'> | null;
        latestFetchedChapter?: Pick<ChapterType, 'fetchedAt'> | null;
    };
const sortManga = <Manga extends TMangaSort>(
    manga: Manga[],
    sort: NullAndUndefined<LibrarySortMode>,
    desc: NullAndUndefined<boolean>,
): Manga[] => {
    const result = [...manga];

    switch (sort) {
        case 'alphabetically':
            result.sort((a, b) => sortByString(a.title, b.title));
            break;
        case 'dateAdded':
            result.sort((a, b) => sortByNumber(a.inLibraryAt, b.inLibraryAt));
            break;
        case 'unreadChapters':
            result.sort((a, b) => sortByNumber(a.unreadCount, b.unreadCount));
            break;
        case 'lastRead':
            result.sort((a, b) => sortByNumber(a.lastReadChapter?.lastReadAt, b.lastReadChapter?.lastReadAt));
            break;
        case 'latestUploadedChapter':
            result.sort((a, b) =>
                sortByNumber(a.latestUploadedChapter?.uploadDate, b.latestUploadedChapter?.uploadDate),
            );
            break;
        case 'latestFetchedChapter':
            result.sort((a, b) => sortByNumber(a.latestFetchedChapter?.fetchedAt, b.latestFetchedChapter?.fetchedAt));
            break;
        case 'totalChapters':
            result.sort((a, b) => sortByNumber(a.chapters.totalCount, b.chapters.totalCount));
            break;
        default:
            break;
    }

    if (desc) {
        result.reverse();
    }

    return result;
};

const DEFAULT_CATEGORY: CategoryIdInfo = { id: -1 };
export const useGetVisibleLibraryMangas = <Manga extends MangaIdInfo & TMangasFilter & TMangaSort>(
    mangas: Manga[],
    category?: CategoryMetadataInfo,
): {
    visibleMangas: Manga[];
    showFilteredOutMessage: boolean;
    filterKey: string;
} => {
    const [query] = useQueryParam(SearchParam.QUERY, StringParam);
    const options = useGetCategoryMetadata(category ?? DEFAULT_CATEGORY);
    const {
        hasUnreadChapters,
        hasReadChapters,
        hasDownloadedChapters,
        hasBookmarkedChapters,
        hasTrackerBinding,
        hasDuplicateChapters,
        hasStatus,
    } = options;
    const { settings } = useMetadataServerSettings();

    const filteredMangas = useMemo(
        () =>
            filterMangas(mangas, query, {
                ...options,
                ignoreFilters: settings.ignoreFilters,
            }),
        [
            mangas,
            query,
            hasUnreadChapters,
            hasReadChapters,
            hasDownloadedChapters,
            hasBookmarkedChapters,
            hasTrackerBinding,
            hasDuplicateChapters,
            hasStatus,
            settings.ignoreFilters,
        ],
    );
    const sortedMangas = useMemo(
        () => sortManga(filteredMangas, options.sortBy, options.sortDesc),
        [filteredMangas, options.sortBy, options.sortDesc],
    );

    const isATrackFilterActive = Object.values(options.hasTrackerBinding).some(
        (trackFilterState) => trackFilterState != null,
    );
    const showFilteredOutMessage =
        (hasUnreadChapters != null ||
            hasReadChapters != null ||
            hasDownloadedChapters != null ||
            hasBookmarkedChapters != null ||
            !!query ||
            isATrackFilterActive) &&
        filteredMangas.length === 0 &&
        mangas.length > 0;

    return {
        visibleMangas: sortedMangas,
        showFilteredOutMessage,
        filterKey: `${JSON.stringify(options)}${settings.ignoreFilters}`,
    };
};
