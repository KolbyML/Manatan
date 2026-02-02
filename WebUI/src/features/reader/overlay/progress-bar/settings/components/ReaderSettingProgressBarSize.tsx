/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { IReaderSettings, ProgressBarType, ReaderOverlayMode } from '@/features/reader/Reader.types.ts';
import { SliderInput } from '@/base/components/inputs/SliderInput.tsx';
import { DEFAULT_READER_SETTINGS, PROGRESS_BAR_SIZE } from '@/features/reader/settings/ReaderSettings.constants.tsx';

export const ReaderSettingProgressBarSize = ({
    overlayMode,
    progressBarType,
    progressBarSize,
    setProgressBarSize,
    onDefault,
}: Pick<IReaderSettings, 'progressBarType' | 'progressBarSize' | 'overlayMode'> & {
    setProgressBarSize: (size: number, commit: boolean) => void;
    onDefault: () => void;
}) => {
    const { t } = useTranslation();
    const isChangeable = overlayMode === ReaderOverlayMode.DESKTOP && progressBarType === ProgressBarType.STANDARD;

    if (!isChangeable) {
        return null;
    }

    return (
        <SliderInput
            label={t('reader.settings.progress_bar.size')}
            value={t('global.value', { value: progressBarSize, unit: t('global.unit.px') })}
            onDefault={onDefault}
            slotProps={{
                slider: {
                    defaultValue: DEFAULT_READER_SETTINGS.progressBarSize,
                    value: progressBarSize,
                    step: PROGRESS_BAR_SIZE.step,
                    min: PROGRESS_BAR_SIZE.min,
                    max: PROGRESS_BAR_SIZE.max,
                    onChange: (_, value) => {
                        setProgressBarSize(value as number, false);
                    },
                    onChangeCommitted: (_, value) => {
                        setProgressBarSize(value as number, true);
                    },
                },
            }}
        />
    );
};
