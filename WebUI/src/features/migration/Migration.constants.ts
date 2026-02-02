/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { SortBy, SortOrder } from '@/features/migration/Migration.types.ts';

import { TranslationKey } from '@/base/Base.types.ts';

export const sortByToTranslationKey: Record<SortBy, TranslationKey> = {
    [SortBy.SOURCE_NAME]: 'migrate.sort.by_source_name',
    [SortBy.MANGA_COUNT]: 'migrate.sort.by_manga_count',
};

export const sortOrderToTranslationKey: Record<SortBy, TranslationKey> = {
    [SortOrder.ASC]: 'global.sort.label.asc',
    [SortOrder.DESC]: 'global.sort.label.desc',
};

export const DEFAULT_SORT_SETTINGS = {
    sortBy: SortBy.SOURCE_NAME,
    sortOrder: SortOrder.ASC,
};
