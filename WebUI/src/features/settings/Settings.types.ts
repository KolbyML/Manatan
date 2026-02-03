/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { MetadataDownloadSettings } from '@/features/downloads/Downloads.types.ts';
import { MetadataLibrarySettings } from '@/features/library/Library.types.ts';
import { MetadataClientSettings } from '@/features/device/Device.types.ts';
import { MetadataMigrationSettings } from '@/features/migration/Migration.types.ts';
import { MetadataBrowseSettings } from '@/features/browse/Browse.types.ts';
import { MetadataTrackingSettings } from '@/features/tracker/Tracker.types.ts';
import { MetadataUpdateSettings } from '@/features/app-updates/AppUpdateChecker.types.ts';
import { MetadataThemeSettings } from '@/features/theme/AppTheme.types.ts';
import {
    GetServerSettingsQuery,
    Maybe,
    SettingsDownloadConversion,
    SettingsDownloadConversionHeader,
} from '@/lib/requests/types.ts';
import { MetadataHistorySettings } from '@/features/history/History.types.ts';

export type MetadataServerSettingKeys = keyof MetadataServerSettings;

export type SearchMetadataKeys = keyof ISearchSettings;

export type MetadataServerSettings = MetadataDownloadSettings &
    MetadataLibrarySettings &
    MetadataClientSettings &
    MetadataMigrationSettings &
    MetadataBrowseSettings &
    MetadataTrackingSettings &
    MetadataUpdateSettings &
    MetadataThemeSettings &
    MetadataHistorySettings;

export interface ISearchSettings {
    ignoreFilters: boolean;
}

export type ServerSettings = Omit<GetServerSettingsQuery['settings'], '__typename'>;

export type GlobalUpdateSkipEntriesSettings = Pick<
    ServerSettings,
    'excludeUnreadChapters' | 'excludeNotStarted' | 'excludeCompleted'
>;

export type LibrarySettingsType = Pick<ServerSettings, 'updateMangas'>;

export enum ImageProcessingTargetMode {
    DISABLED = 'disabled',
    IMAGE = 'image',
    URL = 'url',
}

export enum ImageProcessingType {
    DOWNLOAD = 'download',
    SERVE = 'serve',
}

export type TSettingsDownloadConversionHeader = SettingsDownloadConversionHeader & {
    /**
     * The conversion object does not have a stable key, which causes issues when editing the settings
     */
    id: number;
};

export type TSettingsDownloadConversion = Omit<SettingsDownloadConversion, 'headers'> & {
    /**
     * The conversion object does not have a stable key, which causes issues when editing the settings
     */
    id: number;
    mode: ImageProcessingTargetMode;
    headers?: Maybe<TSettingsDownloadConversionHeader[]>;
};
