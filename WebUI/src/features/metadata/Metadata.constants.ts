/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// eslint-disable-next-line import/no-extraneous-dependencies,no-restricted-imports
import deepmerge from '@mui/utils/deepmerge';
import { AppMetadataKeys, IMetadataMigration } from '@/features/metadata/Metadata.types.ts';
import {
    IReaderSettings,
    ProgressBarPosition,
    ReaderCustomFilter,
    ReaderPageScaleMode,
    ReadingMode,
} from '@/features/reader/Reader.types.ts';
import {
    AUTO_SCROLL_SPEED,
    CUSTOM_FILTER,
    DEFAULT_READER_SETTINGS,
    IMAGE_PRE_LOAD_AMOUNT,
    PAGE_GAP,
    PROGRESS_BAR_SIZE,
    SCROLL_AMOUNT,
} from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { coerceIn, jsonSaveParse } from '@/lib/HelperFunctions.ts';
import { DOWNLOAD_AHEAD } from '@/features/downloads/Downloads.constants.ts';
import { MANGA_GRID_WIDTH } from '@/features/settings/Settings.constants.ts';
import { SortSettings } from '@/features/migration/Migration.types.ts';
import { ISourceMetadata } from '@/features/source/Source.types.ts';
import { LibraryOptions } from '@/features/library/Library.types.ts';
import { MetadataThemeSettings } from '@/features/theme/AppTheme.types.ts';
import { TapZoneInvertMode } from '@/features/reader/tap-zones/TapZoneLayout.types.ts';

export const APP_METADATA_KEY_PREFIX = 'webUI';

const convertToTypeNullAndUndefined = <T>(value: string, convertToType: (value: string) => T): NullAndUndefined<T> => {
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    return convertToType(value);
};
const convertToString = (value: string): string => value;
const convertToNumber = (value: string): number => +value;
const convertToBoolean = (value: string): boolean => value === 'true';
const convertToStringNullAndUndefined = (value: string) => convertToTypeNullAndUndefined(value, convertToString);
const convertToBooleanNullAndUndefined = (value: string) => convertToTypeNullAndUndefined(value, convertToBoolean);
const convertToObject = <T>(value: string, defaultValue: T): T => {
    const convertedValue = jsonSaveParse<T>(value) ?? defaultValue;

    if (Array.isArray(convertedValue)) {
        return convertedValue;
    }

    if (defaultValue == null) {
        return convertedValue;
    }

    return deepmerge(defaultValue, convertedValue);
};

export const APP_METADATA: Record<
    AppMetadataKeys,
    {
        convert: (value: string, defaultValue: any) => any;
        toConstrainedValue?: (value: any) => any;
    }
> = {
    migration: {
        convert: convertToNumber,
    },
    deleteChaptersManuallyMarkedRead: {
        convert: convertToBoolean,
    },
    deleteChaptersWhileReading: {
        convert: convertToNumber,
    },
    deleteChaptersWithBookmark: {
        convert: convertToBoolean,
    },
    downloadAheadLimit: {
        convert: convertToNumber,
        toConstrainedValue: (value: number) => {
            const isDisabled = value === 0;
            if (isDisabled) {
                return value;
            }

            return coerceIn(value, DOWNLOAD_AHEAD.min, DOWNLOAD_AHEAD.max);
        },
    },
    showAddToLibraryCategorySelectDialog: {
        convert: convertToBoolean,
    },
    ignoreFilters: {
        convert: convertToBoolean,
    },
    removeMangaFromCategories: {
        convert: convertToBoolean,
    },
    showTabSize: {
        convert: convertToBoolean,
    },
    devices: {
        convert: convertToObject<string[]>,
    },
    migrateChapters: {
        convert: convertToBoolean,
    },
    migrateCategories: {
        convert: convertToBoolean,
    },
    migrateTracking: {
        convert: convertToBoolean,
    },
    deleteChapters: {
        convert: convertToBoolean,
    },
    migrateSortSettings: {
        convert: convertToObject<SortSettings>,
    },
    hideLibraryEntries: {
        convert: convertToBoolean,
    },
    updateProgressAfterReading: {
        convert: convertToBoolean,
    },
    updateProgressManualMarkRead: {
        convert: convertToBoolean,
    },
    webUIInformAvailableUpdate: {
        convert: convertToBoolean,
    },
    serverInformAvailableUpdate: {
        convert: convertToBoolean,
    },
    readerWidth: {
        convert: convertToObject<IReaderSettings['readerWidth']>,
    },
    savedSearches: {
        convert: convertToObject<ISourceMetadata['savedSearches']>,
    },
    showContinueReadingButton: {
        convert: convertToBoolean,
    },
    showDownloadBadge: {
        convert: convertToBoolean,
    },
    showUnreadBadge: {
        convert: convertToBoolean,
    },
    gridLayout: {
        convert: convertToNumber, // GridLayout (enum)
    },
    sortBy: {
        convert: convertToStringNullAndUndefined, // LibrarySortMode
    },
    sortDesc: {
        convert: convertToBooleanNullAndUndefined,
    },
    hasDownloadedChapters: {
        convert: convertToBooleanNullAndUndefined,
    },
    hasBookmarkedChapters: {
        convert: convertToBooleanNullAndUndefined,
    },
    hasUnreadChapters: {
        convert: convertToBooleanNullAndUndefined,
    },
    hasReadChapters: {
        convert: convertToBooleanNullAndUndefined,
    },
    hasDuplicateChapters: {
        convert: convertToBooleanNullAndUndefined,
    },
    hasTrackerBinding: {
        convert: convertToObject<LibraryOptions['hasTrackerBinding']>,
    },
    hasStatus: {
        convert: convertToObject<LibraryOptions['hasStatus']>,
    },
    customThemes: {
        convert: convertToObject<MetadataThemeSettings['customThemes']>,
    },
    mangaThumbnailBackdrop: {
        convert: convertToBoolean,
    },
    mangaDynamicColorSchemes: {
        convert: convertToBoolean,
    },
    tapZoneLayout: {
        convert: convertToNumber, // TapZoneLayouts (enum)
    },
    tapZoneInvertMode: {
        convert: convertToObject<TapZoneInvertMode>, // TapZoneInvertMode (object)
    },
    readingDirection: {
        convert: convertToNumber, // ReadingDirection (enum)
    },
    progressBarType: {
        convert: convertToNumber, // ProgressBarType (enum)
    },
    progressBarSize: {
        convert: convertToNumber,
        toConstrainedValue: (value: number) => coerceIn(value, PROGRESS_BAR_SIZE.min, PROGRESS_BAR_SIZE.max),
    },
    progressBarPosition: {
        convert: convertToNumber, // ProgressBarPosition (enum)
    },
    progressBarPositionAutoVertical: {
        convert: convertToNumber, // TProgressBarPositionAutoVertical (enum)
    },
    readingMode: {
        convert: convertToNumber, // ReadingMode (enum)
    },
    pageScaleMode: {
        convert: convertToNumber, // ReaderPageScaleMode (enum)
    },
    shouldOffsetDoubleSpreads: {
        convert: convertToBoolean,
    },
    exitMode: {
        convert: convertToNumber, // ReaderExitMode (enum)
    },
    customFilter: {
        convert: convertToObject<ReaderCustomFilter>,
        toConstrainedValue: (value: ReaderCustomFilter): ReaderCustomFilter => ({
            ...value,
            brightness: {
                ...value.brightness,
                value: coerceIn(value.brightness.value, CUSTOM_FILTER.brightness.min, CUSTOM_FILTER.brightness.max),
            },
            contrast: {
                ...value.contrast,
                value: coerceIn(value.contrast.value, CUSTOM_FILTER.contrast.min, CUSTOM_FILTER.contrast.max),
            },
            saturate: {
                ...value.saturate,
                value: coerceIn(value.saturate.value, CUSTOM_FILTER.saturate.min, CUSTOM_FILTER.saturate.max),
            },
            hue: {
                ...value.hue,
                value: coerceIn(value.hue.value, CUSTOM_FILTER.hue.min, CUSTOM_FILTER.hue.max),
            },
            rgba: {
                ...value.rgba,
                value: {
                    ...value.rgba.value,
                    red: coerceIn(value.rgba.value.red, CUSTOM_FILTER.rgba.red.min, CUSTOM_FILTER.rgba.red.max),
                    green: coerceIn(value.rgba.value.green, CUSTOM_FILTER.rgba.green.min, CUSTOM_FILTER.rgba.green.max),
                    blue: coerceIn(value.rgba.value.blue, CUSTOM_FILTER.rgba.blue.min, CUSTOM_FILTER.rgba.blue.max),
                    alpha: coerceIn(value.rgba.value.alpha, CUSTOM_FILTER.rgba.alpha.min, CUSTOM_FILTER.rgba.alpha.max),
                },
            },
        }),
    },
    shouldSkipDupChapters: {
        convert: convertToBoolean,
    },
    shouldSkipFilteredChapters: {
        convert: convertToBoolean,
    },
    isStaticNav: {
        convert: convertToBoolean,
    },
    overlayMode: {
        convert: convertToNumber, // ReaderOverlayMode (enum)
    },
    shouldStretchPage: {
        convert: convertToBoolean,
    },
    shouldShowPageNumber: {
        convert: convertToBoolean,
    },
    backgroundColor: {
        convert: convertToNumber, // ReaderBackgroundColor (enum)
    },
    pageGap: {
        convert: convertToNumber,
        toConstrainedValue: (value: number) => coerceIn(value, PAGE_GAP.min, PAGE_GAP.max),
    },
    hotkeys: {
        convert: convertToObject<IReaderSettings['hotkeys']>,
    },
    imagePreLoadAmount: {
        convert: convertToNumber,
        toConstrainedValue: (value: number) => coerceIn(value, IMAGE_PRE_LOAD_AMOUNT.min, IMAGE_PRE_LOAD_AMOUNT.max),
    },
    shouldUseAutoWebtoonMode: {
        convert: convertToBoolean,
    },
    autoScroll: {
        convert: convertToObject<IReaderSettings['autoScroll']>,
        toConstrainedValue: (value: IReaderSettings['autoScroll']): IReaderSettings['autoScroll'] => ({
            ...value,
            value: coerceIn(value.value, AUTO_SCROLL_SPEED.min, AUTO_SCROLL_SPEED.max),
        }),
    },
    shouldShowReadingModePreview: {
        convert: convertToBoolean,
    },
    shouldShowTapZoneLayoutPreview: {
        convert: convertToBoolean,
    },
    shouldInformAboutMissingChapter: {
        convert: convertToBoolean,
    },
    shouldInformAboutScanlatorChange: {
        convert: convertToBoolean,
    },
    hideHistory: {
        convert: convertToBoolean,
    },
    scrollAmount: {
        convert: convertToNumber, // ReaderScrollAmount (enum)
        toConstrainedValue: (value: number) => coerceIn(value, SCROLL_AMOUNT.min, SCROLL_AMOUNT.max),
    },
    reverse: {
        convert: convertToBoolean,
    },
    bookmarked: {
        convert: convertToBooleanNullAndUndefined,
    },
    downloaded: {
        convert: convertToBooleanNullAndUndefined,
    },
    unread: {
        convert: convertToBooleanNullAndUndefined,
    },
    showChapterNumber: {
        convert: convertToBoolean,
    },
    extensionLanguages: {
        convert: convertToObject<string[]>,
    },
    animeExtensionLanguages: {
        convert: convertToObject<string[]>,
    },
    sourceLanguages: {
        convert: convertToObject<string[]>,
    },
    animeSourceLanguages: {
        convert: convertToObject<string[]>,
    },
    showNsfw: {
        convert: convertToBoolean,
    },
    shouldUseInfiniteScroll: {
        convert: convertToBoolean,
    },
    shouldShowTransitionPage: {
        convert: convertToBoolean,
    },
    appTheme: {
        convert: convertToString,
    },
    themeMode: {
        convert: convertToString, // ThemeMode (enum)
    },
    shouldUsePureBlackMode: {
        convert: convertToBoolean,
    },
    mangaGridItemWidth: {
        convert: convertToNumber,
        toConstrainedValue: (value: number) => coerceIn(value, MANGA_GRID_WIDTH.min, MANGA_GRID_WIDTH.max),
    },
    isPinned: {
        convert: convertToBoolean,
    },
    isEnabled: {
        convert: convertToBoolean,
    },
    lastUsedSourceId: {
        convert: convertToString,
    },
    shouldShowOnlySourcesWithResults: {
        convert: convertToBoolean,
    },
    excludedScanlators: {
        convert: convertToObject<string[]>,
    },
} as const;

export const VALID_APP_METADATA_KEYS = Object.keys(APP_METADATA);

export const GLOBAL_METADATA_KEYS: AppMetadataKeys[] = [
    // metadata applied migration id
    'migration',

    // downloads
    'deleteChaptersManuallyMarkedRead',
    'deleteChaptersWhileReading',
    'deleteChaptersWithBookmark',

    // library
    'showAddToLibraryCategorySelectDialog',
    'ignoreFilters',
    'removeMangaFromCategories',
    'showTabSize',

    // library category options
    // filter
    'hasDownloadedChapters',
    'hasBookmarkedChapters',
    'hasUnreadChapters',
    'hasReadChapters',
    'hasDuplicateChapters',
    'hasTrackerBinding',
    'hasStatus',
    // sort
    'sortBy',
    'sortDesc',
    // display
    'showDownloadBadge',
    'showUnreadBadge',
    'showTabSize',
    'showContinueReadingButton',

    // client
    'devices',

    // migration
    'migrateChapters',
    'migrateCategories',
    'migrateTracking',
    'deleteChapters',
    'migrateSortSettings',

    // browse
    'hideLibraryEntries',
    'extensionLanguages',
    'animeExtensionLanguages',
    'sourceLanguages',
    'animeSourceLanguages',
    'showNsfw',
    'lastUsedSourceId',
    'shouldShowOnlySourcesWithResults',

    // history
    'hideHistory',

    // tracking
    'updateProgressAfterReading',
    'updateProgressManualMarkRead',

    // updates
    'webUIInformAvailableUpdate',
    'serverInformAvailableUpdate',

    // sources
    'savedSearches',
    'isPinned',
    'isEnabled',

    // themes
    'customThemes',
    'mangaThumbnailBackdrop',
    'mangaDynamicColorSchemes',

    // reader
    'exitMode',
    'shouldSkipDupChapters',
    'shouldSkipFilteredChapters',
    'hotkeys',
    'shouldShowTransitionPage',

    // manga
    // chapter list options
    'reverse',
    'bookmarked',
    'downloaded',
    'unread',
    'showChapterNumber',
    'excludedScanlators',
];

/**
 * Once all changes have been done in the current branch, a new migration for all changes should be
 * created.
 *
 * In case a value should be migrated for a specific key, and in the same migration the key is
 * getting migrated, the key in the value migration is the "old" key (before the migration to the
 * new key).
 *
 * Migration order (function "applyMetadataMigrations"):
 * 1. app metadata key prefix
 * 2. app metadata values
 * 3. app metadata keys
 * 4. app metadata keys deletion
 *
 * @example
 * // changes:
 * // commit: change key "X" to "Z"
 * // commit: change key "Y" to "A"
 * // commit: fix typo in reader setting "someTipo"
 * // commit: add metadata migration
 *
 * // result:
 * // old migrations:
 * // const migrations = [
 * //   {
 * //     keys: [{ oldKey: 'loadNextonEnding', newKey: 'loadNextOnEnding' }],
 * //   }
 * // ];
 *
 * // updated migrations
 * const migrations = [
 *   {
 *     keys: [{ oldKey: 'loadNextonEnding', newKey: 'loadNextOnEnding' }],
 *   },
 *   {
 *     keys: [
 *       { oldKey: 'X', newKey: 'Z' },
 *       { oldKey: 'Y', newKey: 'A' },
 *     ],
 *     // all stored values in the metadata (of this app) will get migrated
 *     values: [
 *       {
 *         oldValue: 'someTipo',
 *         newValue: 'someTypo'
 *       },
 *     ],
 *     // to migrate only the value of a specific key (in this case of "someKey"):
 *     // values: [
 *     //   {
 *     //     key: 'someKey',
 *     //     oldValue: 'someTipo',
 *     //     newValue: 'someTypo',
 *     //   },
 *     // ],
 *   },
 * ];
 */
export const METADATA_MIGRATIONS: IMetadataMigration[] = [
    {
        keys: [{ oldKey: 'loadNextonEnding', newKey: 'loadNextOnEnding' }],
    },
    {
        keys: [{ oldKey: 'deleteChaptersAutoMarkedRead', newKey: 'deleteChaptersWhileReading' }],
    },
    {
        keys: [
            {
                oldKey: 'readerType',
                newKey: 'readingMode',
            },
            {
                oldKey: 'offsetFirstPage',
                newKey: 'shouldOffsetDoubleSpreads',
            },
            {
                oldKey: 'fitPageToWindow',
                newKey: 'pageScaleMode',
            },
            {
                oldKey: 'scalePage',
                newKey: 'shouldStretchPage',
            },
            {
                oldKey: 'skipDupChapters',
                newKey: 'shouldSkipDupChapters',
            },
            {
                oldKey: 'showPageNumber',
                newKey: 'shouldShowPageNumber',
            },
            {
                oldKey: 'staticNav',
                newKey: 'isStaticNav',
            },
        ],
        values: [
            // START: readerType
            {
                key: 'readerType',
                oldValue: 'ContinuesVertical',
                newValue: `${ReadingMode.CONTINUOUS_VERTICAL}`,
            },
            {
                key: 'readerType',
                oldValue: 'Webtoon',
                newValue: `${ReadingMode.WEBTOON}`,
            },
            {
                key: 'readerType',
                oldValue: 'SingleRTL',
                newValue: `${ReadingMode.SINGLE_PAGE}`,
            },
            {
                key: 'readerType',
                oldValue: 'SingleLTR',
                newValue: `${ReadingMode.SINGLE_PAGE}`,
            },
            {
                key: 'readerType',
                oldValue: 'DoubleRTL',
                newValue: `${ReadingMode.DOUBLE_PAGE}`,
            },
            {
                key: 'readerType',
                oldValue: 'DoubleLTR',
                newValue: `${ReadingMode.DOUBLE_PAGE}`,
            },
            {
                key: 'readerType',
                oldValue: 'ContinuesHorizontalLTR',
                newValue: `${ReadingMode.CONTINUOUS_HORIZONTAL}`,
            },
            {
                key: 'readerType',
                oldValue: 'ContinuesHorizontalRTL',
                newValue: `${ReadingMode.CONTINUOUS_HORIZONTAL}`,
            },
            // END: readerType
            // START: fitPageToWindow
            {
                key: 'fitPageToWindow',
                oldValue: 'false',
                newValue: `${ReaderPageScaleMode.ORIGINAL}`,
            },
            {
                key: 'fitPageToWindow',
                oldValue: 'true',
                newValue: `${ReaderPageScaleMode.SCREEN}`,
            },
            // END: fitPageToWindow
            {
                key: 'readerWidth',
                oldValue: /^[0-9]+$/g,
                newValue: (oldValue) => JSON.stringify({ value: Number(oldValue), enabled: true }),
            },
        ],
    },
    {
        deleteKeys: ['pageScaleMode', 'shouldStretchPage', 'readerWidth'],
    },
    {
        values: [
            {
                key: 'progressBarPositionAutoVertical',
                oldValue: '-1',
                newValue: `${DEFAULT_READER_SETTINGS.progressBarPositionAutoVertical}`,
            },
            {
                key: 'progressBarPosition',
                oldValue: '0',
                newValue: `${ProgressBarPosition.BOTTOM}`,
            },
            {
                key: 'progressBarPosition',
                oldValue: '1',
                newValue: `${ProgressBarPosition.LEFT}`,
            },
            {
                key: 'progressBarPosition',
                oldValue: '2',
                newValue: `${ProgressBarPosition.RIGHT}`,
            },
        ],
    },
];
