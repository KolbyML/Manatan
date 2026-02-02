/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import { ReaderSettingProgressBarType } from '@/features/reader/overlay/progress-bar/settings/components/ReaderSettingProgressBarType.tsx';
import { ReaderSettingProgressBarSize } from '@/features/reader/overlay/progress-bar/settings/components/ReaderSettingProgressBarSize.tsx';
import { ReaderSettingProgressBarPosition } from '@/features/reader/overlay/progress-bar/settings/components/ReaderSettingProgressBarPosition.tsx';
import {
    IReaderSettings,
    ProgressBarType,
    ReaderOverlayMode,
    ReaderSettingsTypeProps,
} from '@/features/reader/Reader.types.ts';
import { ReaderSettingOverlayMode } from '@/features/reader/overlay/settings/ReaderSettingOverlayMode.tsx';
import { CheckboxInput } from '@/base/components/inputs/CheckboxInput.tsx';
import { ReaderSettingBackgroundColor } from '@/features/reader/settings/general/components/ReaderSettingBackgroundColor.tsx';

export const ReaderGeneralSettings = ({
    overlayMode,
    settings,
    updateSetting,
    onDefault,
}: Pick<IReaderSettings, 'overlayMode'> & ReaderSettingsTypeProps) => {
    const { t } = useTranslation();

    return (
        <Stack sx={{ gap: 2 }}>
            <ReaderSettingOverlayMode
                overlayMode={settings.overlayMode}
                setOverlayMode={(value) => updateSetting('overlayMode', value)}
            />
            <ReaderSettingBackgroundColor
                backgroundColor={settings.backgroundColor}
                updateSetting={(value) => updateSetting('backgroundColor', value)}
            />
            <ReaderSettingProgressBarType
                overlayMode={overlayMode}
                progressBarType={settings.progressBarType}
                setProgressBarType={(value) => updateSetting('progressBarType', value)}
            />
            <ReaderSettingProgressBarSize
                overlayMode={overlayMode}
                progressBarType={settings.progressBarType}
                progressBarSize={settings.progressBarSize}
                setProgressBarSize={(...args) => updateSetting('progressBarSize', ...args)}
                onDefault={() => onDefault?.('progressBarSize')}
            />
            <ReaderSettingProgressBarPosition
                progressBarPosition={settings.progressBarPosition}
                progressBarPositionAutoVertical={settings.progressBarPositionAutoVertical}
                updateSetting={updateSetting}
            />
            {(settings.progressBarType === ProgressBarType.HIDDEN || overlayMode === ReaderOverlayMode.MOBILE) && (
                <CheckboxInput
                    label={t('reader.settings.label.show_page_number')}
                    checked={settings.shouldShowPageNumber}
                    onChange={(_, checked) => updateSetting('shouldShowPageNumber', checked)}
                />
            )}
        </Stack>
    );
};
