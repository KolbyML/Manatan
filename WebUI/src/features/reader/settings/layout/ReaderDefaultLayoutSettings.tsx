/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ReaderLayoutSettings } from '@/features/reader/settings/layout/ReaderLayoutSettings.tsx';
import { ReaderSettingProfileSettings } from '@/features/reader/settings/layout/components/ReaderSettingProfileSettings.tsx';
import {
    READING_MODE_VALUE_TO_DISPLAY_DATA,
    READING_MODE_VALUES,
} from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { ReaderSettingReadingMode } from '@/features/reader/settings/layout/components/ReaderSettingReadingMode.tsx';
import { IReaderSettingsWithDefaultFlag, ReadingMode } from '@/features/reader/Reader.types.ts';

export const ReaderDefaultLayoutSettings = ({
    profiles = READING_MODE_VALUES,
    readingMode,
    ...props
}: Omit<ComponentProps<typeof ReaderLayoutSettings>, 'setShowPreview' | 'settings'> & {
    profiles?: ReadingMode[];
    readingMode?: IReaderSettingsWithDefaultFlag['readingMode'];
}) => {
    const { updateSetting, isSeriesMode } = props;

    const { t } = useTranslation();

    return (
        <Stack sx={{ gap: 2, pb: Number(!isSeriesMode) * 2 }}>
            {readingMode !== undefined && (
                <Stack sx={{ pt: 2, px: 2 }}>
                    <ReaderSettingReadingMode
                        readingMode={readingMode}
                        setReadingMode={(value) => updateSetting('readingMode', value)}
                    />
                </Stack>
            )}
            {profiles.map((profile) => (
                <ReaderSettingProfileSettings
                    key={profile}
                    profile={profile}
                    title={t(READING_MODE_VALUE_TO_DISPLAY_DATA[profile].title)}
                    {...props}
                />
            ))}
        </Stack>
    );
};
