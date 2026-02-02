/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { CHAPTER_LIST_FIELDS, CHAPTER_META_FIELDS } from '@/lib/graphql/chapter/ChapterFragments.ts';
import { TRACK_RECORD_BIND_FIELDS } from '@/lib/graphql/tracker/TrackRecordFragments.ts';
import { MANGA_CHAPTER_NODE_FIELDS, MANGA_CHAPTER_STAT_FIELDS } from '@/lib/graphql/manga/MangaFragments.ts';

export const DELETE_CHAPTER_METADATA = gql`
    ${CHAPTER_META_FIELDS}

    mutation DELETE_CHAPTER_METADATA($input: DeleteChapterMetaInput!) {
        deleteChapterMeta(input: $input) {
            meta {
                ...CHAPTER_META_FIELDS
            }
        }
    }
`;

// makes the server fetch and return the pages of a chapter
export const GET_CHAPTER_PAGES_FETCH = gql`
    mutation GET_CHAPTER_PAGES_FETCH($input: FetchChapterPagesInput!) {
        fetchChapterPages(input: $input) {
            chapter {
                id
                pageCount
            }
            pages
        }
    }
`;

// makes the server fetch and return the chapters of the manga
export const GET_MANGA_CHAPTERS_FETCH = gql`
    ${CHAPTER_LIST_FIELDS}
    ${MANGA_CHAPTER_STAT_FIELDS}
    ${MANGA_CHAPTER_NODE_FIELDS}

    mutation GET_MANGA_CHAPTERS_FETCH($input: FetchChaptersInput!) {
        fetchChapters(input: $input) {
            chapters {
                ...CHAPTER_LIST_FIELDS
                manga {
                    id
                    ...MANGA_CHAPTER_STAT_FIELDS
                    ...MANGA_CHAPTER_NODE_FIELDS
                }
            }
        }
    }
`;

export const SET_CHAPTER_METADATA = gql`
    ${CHAPTER_META_FIELDS}

    mutation SET_CHAPTER_METADATA($input: SetChapterMetaInput!) {
        setChapterMeta(input: $input) {
            meta {
                ...CHAPTER_META_FIELDS
            }
        }
    }
`;

export const UPDATE_CHAPTER = gql`
    ${TRACK_RECORD_BIND_FIELDS}

    mutation UPDATE_CHAPTER(
        $input: UpdateChapterInput!
        $getBookmarked: Boolean!
        $getRead: Boolean!
        $getLastPageRead: Boolean!
        $chapterIdToDelete: Int!
        $deleteChapter: Boolean!
        $mangaId: Int!
        $trackProgress: Boolean!
    ) {
        updateChapter(input: $input) {
            chapter {
                id
                isBookmarked @include(if: $getBookmarked)
                isRead @include(if: $getRead)
                lastReadAt @include(if: $getRead)
                lastPageRead @include(if: $getLastPageRead)
                manga @include(if: $getRead) {
                    id
                    unreadCount
                    lastReadChapter {
                        id
                    }
                    latestReadChapter {
                        id
                    }
                    firstUnreadChapter {
                        id
                    }
                }
                manga @include(if: $getBookmarked) {
                    id
                    bookmarkCount
                }
            }
        }
        deleteDownloadedChapter(input: { id: $chapterIdToDelete }) @include(if: $deleteChapter) {
            chapters {
                id
                isDownloaded
                manga {
                    id
                    downloadCount
                }
            }
        }
        trackProgress(input: { mangaId: $mangaId }) @include(if: $trackProgress) {
            trackRecords {
                ...TRACK_RECORD_BIND_FIELDS
            }
        }
    }
`;

export const UPDATE_CHAPTERS = gql`
    ${TRACK_RECORD_BIND_FIELDS}

    mutation UPDATE_CHAPTERS(
        $input: UpdateChaptersInput!
        $getBookmarked: Boolean!
        $getRead: Boolean!
        $getLastPageRead: Boolean!
        $chapterIdsToDelete: [Int!]!
        $deleteChapters: Boolean!
        $mangaId: Int!
        $trackProgress: Boolean!
    ) {
        updateChapters(input: $input) {
            chapters {
                id
                isBookmarked @include(if: $getBookmarked)
                isRead @include(if: $getRead)
                lastReadAt @include(if: $getRead)
                lastPageRead @include(if: $getLastPageRead)
                manga @include(if: $getRead) {
                    id
                    unreadCount
                    lastReadChapter {
                        id
                    }
                    latestReadChapter {
                        id
                    }
                    firstUnreadChapter {
                        id
                    }
                }
                manga @include(if: $getBookmarked) {
                    id
                    bookmarkCount
                }
            }
        }
        deleteDownloadedChapters(input: { ids: $chapterIdsToDelete }) @include(if: $deleteChapters) {
            chapters {
                id
                isDownloaded
                manga {
                    id
                    downloadCount
                }
            }
        }
        trackProgress(input: { mangaId: $mangaId }) @include(if: $trackProgress) {
            trackRecords {
                ...TRACK_RECORD_BIND_FIELDS
            }
        }
    }
`;
