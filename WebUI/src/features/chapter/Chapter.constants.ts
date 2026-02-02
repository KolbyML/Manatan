/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ChapterAction, ChapterListOptions, ChapterSortMode } from '@/features/chapter/Chapter.types.ts';
import { TranslationKey } from '@/base/Base.types.ts';

export const FALLBACK_CHAPTER = { id: -1, name: '', realUrl: '', isDownloaded: false, isBookmarked: false };

export const DEFAULT_CHAPTER_OPTIONS: ChapterListOptions = {
    unread: undefined,
    downloaded: undefined,
    bookmarked: undefined,
    reverse: true,
    sortBy: 'source',
    showChapterNumber: false,
    excludedScanlators: [],
};

export const CHAPTER_SORT_OPTIONS_TO_TRANSLATION_KEY: Record<ChapterSortMode, TranslationKey> = {
    source: 'global.sort.label.by_source',
    chapterNumber: 'global.sort.label.by_chapter_number',
    uploadedAt: 'global.sort.label.by_upload_date',
    fetchedAt: 'global.sort.label.by_fetch_date',
};

export const CHAPTER_ACTION_TO_CONFIRMATION_REQUIRED: Record<
    ChapterAction,
    { always: boolean; bulkAction: boolean; bulkActionCountForce?: number }
> = {
    download: { always: false, bulkAction: false, bulkActionCountForce: 300 },
    delete: { always: true, bulkAction: true },
    bookmark: { always: false, bulkAction: false },
    unbookmark: { always: false, bulkAction: true },
    mark_as_read: { always: false, bulkAction: true },
    mark_as_unread: { always: false, bulkAction: true },
};

export const CHAPTER_ACTION_TO_TRANSLATION: {
    [key in ChapterAction]: {
        action: {
            single: TranslationKey;
            selected: TranslationKey;
        };
        confirmation?: TranslationKey;
        success: TranslationKey;
        error: TranslationKey;
    };
} = {
    download: {
        action: {
            single: 'chapter.action.download.add.label.action',
            selected: 'chapter.action.download.add.button.selected',
        },
        confirmation: 'chapter.action.download.add.label.confirmation',
        success: 'chapter.action.download.add.label.success',
        error: 'chapter.action.download.add.label.error',
    },
    delete: {
        action: {
            single: 'chapter.action.download.delete.label.action',
            selected: 'chapter.action.download.delete.button.selected',
        },
        confirmation: 'chapter.action.download.delete.label.confirmation',
        success: 'chapter.action.download.delete.label.success',
        error: 'chapter.action.download.delete.label.error',
    },
    bookmark: {
        action: {
            single: 'chapter.action.bookmark.add.label.action',
            selected: 'chapter.action.bookmark.add.button.selected',
        },
        success: 'chapter.action.bookmark.add.label.success',
        error: 'chapter.action.bookmark.add.label.error',
    },
    unbookmark: {
        action: {
            single: 'chapter.action.bookmark.remove.label.action',
            selected: 'chapter.action.bookmark.remove.button.selected',
        },
        confirmation: 'chapter.action.bookmark.remove.label.confirmation',
        success: 'chapter.action.bookmark.remove.label.success',
        error: 'chapter.action.bookmark.remove.label.error',
    },
    mark_as_read: {
        action: {
            single: 'chapter.action.mark_as_read.add.label.action.current',
            selected: 'chapter.action.mark_as_read.add.button.selected',
        },
        confirmation: 'chapter.action.mark_as_read.add.label.confirmation',
        success: 'chapter.action.mark_as_read.add.label.success',
        error: 'chapter.action.mark_as_read.add.label.error',
    },
    mark_as_unread: {
        action: {
            single: 'chapter.action.mark_as_read.remove.label.action',
            selected: 'chapter.action.mark_as_read.remove.button.selected',
        },
        confirmation: 'chapter.action.mark_as_read.remove.label.confirmation',
        success: 'chapter.action.mark_as_read.remove.label.success',
        error: 'chapter.action.mark_as_read.remove.label.error',
    },
};
