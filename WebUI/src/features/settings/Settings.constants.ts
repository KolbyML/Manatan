/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { d } from 'koration';
import { DEFAULT_DEVICE } from '@/features/device/services/Device.ts';
import { DEFAULT_SORT_SETTINGS } from '@/features/migration/Migration.constants.ts';
import {
    GlobalUpdateSkipEntriesSettings,
    ImageProcessingTargetMode,
    ImageProcessingType,
    MetadataServerSettings,
    ServerSettings,
} from '@/features/settings/Settings.types.ts';
import { GridLayout, TranslationKey } from '@/base/Base.types.ts';
import { getDefaultLanguages } from '@/base/utils/Languages.ts';
import { SelectSettingValue, SelectSettingValueDisplayInfo } from '@/base/components/settings/SelectSetting.tsx';
import {
    AuthMode,
    KoreaderSyncChecksumMethod,
    KoreaderSyncConflictStrategy,
    WebUiChannel,
    WebUiFlavor,
    WebUiInterface,
} from '@/lib/requests/types.ts';
import { ThemeMode } from '@/features/theme/AppTheme.types.ts';

export const MANGA_GRID_WIDTH = {
    min: 100,
    max: 1000,
    step: 10,
    default: 300,
};

export const SERVER_SETTINGS_METADATA_DEFAULT: MetadataServerSettings = {
    // downloads
    deleteChaptersManuallyMarkedRead: false,
    deleteChaptersWhileReading: 0,
    deleteChaptersWithBookmark: false,
    downloadAheadLimit: 0,

    // library
    showAddToLibraryCategorySelectDialog: true,
    ignoreFilters: false,
    removeMangaFromCategories: false,
    showTabSize: false,
    showContinueReadingButton: false,
    showDownloadBadge: false,
    showUnreadBadge: false,
    gridLayout: GridLayout.Compact,

    // client
    devices: [DEFAULT_DEVICE],

    // migration
    migrateChapters: true,
    migrateCategories: true,
    migrateTracking: true,
    deleteChapters: true,
    migrateSortSettings: DEFAULT_SORT_SETTINGS,

    // browse
    hideLibraryEntries: false,
    extensionLanguages: getDefaultLanguages(),
    animeExtensionLanguages: ['ja', 'en', 'all'],
    sourceLanguages: getDefaultLanguages(),
    animeSourceLanguages: ['en', 'ja', 'all'],
    showNsfw: true,
    lastUsedSourceId: null,
    shouldShowOnlySourcesWithResults: true,

    // history
    hideHistory: false,

    // tracking
    updateProgressAfterReading: true,
    updateProgressManualMarkRead: false,

    // updates
    webUIInformAvailableUpdate: true,
    serverInformAvailableUpdate: true,

    // themes
    appTheme: 'default',
    themeMode: ThemeMode.SYSTEM,
    shouldUsePureBlackMode: false,
    customThemes: {},
    mangaThumbnailBackdrop: true,
    mangaDynamicColorSchemes: true,
    mangaGridItemWidth: MANGA_GRID_WIDTH.default,
};

const AUTH_MODES = [AuthMode.None].concat(Object.values(AuthMode).filter((mode) => mode !== AuthMode.None));
const AUTH_MODES_TO_TRANSLATION_KEY: { [mode in AuthMode]: SelectSettingValueDisplayInfo } = {
    [AuthMode.None]: {
        text: 'settings.server.auth.mode.option.none.label.title',
        description: 'settings.server.auth.mode.option.none.label.description',
        disclaimer: 'settings.server.auth.mode.option.none.label.info',
    },
    [AuthMode.BasicAuth]: {
        text: 'settings.server.auth.mode.option.basicAuth.label.title',
        description: 'settings.server.auth.mode.option.basicAuth.label.description',
    },
    [AuthMode.SimpleLogin]: {
        text: 'settings.server.auth.mode.option.simple_login.label.title',
        description: 'settings.server.auth.mode.option.simple_login.label.description',
        disclaimer: 'settings.server.auth.mode.option.simple_login.label.info',
    },
    [AuthMode.UiLogin]: {
        text: 'settings.server.auth.mode.option.ui_login.label.title',
        description: 'settings.server.auth.mode.option.ui_login.label.description',
    },
};
export const AUTH_MODES_SELECT_VALUES: SelectSettingValue<AuthMode>[] = AUTH_MODES.map((mode) => [
    mode,
    AUTH_MODES_TO_TRANSLATION_KEY[mode],
]);

const WEB_UI_FLAVORS = Object.values(WebUiFlavor);
const WEB_UI_FLAVOR_TO_TRANSLATION_KEY: { [flavor in WebUiFlavor]: SelectSettingValueDisplayInfo } = {
    [WebUiFlavor.Webui]: {
        text: 'settings.webui.title.webui',
        description: 'settings.webui.flavor.option.webui.label.description',
        disclaimer: 'settings.webui.flavor.label.info',
    },
    [WebUiFlavor.Vui]: {
        text: 'settings.webui.flavor.option.vui.label.title',
        description: 'settings.webui.flavor.option.vui.label.description',
        disclaimer: 'settings.webui.flavor.label.info',
    },
    [WebUiFlavor.Custom]: {
        text: 'settings.webui.flavor.option.custom.label.title',
        description: 'settings.webui.flavor.option.custom.label.description',
    },
};
export const WEB_UI_FLAVOR_SELECT_VALUES: SelectSettingValue<WebUiFlavor>[] = WEB_UI_FLAVORS.map((flavor) => [
    flavor,
    WEB_UI_FLAVOR_TO_TRANSLATION_KEY[flavor],
]);

const WEB_UI_CHANNELS = Object.values(WebUiChannel);
const WEB_UI_CHANNEL_TO_TRANSLATION_KEYS: {
    [channel in WebUiChannel]: SelectSettingValueDisplayInfo;
} = {
    [WebUiChannel.Bundled]: {
        text: 'settings.webui.channel.option.bundled.label.title',
        description: 'settings.webui.channel.option.bundled.label.description',
        disclaimer: 'settings.webui.flavor.label.info',
    },
    [WebUiChannel.Stable]: {
        text: 'settings.webui.channel.option.stable.label.title',
        description: 'settings.webui.channel.option.stable.label.description',
        disclaimer: 'settings.webui.flavor.label.info',
    },
    [WebUiChannel.Preview]: {
        text: 'settings.webui.channel.option.preview.label.title',
        description: 'settings.webui.channel.option.preview.label.description',
        disclaimer: 'settings.webui.channel.option.preview.label.disclaimer',
    },
};
export const WEB_UI_CHANNEL_SELECT_VALUES: SelectSettingValue<WebUiChannel>[] = WEB_UI_CHANNELS.map((channel) => [
    channel,
    WEB_UI_CHANNEL_TO_TRANSLATION_KEYS[channel],
]);

const WEB_UI_INTERFACES = Object.values(WebUiInterface);
const WEB_UI_INTERFACE_TO_TRANSLATION_KEYS: {
    [webUIInterface in WebUiInterface]: SelectSettingValueDisplayInfo;
} = {
    [WebUiInterface.Browser]: {
        text: 'settings.webui.interface.option.label.browser',
        description: 'settings.webui.interface.label.description',
    },
    [WebUiInterface.Electron]: {
        text: 'settings.webui.interface.option.label.electron',
        description: 'settings.webui.interface.label.description',
    },
};
export const WEB_UI_INTERFACE_SELECT_VALUES: SelectSettingValue<WebUiInterface>[] = WEB_UI_INTERFACES.map(
    (webUIInterface) => [webUIInterface, WEB_UI_INTERFACE_TO_TRANSLATION_KEYS[webUIInterface]],
);

export const GLOBAL_UPDATE_INTERVAL = {
    default: d(12).hours.inWholeHours,
    min: d(6).hours.inWholeHours,
    max: d(1).months.inWholeHours,
};

export const GLOBAL_UPDATE_SKIP_ENTRIES_TO_TRANSLATION: {
    [setting in keyof GlobalUpdateSkipEntriesSettings]: TranslationKey;
} = {
    excludeUnreadChapters: 'library.settings.global_update.entries.label.unread_chapters',
    excludeNotStarted: 'library.settings.global_update.entries.label.not_started',
    excludeCompleted: 'library.settings.global_update.entries.label.completed',
};

export const WEB_UI_UPDATE_INTERVAL = {
    default: d(23).hours.inWholeHours,
    min: d(1).hours.inWholeHours,
    max: d(23).hours.inWholeHours,
};

export const JWT_ACCESS_TOKEN_EXPIRY = {
    default: d(5).minutes.inWholeMinutes,
    min: d(1).minutes.inWholeMinutes,
    max: d(4).hours.inWholeMinutes,
};

export const JWT_REFRESH_TOKEN_EXPIRY = {
    default: d(60).days.inWholeDays,
    min: d(1).days.inWholeDays,
    max: d(1).years.inWholeDays,
};

export const KOREADER_SYNC_PERCENTAGE_TOLERANCE = {
    default: 1.0e-15,
    min: 1.0e-15,
    max: 1,
    step: 0.05,
};

export const KOREADER_SYNC_CONFLICT_STRATEGIES = Object.values(KoreaderSyncConflictStrategy);
export const KOREADER_SYNC_CONFLICT_STRATEGY_TO_TRANSLATION_KEYS: Record<
    KoreaderSyncConflictStrategy,
    SelectSettingValueDisplayInfo
> = {
    [KoreaderSyncConflictStrategy.Disabled]: {
        text: 'settings.server.koreader.sync.strategy.option.disabled',
    },
    [KoreaderSyncConflictStrategy.KeepLocal]: {
        text: 'settings.server.koreader.sync.strategy.option.keep_local',
    },
    [KoreaderSyncConflictStrategy.KeepRemote]: {
        text: 'settings.server.koreader.sync.strategy.option.keep_remote',
    },
    [KoreaderSyncConflictStrategy.Prompt]: {
        text: 'settings.server.koreader.sync.strategy.option.prompt',
    },
};
export const KOREADER_SYNC_CONFLICT_STRATEGY_SELECT_VALUES: SelectSettingValue<KoreaderSyncConflictStrategy>[] =
    KOREADER_SYNC_CONFLICT_STRATEGIES.map((strategy) => [
        strategy,
        KOREADER_SYNC_CONFLICT_STRATEGY_TO_TRANSLATION_KEYS[strategy],
    ]);

export const KOREADER_SYNC_CHECKSUM_METHODES = Object.values(KoreaderSyncChecksumMethod);
export const KOREADER_SYNC_CHECKSUM_METHOD_TO_TRANSLATION_KEYS: Record<
    KoreaderSyncChecksumMethod,
    SelectSettingValueDisplayInfo
> = {
    [KoreaderSyncChecksumMethod.Binary]: {
        text: 'settings.server.koreader.sync.check_sum_method.binary',
    },
    [KoreaderSyncChecksumMethod.Filename]: {
        text: 'settings.server.koreader.sync.check_sum_method.filename',
    },
};
export const KOREADER_SYNC_CHECKSUM_METHOD_SELECT_VALUES: SelectSettingValue<KoreaderSyncChecksumMethod>[] =
    KOREADER_SYNC_CHECKSUM_METHODES.map((method) => [
        method,
        KOREADER_SYNC_CHECKSUM_METHOD_TO_TRANSLATION_KEYS[method],
    ]);

export const IMAGE_PROCESSING_COMPRESSION = {
    min: 0,
    max: 1,
    step: 0.01,
};
export const IMAGE_PROCESSING_CALL_TIMEOUT = {
    min: d(10).seconds.inWholeSeconds,
    max: d(10).minutes.inWholeSeconds,
    step: d(10).seconds.inWholeSeconds,
};
export const IMAGE_PROCESSING_CONNECT_TIMEOUT = {
    min: d(10).seconds.inWholeSeconds,
    max: d(10).minutes.inWholeSeconds,
    step: d(10).seconds.inWholeSeconds,
};

const IMAGE_PROCESSING_TARGET_MODES = Object.values(ImageProcessingTargetMode);
const IMAGE_PROCESSING_TARGET_MODES_TO_TRANSLATION_KEY: {
    [flavor in ImageProcessingTargetMode]: SelectSettingValueDisplayInfo;
} = {
    [ImageProcessingTargetMode.DISABLED]: {
        text: 'global.label.disabled',
    },
    [ImageProcessingTargetMode.IMAGE]: {
        text: 'download.settings.conversion.target_modes.image.title',
        description: 'download.settings.conversion.target_modes.image.description',
    },
    [ImageProcessingTargetMode.URL]: {
        text: 'download.settings.conversion.target_modes.url.title',
        description: 'download.settings.conversion.target_modes.image.description',
    },
};
export const IMAGE_PROCESSING_TARGET_MODES_SELECT_VALUES: SelectSettingValue<ImageProcessingTargetMode>[] =
    IMAGE_PROCESSING_TARGET_MODES.map((mode) => [mode, IMAGE_PROCESSING_TARGET_MODES_TO_TRANSLATION_KEY[mode]]);

export const IMAGE_PROCESSING_INPUT_WIDTH = 250;
export const DEFAULT_MIME_TYPE = 'default';
export const MIME_TYPE_PREFIX = 'image/';
export const TARGET_DISABLED = 'none';

export const IMAGE_PROCESSING_TYPE_TO_TRANSLATION: Record<ImageProcessingType, TranslationKey> = {
    [ImageProcessingType.DOWNLOAD]: 'download.settings.conversion.title',
    [ImageProcessingType.SERVE]: 'settings.images.processing.serve.title',
};

export const IMAGE_PROCESSING_TYPE_TO_SETTING: Record<
    ImageProcessingType,
    Extract<keyof ServerSettings, 'downloadConversions' | 'serveConversions'>
> = {
    [ImageProcessingType.DOWNLOAD]: 'downloadConversions',
    [ImageProcessingType.SERVE]: 'serveConversions',
};
