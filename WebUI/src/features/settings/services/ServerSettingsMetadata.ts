/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useMemo } from 'react';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { requestUpdateServerMetadata } from '@/features/metadata/services/MetadataUpdater.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { SERVER_SETTINGS_METADATA_DEFAULT } from '@/features/settings/Settings.constants.ts';
import { MetadataServerSettingKeys, MetadataServerSettings } from '@/features/settings/Settings.types.ts';
import { convertFromGqlMeta } from '@/features/metadata/services/MetadataConverter.ts';
import { getMetadataFrom } from '@/features/metadata/services/MetadataReader.ts';
import { AllowedMetadataValueTypes, Metadata } from '@/features/metadata/Metadata.types.ts';

export const convertSettingsToMetadata = (
    settings: Partial<MetadataServerSettings>,
): Metadata<string, AllowedMetadataValueTypes> => ({
    ...settings,
    devices: JSON.stringify(settings.devices),
    customThemes: JSON.stringify(settings.customThemes),
    migrateSortSettings: JSON.stringify(settings.migrateSortSettings),
    extensionLanguages: JSON.stringify(settings.extensionLanguages),
    animeExtensionLanguages: JSON.stringify(settings.animeExtensionLanguages),
    sourceLanguages: JSON.stringify(settings.sourceLanguages),
    animeSourceLanguages: JSON.stringify(settings.animeSourceLanguages),
});

const getMetadataServerSettingsWithDefaultFallback = (
    meta?: Metadata,
    defaultSettings: MetadataServerSettings = SERVER_SETTINGS_METADATA_DEFAULT,
    useEffectFn?: typeof useEffect,
): MetadataServerSettings => getMetadataFrom('global', { meta }, defaultSettings, undefined, useEffectFn);

export const useMetadataServerSettings = (): {
    metadata?: Metadata;
    settings: MetadataServerSettings;
    loading: boolean;
    request: ReturnType<typeof requestManager.useGetGlobalMeta>;
} => {
    const request = requestManager.useGetGlobalMeta({ notifyOnNetworkStatusChange: true });
    const { data, loading } = request;
    const metadata = useMemo(() => convertFromGqlMeta(data?.metas.nodes), [data?.metas.nodes]);
    const tmpSettings = getMetadataServerSettingsWithDefaultFallback(metadata, undefined, useEffect);
    const settings = useMemo(() => tmpSettings, [metadata]);

    return useMemo(() => ({ metadata, settings, loading, request }), [metadata, settings, loading, request]);
};

export const getMetadataServerSettings = async (): Promise<MetadataServerSettings> => {
    const { data, error } = await requestManager.getGlobalMeta().response;

    if (error) {
        throw error;
    }

    const metadata = convertFromGqlMeta(data?.metas.nodes);
    return getMetadataServerSettingsWithDefaultFallback(metadata);
};

export const updateMetadataServerSettings = async <
    Settings extends MetadataServerSettingKeys = MetadataServerSettingKeys,
    Setting extends Settings = Settings,
>(
    setting: Setting,
    value: MetadataServerSettings[Setting],
): Promise<void[]> =>
    requestUpdateServerMetadata([[setting, convertSettingsToMetadata({ [setting]: value })[setting]]]);

export const createUpdateMetadataServerSettings =
    <Settings extends MetadataServerSettingKeys>(
        handleError: (error: any) => void = defaultPromiseErrorHandler('createUpdateMetadataServerSettings'),
    ): ((...args: Parameters<typeof updateMetadataServerSettings<Settings>>) => Promise<void | void[]>) =>
    (setting, value) =>
        updateMetadataServerSettings(setting, value).catch(handleError);
