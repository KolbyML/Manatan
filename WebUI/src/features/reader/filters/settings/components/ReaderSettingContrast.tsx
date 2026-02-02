/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import { IReaderSettings } from '@/features/reader/Reader.types.ts';
import { CheckboxInput } from '@/base/components/inputs/CheckboxInput.tsx';
import { SliderInput } from '@/base/components/inputs/SliderInput.tsx';
import { CUSTOM_FILTER, DEFAULT_READER_SETTINGS } from '@/features/reader/settings/ReaderSettings.constants.tsx';

export const ReaderSettingContrast = ({
    contrast,
    updateSetting,
}: Pick<IReaderSettings['customFilter'], 'contrast'> & {
    updateSetting: <Filter extends keyof IReaderSettings['customFilter']>(
        filter: Filter,
        value: IReaderSettings['customFilter'][Filter],
        commit: boolean,
    ) => void;
}) => {
    const { t } = useTranslation();

    return (
        <Stack>
            <CheckboxInput
                label={t('reader.settings.custom_filter.contrast')}
                checked={contrast.enabled}
                onChange={(_, checked) => updateSetting('contrast', { ...contrast, enabled: checked }, true)}
            />
            {contrast.enabled && (
                <SliderInput
                    label={t('reader.settings.custom_filter.contrast')}
                    value={contrast.value}
                    onDefault={() =>
                        updateSetting(
                            'contrast',
                            { ...contrast, value: DEFAULT_READER_SETTINGS.customFilter.contrast.value },
                            true,
                        )
                    }
                    slotProps={{
                        slider: {
                            defaultValue: DEFAULT_READER_SETTINGS.customFilter.contrast.value,
                            value: contrast.value,
                            step: CUSTOM_FILTER.contrast.step,
                            min: CUSTOM_FILTER.contrast.min,
                            max: CUSTOM_FILTER.contrast.max,
                            onChange: (_, newValue) => {
                                updateSetting('contrast', { ...contrast, value: newValue as number }, false);
                            },
                            onChangeCommitted: (_, newValue) => {
                                updateSetting('contrast', { ...contrast, value: newValue as number }, true);
                            },
                        },
                    }}
                />
            )}
        </Stack>
    );
};
