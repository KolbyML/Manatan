/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { d } from 'koration';
import { IReaderSettings, IReaderSettingsWithDefaultFlag } from '@/features/reader/Reader.types.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { READING_MODE_VALUE_TO_DISPLAY_DATA } from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { TReaderTapZoneContext } from '@/features/reader/tap-zones/TapZoneLayout.types.ts';
import { TranslationKey } from '@/base/Base.types.ts';

const HIDE_PREVIEW_TIMEOUT = d(5).seconds.inWholeMilliseconds;

export const useReaderShowSettingPreviewOnChange = (
    isLoading: boolean,
    error: any,
    areSettingsSet: boolean,
    readingMode: IReaderSettingsWithDefaultFlag['readingMode'],
    tapZoneLayout: IReaderSettingsWithDefaultFlag['tapZoneLayout'],
    tapZoneInvertMode: IReaderSettingsWithDefaultFlag['tapZoneInvertMode'],
    shouldShowReadingModePreview: IReaderSettings['shouldShowReadingModePreview'],
    shouldShowTapZoneLayoutPreview: IReaderSettings['shouldShowTapZoneLayoutPreview'],
    setShowPreview: TReaderTapZoneContext['setShowPreview'],
) => {
    const { t } = useTranslation();

    // show setting previews on change or when open reader
    const previousReadingMode = useRef<IReaderSettingsWithDefaultFlag['readingMode']>(undefined);
    const previousTapZoneLayout = useRef<IReaderSettingsWithDefaultFlag['tapZoneLayout']>(undefined);
    const previousTapZoneInvertMode = useRef<IReaderSettingsWithDefaultFlag['tapZoneInvertMode']>(undefined);
    const isInitialPreview = useRef(true);

    useEffect(() => {
        if (isLoading || error || !areSettingsSet) {
            return;
        }

        const didReadingModeChange = JSON.stringify(readingMode) !== JSON.stringify(previousReadingMode.current);
        const showReadingModePreview = shouldShowReadingModePreview && didReadingModeChange;
        if (showReadingModePreview) {
            makeToast(t(READING_MODE_VALUE_TO_DISPLAY_DATA[readingMode.value].title as TranslationKey), {
                autoHideDuration: HIDE_PREVIEW_TIMEOUT,
            });
        }
        previousReadingMode.current = readingMode;

        const didTapZoneLayoutChange =
            JSON.stringify(tapZoneLayout) !== JSON.stringify(previousTapZoneLayout.current) ||
            JSON.stringify(tapZoneInvertMode) !== JSON.stringify(previousTapZoneInvertMode.current);
        const showTapZoneLayoutPreview = shouldShowTapZoneLayoutPreview && didTapZoneLayoutChange;
        if (showTapZoneLayoutPreview) {
            setShowPreview(true);
            if (isInitialPreview.current) {
                setTimeout(() => setShowPreview(false), HIDE_PREVIEW_TIMEOUT);
            }
        }
        previousTapZoneLayout.current = tapZoneLayout;
        previousTapZoneInvertMode.current = tapZoneInvertMode;

        isInitialPreview.current = false;
    }, [
        isLoading,
        error,
        areSettingsSet,
        readingMode.value,
        readingMode.isDefault,
        tapZoneLayout.value,
        tapZoneLayout.isDefault,
        tapZoneInvertMode.value,
        tapZoneInvertMode.isDefault,
    ]);
};
