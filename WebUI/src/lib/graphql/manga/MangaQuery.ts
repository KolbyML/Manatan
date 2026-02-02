/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { PAGE_INFO } from '@/lib/graphql/common/Fragments.ts';
import {
    MANGA_BASE_FIELDS,
    MANGA_LIBRARY_DUPLICATE_SCREEN_FIELDS,
    MANGA_LIBRARY_FIELDS,
    MANGA_READER_FIELDS,
    MANGA_SCREEN_FIELDS,
} from '@/lib/graphql/manga/MangaFragments.ts';
import { TRACK_RECORD_BIND_FIELDS } from '@/lib/graphql/tracker/TrackRecordFragments.ts';

// returns the current manga from the database
export const GET_MANGA_SCREEN = gql`
    ${MANGA_SCREEN_FIELDS}

    query GET_MANGA_SCREEN($id: Int!) {
        manga(id: $id) {
            ...MANGA_SCREEN_FIELDS
        }
    }
`;

// returns the current manga from the database
export const GET_MANGA_READER = gql`
    ${MANGA_READER_FIELDS}

    query GET_MANGA_READER($id: Int!) {
        manga(id: $id) {
            ...MANGA_READER_FIELDS
        }
    }
`;

// returns the current manga from the database
export const GET_MANGA_TRACK_RECORDS = gql`
    ${TRACK_RECORD_BIND_FIELDS}

    query GET_MANGA_TRACK_RECORDS($id: Int!) {
        manga(id: $id) {
            id

            trackRecords {
                totalCount

                nodes {
                    ...TRACK_RECORD_BIND_FIELDS
                }
            }
        }
    }
`;

// returns the current manga from the database
export const GET_MANGA_CATEGORIES = gql`
    query GET_MANGA_CATEGORIES($id: Int!) {
        manga(id: $id) {
            id
            categories {
                totalCount
                nodes {
                    id
                }
            }
        }
    }
`;

// returns the current manga from the database
export const GET_MANGA_TO_MIGRATE = gql`
    query GET_MANGA_TO_MIGRATE(
        $id: Int!
        $getChapterData: Boolean!
        $migrateCategories: Boolean!
        $migrateTracking: Boolean!
    ) {
        manga(id: $id) {
            id
            inLibrary
            title
            chapters @include(if: $getChapterData) {
                nodes {
                    id
                    manga {
                        id
                    }
                    chapterNumber
                    isRead
                    isDownloaded
                    isBookmarked
                }
                totalCount
            }
            categories @include(if: $migrateCategories) {
                nodes {
                    id
                }
            }
            trackRecords @include(if: $migrateTracking) {
                nodes {
                    id
                    remoteId
                    trackerId
                    private
                }
            }
        }
    }
`;

// returns the current manga from the database
export const GET_MANGAS_BASE = gql`
    ${MANGA_BASE_FIELDS}
    ${PAGE_INFO}

    query GET_MANGAS_BASE(
        $after: Cursor
        $before: Cursor
        $condition: MangaConditionInput
        $filter: MangaFilterInput
        $first: Int
        $last: Int
        $offset: Int
        $order: [MangaOrderInput!]
    ) {
        mangas(
            after: $after
            before: $before
            condition: $condition
            filter: $filter
            first: $first
            last: $last
            offset: $offset
            order: $order
        ) {
            nodes {
                ...MANGA_BASE_FIELDS
            }
            pageInfo {
                ...PAGE_INFO
            }
            totalCount
        }
    }
`;

// returns the current manga from the database
export const GET_MANGAS_LIBRARY = gql`
    ${MANGA_LIBRARY_FIELDS}
    ${PAGE_INFO}

    query GET_MANGAS_LIBRARY(
        $after: Cursor
        $before: Cursor
        $condition: MangaConditionInput
        $filter: MangaFilterInput
        $first: Int
        $last: Int
        $offset: Int
        $order: [MangaOrderInput!]
    ) {
        mangas(
            after: $after
            before: $before
            condition: $condition
            filter: $filter
            first: $first
            last: $last
            offset: $offset
            order: $order
        ) {
            nodes {
                ...MANGA_LIBRARY_FIELDS
            }
            pageInfo {
                ...PAGE_INFO
            }
            totalCount
        }
    }
`;

// returns the current manga from the database
export const GET_MANGAS_DUPLICATES = gql`
    ${MANGA_LIBRARY_DUPLICATE_SCREEN_FIELDS}
    ${PAGE_INFO}

    query GET_MANGAS_DUPLICATES(
        $after: Cursor
        $before: Cursor
        $condition: MangaConditionInput
        $filter: MangaFilterInput
        $first: Int
        $last: Int
        $offset: Int
        $order: [MangaOrderInput!]
    ) {
        mangas(
            after: $after
            before: $before
            condition: $condition
            filter: $filter
            first: $first
            last: $last
            offset: $offset
            order: $order
        ) {
            nodes {
                ...MANGA_LIBRARY_DUPLICATE_SCREEN_FIELDS
            }
            pageInfo {
                ...PAGE_INFO
            }
            totalCount
        }
    }
`;

export const GET_MIGRATABLE_SOURCE_MANGAS = gql`
    query GET_MIGRATABLE_SOURCE_MANGAS($sourceId: LongString!) {
        mangas(condition: { sourceId: $sourceId, inLibrary: true }) {
            nodes {
                id
                title
                thumbnailUrl
                sourceId
                categories {
                    nodes {
                        id
                    }
                }
            }
        }
    }
`;

export const GET_LIBRARY_MANGA_COUNT = gql`
    query GET_LIBRARY_MANGA_COUNT {
        mangas(condition: { inLibrary: true }) {
            totalCount
        }
    }
`;
