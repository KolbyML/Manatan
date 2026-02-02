/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { GetMigratableSourcesQuery } from '@/lib/graphql/generated/graphql.ts';

export enum SortBy {
    SOURCE_NAME,
    MANGA_COUNT,
}

export enum SortOrder {
    ASC,
    DESC,
}

export interface SortSettings {
    sortBy: SortBy;
    sortOrder: SortOrder;
}

export type TMigratableSourcesResult = GetMigratableSourcesQuery['mangas']['nodes'];

export type MetadataMigrationSettings = {
    migrateChapters: boolean;
    migrateCategories: boolean;
    migrateTracking: boolean;
    deleteChapters: boolean;
    migrateSortSettings: SortSettings;
};
