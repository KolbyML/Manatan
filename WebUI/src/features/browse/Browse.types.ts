/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { SourceIdInfo } from '@/features/source/Source.types.ts';

export type MetadataBrowseSettings = {
    hideLibraryEntries: boolean;
    extensionLanguages: string[];
    animeExtensionLanguages: string[];
    sourceLanguages: string[];
    animeSourceLanguages: string[];
    showNsfw: boolean;
    lastUsedSourceId: SourceIdInfo['id'] | null;
    shouldShowOnlySourcesWithResults: boolean;
};

export enum BrowseTab {
    SOURCE_DEPRECATED = 'source',
    ANIME_SOURCES = 'anime-sources',
    MANGA_SOURCES = 'manga-sources',
    ANIME_EXTENSIONS = 'anime-extensions',
    MANGA_EXTENSIONS = 'manga-extensions',
    ANIME_MIGRATE = 'anime-migrate',
    MANGA_MIGRATE = 'manga-migrate',
}
