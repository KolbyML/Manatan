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
    CHAPTER_LIST_FIELDS,
    CHAPTER_READER_FIELDS,
    CHAPTER_STATE_FIELDS,
    CHAPTER_UPDATE_LIST_FIELDS,
    CHAPTER_HISTORY_LIST_FIELDS,
} from '@/lib/graphql/chapter/ChapterFragments.ts';

// returns the current chapters from the database
export const GET_CHAPTERS_READER = gql`
    ${CHAPTER_READER_FIELDS}
    ${PAGE_INFO}

    query GET_CHAPTERS_READER(
        $after: Cursor
        $before: Cursor
        $condition: ChapterConditionInput
        $filter: ChapterFilterInput
        $first: Int
        $last: Int
        $offset: Int
        $order: [ChapterOrderInput!]
    ) {
        chapters(
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
                ...CHAPTER_READER_FIELDS
            }
            pageInfo {
                ...PAGE_INFO
            }
            totalCount
        }
    }
`;

// returns the current chapters from the database
export const GET_CHAPTERS_MANGA = gql`
    ${CHAPTER_LIST_FIELDS}
    ${PAGE_INFO}

    query GET_CHAPTERS_MANGA(
        $after: Cursor
        $before: Cursor
        $condition: ChapterConditionInput
        $filter: ChapterFilterInput
        $first: Int
        $last: Int
        $offset: Int
        $order: [ChapterOrderInput!]
    ) {
        chapters(
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
                ...CHAPTER_LIST_FIELDS
            }
            pageInfo {
                ...PAGE_INFO
            }
            totalCount
        }
    }
`;

// returns the current chapters from the database
export const GET_CHAPTERS_UPDATES = gql`
    ${CHAPTER_UPDATE_LIST_FIELDS}
    ${PAGE_INFO}

    query GET_CHAPTERS_UPDATES(
        $after: Cursor
        $before: Cursor
        $condition: ChapterConditionInput
        $filter: ChapterFilterInput
        $first: Int
        $last: Int
        $offset: Int
        $order: [ChapterOrderInput!]
    ) {
        lastUpdateTimestamp {
            timestamp
        }
        chapters(
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
                ...CHAPTER_UPDATE_LIST_FIELDS
            }
            pageInfo {
                ...PAGE_INFO
            }
            totalCount
        }
    }
`;

// returns the current chapters from the database
export const GET_CHAPTERS_HISTORY = gql`
    ${CHAPTER_HISTORY_LIST_FIELDS}
    ${PAGE_INFO}

    query GET_CHAPTERS_HISTORY(
        $after: Cursor
        $before: Cursor
        $condition: ChapterConditionInput
        $filter: ChapterFilterInput
        $first: Int
        $last: Int
        $offset: Int
        $order: [ChapterOrderInput!]
    ) {
        chapters(
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
                ...CHAPTER_HISTORY_LIST_FIELDS
            }
            pageInfo {
                ...PAGE_INFO
            }
            totalCount
        }
    }
`;

export const GET_MANGAS_CHAPTER_IDS_WITH_STATE = gql`
    ${CHAPTER_STATE_FIELDS}

    query GET_MANGAS_CHAPTER_IDS_WITH_STATE(
        $mangaIds: [Int!]!
        $isDownloaded: Boolean = null
        $isRead: Boolean = null
        $isBookmarked: Boolean = null
    ) {
        chapters(
            filter: { mangaId: { in: $mangaIds } }
            condition: { isDownloaded: $isDownloaded, isRead: $isRead, isBookmarked: $isBookmarked }
            order: [{ by: SOURCE_ORDER }]
        ) {
            nodes {
                ...CHAPTER_STATE_FIELDS
                mangaId
                scanlator
                chapterNumber
            }
        }
    }
`;
