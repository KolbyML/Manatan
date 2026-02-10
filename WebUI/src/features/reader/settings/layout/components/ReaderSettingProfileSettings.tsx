/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import ListSubheader from '@mui/material/ListSubheader';
import { ComponentProps, useMemo } from 'react';
import Typography from '@mui/material/Typography';
import { ReaderLayoutSettings } from '@/features/reader/settings/layout/ReaderLayoutSettings.tsx';
import { useDefaultReaderSettingsWithDefaultFlag } from '@/features/reader/settings/ReaderSettingsMetadata.ts';
import { ReadingMode } from '@/features/reader/Reader.types.ts';

export const ReaderSettingProfileSettings = ({
    profile,
    title,
    updateSetting,
    isSeriesMode,
    ...props
}: Pick<ComponentProps<typeof ReaderLayoutSettings>, 'updateSetting' | 'isSeriesMode'> & {
    profile: ReadingMode;
    title: string;
}) => {
    const { settings } = useDefaultReaderSettingsWithDefaultFlag(profile);

    const adjustedSettings = useMemo(
        () => ({
            ...settings,
            readingMode: {
                value: profile,
                isDefault: true,
            },
        }),
        [settings, profile],
    );

    return (
        <Stack sx={{ gap: 2 }}>
            {!isSeriesMode ? (
                <ListSubheader component="div" id={`${profile}-settings`}>
                    {title}
                </ListSubheader>
            ) : (
                <Typography>{title}</Typography>
            )}
            <Stack sx={{ px: Number(!isSeriesMode) * 2 }}>
                <ReaderLayoutSettings
                    {...props}
                    setShowPreview={() => {}}
                    isSeriesMode={false}
                    settings={adjustedSettings}
                    updateSetting={(setting, value, commit) => updateSetting(setting, value, commit, true, profile)}
                />
            </Stack>
        </Stack>
    );
};
