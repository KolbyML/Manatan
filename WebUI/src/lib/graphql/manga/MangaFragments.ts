/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { SOURCE_BASE_FIELDS } from '@/lib/graphql/source/SourceFragments.ts';

export const MANGA_META_FIELDS = gql`
    fragment MANGA_META_FIELDS on MangaMetaType {
        mangaId
        key
        value
    }
`;

export const MANGA_BASE_FIELDS = gql`
    fragment MANGA_BASE_FIELDS on MangaType {
        id
        title

        thumbnailUrl
        thumbnailUrlLastFetched
        inLibrary
        initialized
        sourceId
    }
`;

export const MANGA_CHAPTER_STAT_FIELDS = gql`
    fragment MANGA_CHAPTER_STAT_FIELDS on MangaType {
        id
        unreadCount
        downloadCount
        bookmarkCount
        hasDuplicateChapters

        chapters {
            totalCount
        }
    }
`;

export const MANGA_CHAPTER_NODE_FIELDS = gql`
    fragment MANGA_CHAPTER_NODE_FIELDS on MangaType {
        firstUnreadChapter {
            id
            sourceOrder
            isRead
            mangaId
            chapterNumber
            name
            scanlator
        }
        lastReadChapter {
            id
            sourceOrder
            lastReadAt
        }
        latestReadChapter {
            id
            sourceOrder
            lastReadAt
        }
        latestFetchedChapter {
            id
            fetchedAt
        }
        latestUploadedChapter {
            id
            uploadDate
        }
    }
`;

export const MANGA_READER_FIELDS = gql`
    ${MANGA_BASE_FIELDS}
    ${MANGA_META_FIELDS}
    ${SOURCE_BASE_FIELDS}

    fragment MANGA_READER_FIELDS on MangaType {
        ...MANGA_BASE_FIELDS

        genre
        source {
            ...SOURCE_BASE_FIELDS
        }

        meta {
            ...MANGA_META_FIELDS
        }

        chapters {
            totalCount
        }

        trackRecords {
            totalCount
        }
    }
`;

export const MANGA_LIBRARY_FIELDS = gql`
    ${MANGA_BASE_FIELDS}
    ${MANGA_CHAPTER_STAT_FIELDS}
    ${MANGA_CHAPTER_NODE_FIELDS}
    ${MANGA_META_FIELDS}

    fragment MANGA_LIBRARY_FIELDS on MangaType {
        ...MANGA_BASE_FIELDS
        ...MANGA_CHAPTER_STAT_FIELDS
        ...MANGA_CHAPTER_NODE_FIELDS

        genre
        lastFetchedAt
        inLibraryAt
        status

        artist
        author
        description

        meta {
            ...MANGA_META_FIELDS
        }

        source {
            id
            displayName
        }

        trackRecords {
            totalCount

            nodes {
                id
                trackerId
            }
        }
    }
`;

export const MANGA_SCREEN_FIELDS = gql`
    ${MANGA_LIBRARY_FIELDS}
    ${MANGA_META_FIELDS}

    fragment MANGA_SCREEN_FIELDS on MangaType {
        ...MANGA_LIBRARY_FIELDS

        artist
        author
        description

        status
        realUrl

        meta {
            ...MANGA_META_FIELDS
        }

        sourceId
        source {
            id
            displayName
        }

        trackRecords {
            totalCount

            nodes {
                id
                trackerId
            }
        }
    }
`;

export const MANGA_LIBRARY_DUPLICATE_SCREEN_FIELDS = gql`
    ${MANGA_BASE_FIELDS}
    ${MANGA_CHAPTER_STAT_FIELDS}

    fragment MANGA_LIBRARY_DUPLICATE_SCREEN_FIELDS on MangaType {
        ...MANGA_BASE_FIELDS
        ...MANGA_CHAPTER_STAT_FIELDS

        description
    }
`;
