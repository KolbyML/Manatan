/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useMemo } from 'react';
import { DEFAULT_CHAPTER_OPTIONS } from '@/features/chapter/Chapter.constants.ts';
import { getMetadataFrom } from '@/features/metadata/services/MetadataReader.ts';
import { MangaIdInfo, MangaMetadata, MangaMetadataKeys } from '@/features/manga/Manga.types.ts';
import {
    AllowedMetadataValueTypes,
    GqlMetaHolder,
    Metadata,
    MetadataHolder,
} from '@/features/metadata/Metadata.types.ts';
import { convertFromGqlMeta } from '@/features/metadata/services/MetadataConverter.ts';
import { requestUpdateMangaMetadata } from '@/features/metadata/services/MetadataUpdater.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';

const DEFAULT_MANGA_METADATA: MangaMetadata = {
    ...DEFAULT_CHAPTER_OPTIONS,
};

const convertAppMetadataToGqlMetadata = (
    metadata: Partial<MangaMetadata>,
): Metadata<string, AllowedMetadataValueTypes> => ({
    ...metadata,
    excludedScanlators: JSON.stringify(metadata.excludedScanlators),
});

const getMangaMetadataWithDefaultValueFallback = (
    meta: MangaIdInfo & MetadataHolder,
    defaultMetadata: MangaMetadata = DEFAULT_MANGA_METADATA,
    useEffectFn?: typeof useEffect,
): MangaMetadata => getMetadataFrom('manga', meta, defaultMetadata, undefined, useEffectFn);

const getMetadata = (
    metaHolder: MangaIdInfo & GqlMetaHolder,
    defaultMetadata?: MangaMetadata,
    useEffectFn?: typeof useEffect,
) =>
    getMangaMetadataWithDefaultValueFallback(
        { ...metaHolder, meta: convertFromGqlMeta(metaHolder.meta) },
        defaultMetadata,
        useEffectFn,
    );

export const getMangaMetadata = (
    metaHolder: MangaIdInfo & GqlMetaHolder,
    defaultMetadata?: MangaMetadata,
): MangaMetadata => getMetadata(metaHolder, defaultMetadata);

export const useGetMangaMetadata = (
    metaHolder: MangaIdInfo & GqlMetaHolder,
    defaultMetadata?: MangaMetadata,
): MangaMetadata => {
    const metadata = getMetadata(metaHolder, defaultMetadata, useEffect);
    return useMemo(() => metadata, [metaHolder, defaultMetadata]);
};

export const updateMangaMetadata = async <
    MetadataKeys extends MangaMetadataKeys = MangaMetadataKeys,
    MetadataKey extends MetadataKeys = MetadataKeys,
>(
    manga: MangaIdInfo & GqlMetaHolder,
    metadataKey: MetadataKey,
    value: MangaMetadata[MetadataKey],
): Promise<void[]> =>
    requestUpdateMangaMetadata(manga, [
        [metadataKey, convertAppMetadataToGqlMetadata({ [metadataKey]: value })[metadataKey]],
    ]);

export const createUpdateMangaMetadata =
    <Settings extends MangaMetadataKeys>(
        manga: MangaIdInfo & GqlMetaHolder,
        handleError: (error: any) => void = defaultPromiseErrorHandler('createUpdateMangaMetadata'),
    ): ((...args: OmitFirst<Parameters<typeof updateMangaMetadata<Settings>>>) => Promise<void | void[]>) =>
    (metadataKey, value) =>
        updateMangaMetadata(manga, metadataKey, value).catch(handleError);
