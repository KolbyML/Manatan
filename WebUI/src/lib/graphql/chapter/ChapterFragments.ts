/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { MANGA_BASE_FIELDS } from '@/lib/graphql/manga/MangaFragments.ts';

export const CHAPTER_META_FIELDS = gql`
    fragment CHAPTER_META_FIELDS on ChapterMetaType {
        chapterId
        key
        value
    }
`;

export const CHAPTER_BASE_FIELDS = gql`
    fragment CHAPTER_BASE_FIELDS on ChapterType {
        id
        name

        mangaId
        scanlator
        realUrl

        sourceOrder
        chapterNumber
    }
`;

export const CHAPTER_STATE_FIELDS = gql`
    fragment CHAPTER_STATE_FIELDS on ChapterType {
        id
        isRead
        isDownloaded
        isBookmarked
    }
`;

export const CHAPTER_READER_FIELDS = gql`
    ${CHAPTER_BASE_FIELDS}
    ${CHAPTER_STATE_FIELDS}

    fragment CHAPTER_READER_FIELDS on ChapterType {
        ...CHAPTER_BASE_FIELDS
        ...CHAPTER_STATE_FIELDS

        uploadDate
        lastPageRead
        pageCount
    }
`;

export const CHAPTER_LIST_FIELDS = gql`
    ${CHAPTER_BASE_FIELDS}
    ${CHAPTER_STATE_FIELDS}

    fragment CHAPTER_LIST_FIELDS on ChapterType {
        ...CHAPTER_BASE_FIELDS
        ...CHAPTER_STATE_FIELDS

        fetchedAt
        uploadDate
        lastReadAt
    }
`;

export const CHAPTER_UPDATE_LIST_FIELDS = gql`
    ${CHAPTER_LIST_FIELDS}
    ${MANGA_BASE_FIELDS}

    fragment CHAPTER_UPDATE_LIST_FIELDS on ChapterType {
        ...CHAPTER_LIST_FIELDS

        manga {
            ...MANGA_BASE_FIELDS
        }
    }
`;

export const CHAPTER_HISTORY_LIST_FIELDS = gql`
    ${CHAPTER_LIST_FIELDS}
    ${MANGA_BASE_FIELDS}

    fragment CHAPTER_HISTORY_LIST_FIELDS on ChapterType {
        ...CHAPTER_LIST_FIELDS

        manga {
            ...MANGA_BASE_FIELDS
        }
    }
`;
