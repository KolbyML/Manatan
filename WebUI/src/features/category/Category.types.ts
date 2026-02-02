/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { LibraryOptions } from '@/features/library/Library.types.ts';
import { CategoryMetaType, CategoryType } from '@/lib/graphql/generated/graphql.ts';

export interface ICategoryMetadata extends LibraryOptions {}

export type CategoryMetadataKeys = keyof ICategoryMetadata;

export type CategoryIdInfo = Pick<CategoryType, 'id'>;
export type CategoryNameInfo = Pick<CategoryType, 'name'>;
export type CategoryDefaultInfo = Pick<CategoryType, 'default'>;
export type CategoryUpdateInclusionInfo = Pick<CategoryType, 'includeInUpdate'>;
export type CategoryDownloadInclusionInfo = Pick<CategoryType, 'includeInDownload'>;
export type CategoryMetadataInfo = CategoryIdInfo & { meta: Pick<CategoryMetaType, 'key' | 'value'>[] };
