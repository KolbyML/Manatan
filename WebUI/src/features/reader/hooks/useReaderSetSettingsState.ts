/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect } from 'react';
import {
    getReaderSettings,
    getReaderSettingsFor,
    useDefaultReaderSettings,
} from '@/features/reader/settings/ReaderSettingsMetadata.ts';
import { isAutoWebtoonMode } from '@/features/reader/settings/ReaderSettings.utils.tsx';
import { ReadingMode, TReaderStateSettingsContext } from '@/features/reader/Reader.types.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';

export const useReaderSetSettingsState = (
    mangaResponse: ReturnType<typeof requestManager.useGetMangaReader>,
    defaultSettingsResponse: ReturnType<typeof useDefaultReaderSettings>['request'],
    defaultSettings: ReturnType<typeof useDefaultReaderSettings>['settings'],
    defaultSettingsMetadata: ReturnType<typeof useDefaultReaderSettings>['metadata'],
    setSettings: TReaderStateSettingsContext['setSettings'],
    areSettingsSet: boolean,
    setAreSettingsSet: (areSet: boolean) => void,
) => {
    useEffect(() => {
        // Only initialize settings once per reader mount.
        // Persisted meta writes can trigger global meta refreshes, which would otherwise overwrite
        // the user's just-updated local settings with stale mangaResponse meta until a full reload.
        if (areSettingsSet) {
            return;
        }
        const mangaFromResponse = mangaResponse.data?.manga;
        if (!mangaFromResponse || defaultSettingsResponse.loading || defaultSettingsResponse.error) {
            return;
        }

        const settingsWithDefaultProfileFallback = getReaderSettingsFor(mangaFromResponse, defaultSettings);

        const shouldUseWebtoonMode = isAutoWebtoonMode(
            mangaFromResponse,
            settingsWithDefaultProfileFallback.shouldUseAutoWebtoonMode,
            settingsWithDefaultProfileFallback.readingMode,
        );

        const defaultSettingsWithAutoReadingMode = {
            ...defaultSettings,
            readingMode: shouldUseWebtoonMode ? ReadingMode.WEBTOON : defaultSettings.readingMode,
        };

        const profile = shouldUseWebtoonMode
            ? ReadingMode.WEBTOON
            : settingsWithDefaultProfileFallback.readingMode.value;
        const profileSettings = getReaderSettings(
            'global',
            { meta: defaultSettingsMetadata! },
            defaultSettingsWithAutoReadingMode,
            undefined,
            profile,
        );

        const finalSettings = getReaderSettingsFor(mangaFromResponse, profileSettings);
        setSettings(finalSettings);
        setAreSettingsSet(true);
    }, [areSettingsSet, mangaResponse.data?.manga, defaultSettings]);
};
