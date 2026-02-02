/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { requestManager } from '@/lib/requests/RequestManager.ts';
import { CategoryIdInfo } from '@/features/category/Category.types.ts';
import {
    AllowedMetadataValueTypes,
    AppMetadataKeys,
    GqlMetaHolder,
    MetadataHolder,
    MetadataHolderType,
    MetadataKeyValuePair,
} from '@/features/metadata/Metadata.types.ts';
import { MangaIdInfo } from '@/features/manga/Manga.types.ts';
import { getMetadataKey } from '@/features/metadata/Metadata.utils.ts';
import { convertToGqlMeta } from '@/features/metadata/services/MetadataConverter.ts';
import { SourceIdInfo } from '@/features/source/Source.types.ts';
import { ChapterIdInfo } from '@/features/chapter/Chapter.types.ts';

const requestUpdateMetadataValue = async (
    metadataHolder: GqlMetaHolder,
    holderType: MetadataHolderType,
    key: AppMetadataKeys,
    value: AllowedMetadataValueTypes,
    keyPrefixes?: string[],
    isMetadataKey: boolean = false,
): Promise<void> => {
    const metadataKey = isMetadataKey ? key : getMetadataKey(key, keyPrefixes);

    switch (holderType) {
        case 'category':
            await requestManager.setCategoryMeta((metadataHolder as CategoryIdInfo).id, metadataKey, value).response;
            break;
        case 'chapter':
            await requestManager.setChapterMeta((metadataHolder as ChapterIdInfo).id, metadataKey, value).response;
            break;
        case 'global':
            await requestManager.setGlobalMetadata(metadataKey, value).response;
            break;
        case 'manga':
            await requestManager.setMangaMeta((metadataHolder as MangaIdInfo).id, metadataKey, value).response;
            break;
        case 'source':
            await requestManager.setSourceMeta((metadataHolder as SourceIdInfo).id, metadataKey, value).response;
            break;
        default:
            throw new Error(`requestUpdateMetadataValue: unknown holderType "${holderType}"`);
    }
};

const requestUpdateMetadata = async (
    metadataHolder: GqlMetaHolder,
    holderType: MetadataHolderType,
    keysToValues: MetadataKeyValuePair[],
    keyPrefixes?: string[],
    isMetadataKey?: boolean,
): Promise<void[]> =>
    Promise.all(
        keysToValues.map(([key, value]) =>
            requestUpdateMetadataValue(metadataHolder, holderType, key, value, keyPrefixes, isMetadataKey),
        ),
    );

export const requestUpdateServerMetadata = async (
    keysToValues: MetadataKeyValuePair[],
    keyPrefixes?: string[],
    isMetadataKey?: boolean,
): Promise<void[]> => requestUpdateMetadata({}, 'global', keysToValues, keyPrefixes, isMetadataKey);

export const requestUpdateMangaMetadata = async (
    manga: MangaIdInfo & GqlMetaHolder,
    keysToValues: MetadataKeyValuePair[],
    keyPrefixes?: string[],
    isMetadataKey?: boolean,
): Promise<void[]> => requestUpdateMetadata(manga, 'manga', keysToValues, keyPrefixes, isMetadataKey);

export const requestUpdateChapterMetadata = async (
    chapter: ChapterIdInfo & GqlMetaHolder,
    keysToValues: MetadataKeyValuePair[],
    keyPrefixes?: string[],
    isMetadataKey?: boolean,
): Promise<void[]> => requestUpdateMetadata(chapter, 'chapter', keysToValues, keyPrefixes, isMetadataKey);

export const requestUpdateCategoryMetadata = async (
    category: CategoryIdInfo & GqlMetaHolder,
    keysToValues: MetadataKeyValuePair[],
    keyPrefixes?: string[],
    isMetadataKey?: boolean,
): Promise<void[]> => requestUpdateMetadata(category, 'category', keysToValues, keyPrefixes, isMetadataKey);

export const requestUpdateSourceMetadata = async (
    source: SourceIdInfo & GqlMetaHolder,
    keysToValue: MetadataKeyValuePair[],
    keyPrefixes?: string[],
    isMetadataKey?: boolean,
): Promise<void[]> => requestUpdateMetadata(source, 'source', keysToValue, keyPrefixes, isMetadataKey);

export const getMetadataUpdateFunction = (
    type: MetadataHolderType,
    metadataHolder:
        | MetadataHolder
        | (MangaIdInfo & MetadataHolder)
        | (ChapterIdInfo & MetadataHolder)
        | (CategoryIdInfo & MetadataHolder)
        | (SourceIdInfo & MetadataHolder),
): ((keyValuePair: MetadataKeyValuePair[], keyPrefixes?: string[], isMetadataKey?: boolean) => Promise<void[]>) => {
    switch (type) {
        case 'global':
            return (...args) => requestUpdateServerMetadata(...args);
        case 'manga':
            return (...args) =>
                requestUpdateMangaMetadata(
                    { id: (metadataHolder as MangaIdInfo).id, meta: convertToGqlMeta(metadataHolder.meta) },
                    ...args,
                );
        case 'chapter':
            return (...args) =>
                requestUpdateChapterMetadata(
                    { id: (metadataHolder as ChapterIdInfo).id, meta: convertToGqlMeta(metadataHolder.meta) },
                    ...args,
                );
        case 'category':
            return (...args) =>
                requestUpdateCategoryMetadata(
                    { id: (metadataHolder as CategoryIdInfo).id, meta: convertToGqlMeta(metadataHolder.meta) },
                    ...args,
                );
        case 'source':
            return (...args) =>
                requestUpdateSourceMetadata(
                    {
                        id: (metadataHolder as SourceIdInfo).id,
                        meta: convertToGqlMeta(metadataHolder.meta),
                    },
                    ...args,
                );
        default:
            throw new Error(`Unexpected "type" (${type})`);
    }
};

export const requestDeleteMetadataValue = async (
    metadataHolder: GqlMetaHolder,
    holderType: MetadataHolderType,
    key: AppMetadataKeys,
    keyPrefixes?: string[],
    isMetadataKey: boolean = false,
): Promise<void> => {
    const metadataKey = isMetadataKey ? key : getMetadataKey(key, keyPrefixes);

    switch (holderType) {
        case 'category':
            await requestManager.deleteCategoryMeta((metadataHolder as CategoryIdInfo).id, metadataKey).response;
            break;
        case 'chapter':
            await requestManager.deleteChapterMeta((metadataHolder as ChapterIdInfo).id, metadataKey).response;
            break;
        case 'global':
            await requestManager.deleteGlobalMeta(metadataKey).response;
            break;
        case 'manga':
            await requestManager.deleteMangaMeta((metadataHolder as MangaIdInfo).id, metadataKey).response;
            break;
        case 'source':
            await requestManager.deleteSourceMeta((metadataHolder as SourceIdInfo).id, metadataKey).response;
            break;
        default:
            throw new Error(`requestDeleteMetadataValue: unknown holderType "${holderType}"`);
    }
};

async function requestDeleteMetadata(
    metadataHolder: GqlMetaHolder,
    holderType: MetadataHolderType,
    keys: AppMetadataKeys[],
    keyPrefixes?: string[],
    isMetadataKey?: boolean,
): Promise<void[]> {
    return Promise.all(
        keys.map((key) => requestDeleteMetadataValue(metadataHolder, holderType, key, keyPrefixes, isMetadataKey)),
    );
}

export const requestDeleteServerMetadata = async (
    keys: AppMetadataKeys[],
    keyPrefixes?: string[],
    isMetadataKey?: boolean,
): Promise<void[]> => requestDeleteMetadata({}, 'global', keys, keyPrefixes, isMetadataKey);

export const requestDeleteMangaMetadata = async (
    manga: MangaIdInfo & GqlMetaHolder,
    keys: AppMetadataKeys[],
    keyPrefixes?: string[],
    isMetadataKey?: boolean,
): Promise<void[]> => requestDeleteMetadata(manga, 'manga', keys, keyPrefixes, isMetadataKey);

export const requestDeleteChapterMetadata = async (
    chapter: ChapterIdInfo & GqlMetaHolder,
    keys: AppMetadataKeys[],
    keyPrefixes?: string[],
    isMetadataKey?: boolean,
): Promise<void[]> => requestDeleteMetadata(chapter, 'chapter', keys, keyPrefixes, isMetadataKey);

export const requestDeleteCategoryMetadata = async (
    category: CategoryIdInfo & GqlMetaHolder,
    keys: AppMetadataKeys[],
    keyPrefixes?: string[],
    isMetadataKey?: boolean,
): Promise<void[]> => requestDeleteMetadata(category, 'category', keys, keyPrefixes, isMetadataKey);

export const requestDeleteSourceMetadata = async (
    source: SourceIdInfo & GqlMetaHolder,
    keys: AppMetadataKeys[],
    keyPrefixes?: string[],
    isMetadataKey?: boolean,
): Promise<void[]> => requestDeleteMetadata(source, 'source', keys, keyPrefixes, isMetadataKey);

export const getMetadataDeleteFunction = (
    type: MetadataHolderType,
    metadataHolder:
        | MetadataHolder
        | (MangaIdInfo & MetadataHolder)
        | (ChapterIdInfo & MetadataHolder)
        | (CategoryIdInfo & MetadataHolder)
        | (SourceIdInfo & MetadataHolder),
): ((metadataToDelete: AppMetadataKeys[], keyPrefixes?: string[], isMetadataKey?: boolean) => Promise<void[]>) => {
    switch (type) {
        case 'global':
            return (...args) => requestDeleteServerMetadata(...args);
        case 'manga':
            return (...args) =>
                requestDeleteMangaMetadata(
                    { id: (metadataHolder as MangaIdInfo).id, meta: convertToGqlMeta(metadataHolder.meta) },
                    ...args,
                );
        case 'chapter':
            return (...args) =>
                requestDeleteChapterMetadata(
                    { id: (metadataHolder as ChapterIdInfo).id, meta: convertToGqlMeta(metadataHolder.meta) },
                    ...args,
                );
        case 'category':
            return (...args) =>
                requestDeleteCategoryMetadata(
                    { id: (metadataHolder as CategoryIdInfo).id, meta: convertToGqlMeta(metadataHolder.meta) },
                    ...args,
                );
        case 'source':
            return (...args) =>
                requestDeleteSourceMetadata(
                    {
                        id: (metadataHolder as SourceIdInfo).id,
                        meta: convertToGqlMeta(metadataHolder.meta),
                    },
                    ...args,
                );
        default:
            throw new Error(`Unexpected "type" (${type})`);
    }
};
