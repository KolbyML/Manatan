/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useMemo } from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies,no-restricted-imports
import { requestManager } from '@/lib/requests/RequestManager.ts';
import {
    requestUpdateMangaMetadata,
    requestUpdateServerMetadata,
} from '@/features/metadata/services/MetadataUpdater.ts';
import { MangaType } from '@/lib/requests/types.ts';
import { IReaderSettings, IReaderSettingsWithDefaultFlag, ReadingMode } from '@/features/reader/Reader.types.ts';
import { convertFromGqlMeta } from '@/features/metadata/services/MetadataConverter.ts';
import { getMetadataFrom } from '@/features/metadata/services/MetadataReader.ts';
import {
    AllowedMetadataValueTypes,
    GqlMetaHolder,
    Metadata,
    MetadataHolder,
    MetadataHolderType,
} from '@/features/metadata/Metadata.types.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { MangaIdInfo } from '@/features/manga/Manga.types.ts';
import {
    DEFAULT_READER_SETTINGS,
    GLOBAL_READER_SETTING_KEYS,
} from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { DEFAULT_DEVICE, getActiveDevice } from '@/features/device/services/Device.ts';
import { APP_METADATA_KEY_PREFIX } from '@/features/metadata/Metadata.constants.ts';
import { extractOriginalKey } from '@/features/metadata/Metadata.utils.ts';

const convertToSettingsWithDefaultFlag = (
    type: Extract<MetadataHolderType, 'global' | 'manga'>,
    settings: IReaderSettings,
    metadataHolder: MetadataHolder,
): IReaderSettingsWithDefaultFlag => {
    const activeDevice = getActiveDevice();
    const istDefaultDevice = activeDevice === DEFAULT_DEVICE;
    const existingSettings = Object.keys(metadataHolder.meta ?? {})
        // settings that are not for the active device need to be filtered out, otherwise, they mess up the "isDefault" flag
        .filter((metaKey) => {
            // the default device is not added as a prefix to the key, thus, there should only be the app prefix for these reader settings
            if (istDefaultDevice) {
                return metaKey.match(/_/g)?.length === 1;
            }

            return metaKey.startsWith(`${APP_METADATA_KEY_PREFIX}_${activeDevice}_`);
        })
        .map((metaKey) => extractOriginalKey(metaKey));
    const settingsWithDefault = Object.fromEntries(
        (Object.entries(settings) as [keyof IReaderSettings, IReaderSettings[keyof IReaderSettings]][]).map(
            ([key, value]) => {
                const isGlobalSetting = GLOBAL_READER_SETTING_KEYS.includes(key);
                if (isGlobalSetting) {
                    return [key, value];
                }

                const isDefaultSetting = type === 'manga' && !existingSettings.includes(key);
                return [
                    key,
                    {
                        value,
                        isDefault: isDefaultSetting,
                    },
                ];
            },
        ),
    ) as IReaderSettingsWithDefaultFlag;

    return settingsWithDefault;
};

const convertSettingsToMetadata = (
    settings: Partial<IReaderSettings>,
): Metadata<string, AllowedMetadataValueTypes> => ({
    ...settings,
    tapZoneInvertMode: JSON.stringify(settings.tapZoneInvertMode),
    customFilter: JSON.stringify(settings.customFilter),
    readerWidth: JSON.stringify(settings.readerWidth),
    hotkeys: JSON.stringify(settings.hotkeys),
    autoScroll: JSON.stringify(settings.autoScroll),
});

export const DEFAULT_READER_SETTINGS_WITH_DEFAULT_FLAG = convertToSettingsWithDefaultFlag(
    'global',
    DEFAULT_READER_SETTINGS,
    { meta: convertSettingsToMetadata(DEFAULT_READER_SETTINGS) as Metadata },
);

export const getReaderSettings = (
    type: Extract<MetadataHolderType, 'global' | 'manga'>,
    metadataHolder: (MangaIdInfo & MetadataHolder) | MetadataHolder,
    defaultSettings: IReaderSettings = DEFAULT_READER_SETTINGS,
    useEffectFn?: typeof useEffect,
    profile?: ReadingMode,
): IReaderSettings =>
    getMetadataFrom(
        type as Parameters<typeof getMetadataFrom>[0],
        metadataHolder as Parameters<typeof getMetadataFrom>[1],
        defaultSettings,
        profile !== undefined ? [profile.toString()] : undefined,
        useEffectFn,
    );

function getReaderSettingsWithDefaultValueFallback(
    type: 'global',
    metadataHolder: MetadataHolder,
    defaultSettings?: IReaderSettings,
    useEffectFn?: typeof useEffect,
    profile?: ReadingMode,
): IReaderSettingsWithDefaultFlag;
function getReaderSettingsWithDefaultValueFallback(
    type: 'manga',
    metadataHolder: MangaIdInfo & MetadataHolder,
    defaultSettings?: IReaderSettings,
    useEffectFn?: typeof useEffect,
    profile?: ReadingMode,
): IReaderSettingsWithDefaultFlag;
function getReaderSettingsWithDefaultValueFallback(
    type: Extract<MetadataHolderType, 'global' | 'manga'>,
    metadataHolder: (MangaIdInfo & MetadataHolder) | MetadataHolder,
    defaultSettings: IReaderSettings = DEFAULT_READER_SETTINGS,
    useEffectFn?: typeof useEffect,
    profile?: ReadingMode,
): IReaderSettingsWithDefaultFlag {
    const settings = getReaderSettings(type, metadataHolder, defaultSettings, useEffectFn, profile);
    return convertToSettingsWithDefaultFlag(type, settings, metadataHolder);
}

const getSettings = (
    metaHolder: MangaIdInfo & GqlMetaHolder,
    defaultSettings?: IReaderSettings,
    useEffectFn?: typeof useEffect,
    profile?: ReadingMode,
): IReaderSettingsWithDefaultFlag =>
    getReaderSettingsWithDefaultValueFallback(
        'manga',
        {
            ...metaHolder,
            meta: convertFromGqlMeta(
                metaHolder.meta,
                (key) => !GLOBAL_READER_SETTING_KEYS.includes(extractOriginalKey(key)),
            ),
        },
        defaultSettings,
        useEffectFn,
        profile,
    );

export const getReaderSettingsFor = (
    metaHolder: MangaIdInfo & GqlMetaHolder,
    defaultSettings: IReaderSettings,
): IReaderSettingsWithDefaultFlag => getSettings(metaHolder, defaultSettings);

export const useGetReaderSettingsFor = (
    metaHolder: MangaIdInfo & GqlMetaHolder,
    defaultSettings: IReaderSettings,
    profile?: ReadingMode,
): IReaderSettingsWithDefaultFlag => {
    const settings = getSettings(metaHolder, defaultSettings, useEffect, profile);
    return useMemo(() => settings, [metaHolder, defaultSettings, profile]);
};

export const useDefaultReaderSettings = (
    profile?: ReadingMode,
): {
    metadata?: Metadata;
    settings: IReaderSettings;
    loading: boolean;
    request: ReturnType<typeof requestManager.useGetGlobalMeta>;
} => {
    const request = requestManager.useGetGlobalMeta({ notifyOnNetworkStatusChange: true });
    const { data, loading } = request;
    const metadata = useMemo(() => convertFromGqlMeta(data?.metas.nodes), [data?.metas.nodes]);
    const metaHolder: MetadataHolder = useMemo(() => ({ meta: metadata }), [metadata]);
    // Ensure non-global reader settings have sane defaults even when no meta exists.
    const tmpSettings = getReaderSettings('global', metaHolder, DEFAULT_READER_SETTINGS, useEffect, profile);
    const settings = useMemo(() => tmpSettings, [metaHolder, profile]);

    return useMemo(
        () => ({
            metadata,
            settings,
            loading,
            request,
        }),
        [metadata, settings, loading, request],
    );
};

export const useDefaultReaderSettingsWithDefaultFlag = (
    profile?: ReadingMode,
): {
    metadata?: Metadata;
    settings: IReaderSettingsWithDefaultFlag;
    loading: boolean;
    request: ReturnType<typeof requestManager.useGetGlobalMeta>;
} => {
    const request = requestManager.useGetGlobalMeta({ notifyOnNetworkStatusChange: true });
    const { data, loading } = request;
    const metadata = useMemo(() => convertFromGqlMeta(data?.metas.nodes), [data?.metas.nodes]);
    const metaHolder: MetadataHolder = useMemo(() => ({ meta: metadata }), [metadata]);
    // Ensure non-global reader settings have sane defaults even when no meta exists.
    const tmpSettings = getReaderSettingsWithDefaultValueFallback(
        'global',
        metaHolder,
        DEFAULT_READER_SETTINGS,
        useEffect,
        profile,
    );
    const settings = useMemo(() => tmpSettings, [metaHolder, profile]);

    return useMemo(
        () => ({
            metadata,
            settings,
            loading,
            request,
        }),
        [metadata, settings, loading, request],
    );
};

export const updateReaderSettings = async <Setting extends keyof IReaderSettings = keyof IReaderSettings>(
    manga: Pick<MangaType, 'id'> & GqlMetaHolder,
    setting: Setting,
    value: IReaderSettings[Setting],
    isGlobal: boolean = false,
    profile?: ReadingMode,
): Promise<void[]> => {
    const isGlobalSetting = isGlobal || GLOBAL_READER_SETTING_KEYS.includes(setting);
    if (isGlobalSetting) {
        return requestUpdateServerMetadata(
            [[setting, convertSettingsToMetadata({ [setting]: value })[setting]]],
            profile !== undefined ? [profile?.toString()] : undefined,
        );
    }

    return requestUpdateMangaMetadata(
        manga,
        [[setting, convertSettingsToMetadata({ [setting]: value })[setting]]],
        profile !== undefined ? [profile?.toString()] : undefined,
    );
};
export const createUpdateReaderSettings =
    <Settings extends keyof IReaderSettings>(
        manga: Pick<MangaType, 'id'> & GqlMetaHolder,
        handleError: (error: any) => void = defaultPromiseErrorHandler('createUpdateReaderSettings'),
        profile?: ReadingMode,
    ): ((...args: OmitFirst<Parameters<typeof updateReaderSettings<Settings>>>) => Promise<void | void[]>) =>
    (setting, value, isGlobal) =>
        updateReaderSettings(manga, setting, value, isGlobal, profile).catch(handleError);
