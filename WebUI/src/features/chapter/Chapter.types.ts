/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    ChapterReaderFieldsFragment,
    ChapterType,
    DownloadStatusFieldsFragment,
} from '@/lib/graphql/generated/graphql.ts';

export type ChapterSortMode = 'fetchedAt' | 'source' | 'chapterNumber' | 'uploadedAt';

export interface ChapterListOptions {
    unread: NullAndUndefined<boolean>;
    downloaded: NullAndUndefined<boolean>;
    bookmarked: NullAndUndefined<boolean>;
    reverse: boolean;
    sortBy: ChapterSortMode;
    showChapterNumber: boolean;
    excludedScanlators: string[];
}

export type TChapterReader = ChapterReaderFieldsFragment;

export type ChapterAction = 'download' | 'delete' | 'bookmark' | 'unbookmark' | 'mark_as_read' | 'mark_as_unread';

export type ChapterDownloadStatus = DownloadStatusFieldsFragment['queue'][number];

export type ChapterIdInfo = Pick<ChapterType, 'id'>;

export type ChapterMangaInfo = Pick<ChapterType, 'mangaId'>;

export type ChapterDownloadInfo = Pick<ChapterType, 'isDownloaded'>;

export type ChapterBookmarkInfo = Pick<ChapterType, 'isBookmarked'>;

export type ChapterReadInfo = Pick<ChapterType, 'isRead'>;

export type ChapterNumberInfo = Pick<ChapterType, 'chapterNumber'>;

export type ChapterSourceOrderInfo = Pick<ChapterType, 'sourceOrder'>;

export type ChapterScanlatorInfo = Pick<ChapterType, 'scanlator'>;

export type ChapterRealUrlInfo = Pick<ChapterType, 'realUrl'>;

export type ChapterNameInfo = Pick<ChapterType, 'name'>;
