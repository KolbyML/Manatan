/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import Typography from '@mui/material/Typography';
import { ReaderSettingsTypeProps } from '@/features/reader/Reader.types.ts';
import { ReaderSettingHotkey } from '@/features/reader/hotkeys/settings/components/ReaderSettingHotkey.tsx';
import { READER_HOTKEYS } from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { ResetButton } from '@/base/components/buttons/ResetButton.tsx';

export const ReaderHotkeysSettings = ({ settings, updateSetting, onDefault }: ReaderSettingsTypeProps) => {
    const { t } = useTranslation();

    return (
        <Stack sx={{ gap: 2 }}>
            <Stack sx={{ alignItems: 'end' }}>
                <Typography variant="caption">{t('hotkeys.info.delete')}</Typography>
            </Stack>
            {READER_HOTKEYS.map((hotkey) => (
                <ReaderSettingHotkey
                    key={hotkey}
                    hotkey={hotkey}
                    keys={settings.hotkeys[hotkey]}
                    existingKeys={Object.values(settings.hotkeys).flat()}
                    updateSetting={(keys) => updateSetting('hotkeys', { ...settings.hotkeys, [hotkey]: keys })}
                />
            ))}
            <Stack sx={{ alignItems: 'end' }}>
                <ResetButton onClick={() => onDefault?.('hotkeys')} variant="outlined" />
            </Stack>
        </Stack>
    );
};
