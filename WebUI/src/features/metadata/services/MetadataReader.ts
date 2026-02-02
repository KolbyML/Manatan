/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect } from 'react';
import { convertValueFromMetadata } from '@/features/metadata/services/MetadataConverter.ts';
import {
    AllowedMetadataValueTypes,
    AppMetadataKeys,
    Metadata,
    MetadataHolder,
    MetadataHolderType,
} from '@/features/metadata/Metadata.types.ts';
import { MangaIdInfo } from '@/features/manga/Manga.types.ts';

import { CategoryIdInfo } from '@/features/category/Category.types.ts';
import { doesMetadataKeyExistIn, getMetadataKey } from '@/features/metadata/Metadata.utils.ts';
import { applyMetadataMigrations } from '@/features/metadata/services/MetadataMigrations.ts';
import { SourceIdInfo } from '@/features/source/Source.types.ts';
import { ChapterIdInfo } from '@/features/chapter/Chapter.types.ts';
import { APP_METADATA } from '@/features/metadata/Metadata.constants.ts';
import { MetadataValueCache } from '@/features/metadata/services/MetadataValueCache.ts';

const getHolderId = (
    type: MetadataHolderType,
    metadataHolder:
        | MetadataHolder
        | (MangaIdInfo & MetadataHolder)
        | (ChapterIdInfo & MetadataHolder)
        | (CategoryIdInfo & MetadataHolder)
        | (SourceIdInfo & MetadataHolder),
): string | number | undefined => {
    switch (type) {
        case 'global':
            return undefined;
        case 'manga':
            return (metadataHolder as MangaIdInfo).id;
        case 'chapter':
            return (metadataHolder as ChapterIdInfo).id;
        case 'category':
            return (metadataHolder as CategoryIdInfo).id;
        case 'source':
            return (metadataHolder as SourceIdInfo).id;
        default:
            return undefined;
    }
};

const getRawMetadataValueFrom = (
    metadata: Metadata | undefined,
    key: string,
    prefixes?: string[],
): string | undefined => {
    if (
        metadata === undefined ||
        !doesMetadataKeyExistIn(metadata, key, prefixes) ||
        metadata[getMetadataKey(key, prefixes)] === undefined
    ) {
        return undefined;
    }

    return metadata[getMetadataKey(key, prefixes)];
};

const getMetadataValueFrom = <Key extends AppMetadataKeys, Value extends AllowedMetadataValueTypes>(
    metadata: Metadata | undefined,
    key: Key,
    defaultValue?: Value,
    prefixes?: string[],
): Value | undefined => {
    const rawValue = getRawMetadataValueFrom(metadata, key, prefixes);

    if (rawValue === undefined) {
        return defaultValue;
    }

    const convertedValue = convertValueFromMetadata(key, rawValue, defaultValue);

    return APP_METADATA[key].toConstrainedValue?.(convertedValue) ?? convertedValue;
};

export function getMetadataFrom<METADATA extends Partial<Metadata<AppMetadataKeys, any>>>(
    type: 'global',
    metadataHolder: MetadataHolder,
    metadataWithDefaultValues: METADATA,
    prefixes?: string[],
    useEffectFn?: typeof useEffect,
): METADATA;
export function getMetadataFrom<METADATA extends Partial<Metadata<AppMetadataKeys, any>>>(
    type: 'manga',
    metadataHolder: MangaIdInfo & MetadataHolder,
    metadataWithDefaultValues: METADATA,
    prefixes?: string[],
    useEffectFn?: typeof useEffect,
): METADATA;
export function getMetadataFrom<METADATA extends Partial<Metadata<AppMetadataKeys, any>>>(
    type: 'chapter',
    metadataHolder: ChapterIdInfo & MetadataHolder,
    metadataWithDefaultValues: METADATA,
    prefixes?: string[],
    useEffectFn?: typeof useEffect,
): METADATA;
export function getMetadataFrom<METADATA extends Partial<Metadata<AppMetadataKeys, any>>>(
    type: 'category',
    metadataHolder: CategoryIdInfo & MetadataHolder,
    metadataWithDefaultValues: METADATA,
    prefixes?: string[],
    useEffectFn?: typeof useEffect,
): METADATA;
export function getMetadataFrom<METADATA extends Partial<Metadata<AppMetadataKeys, any>>>(
    type: 'source',
    metadataHolder: SourceIdInfo & MetadataHolder,
    metadataWithDefaultValues: METADATA,
    prefixes?: string[],
    useEffectFn?: typeof useEffect,
): METADATA;
export function getMetadataFrom<METADATA extends Partial<Metadata<AppMetadataKeys, any>>>(
    type: MetadataHolderType,
    metadataHolder:
        | MetadataHolder
        | (MangaIdInfo & MetadataHolder)
        | (ChapterIdInfo & MetadataHolder)
        | (CategoryIdInfo & MetadataHolder)
        | (SourceIdInfo & MetadataHolder),
    metadataWithDefaultValues: METADATA,
    prefixes?: string[],
    useEffectFn: typeof useEffect = (fn: () => void) => fn(),
): METADATA {
    const migratedMetadata = applyMetadataMigrations(type, metadataHolder, useEffectFn);
    const appMetadata = {} as METADATA;
    const holderId = getHolderId(type, metadataHolder);

    Object.entries(metadataWithDefaultValues).forEach(([key, defaultValue]) => {
        const rawValue = getRawMetadataValueFrom(migratedMetadata, key as AppMetadataKeys, prefixes);
        const newValue = getMetadataValueFrom(migratedMetadata, key as AppMetadataKeys, defaultValue, prefixes);

        appMetadata[key as AppMetadataKeys] = MetadataValueCache.getStableValue(
            type,
            holderId,
            getMetadataKey(key, prefixes),
            rawValue,
            newValue,
        );
    });

    return appMetadata;
}
