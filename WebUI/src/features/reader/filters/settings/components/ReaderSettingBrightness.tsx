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

export const ReaderSettingBrightness = ({
    brightness,
    updateSetting,
}: Pick<IReaderSettings['customFilter'], 'brightness'> & {
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
                label={t('reader.settings.custom_filter.brightness')}
                checked={brightness.enabled}
                onChange={(_, checked) => updateSetting('brightness', { ...brightness, enabled: checked }, true)}
            />
            {brightness.enabled && (
                <SliderInput
                    label={t('reader.settings.custom_filter.brightness')}
                    value={brightness.value}
                    onDefault={() =>
                        updateSetting(
                            'brightness',
                            { ...brightness, value: DEFAULT_READER_SETTINGS.customFilter.brightness.value },
                            true,
                        )
                    }
                    slotProps={{
                        slider: {
                            defaultValue: DEFAULT_READER_SETTINGS.customFilter.brightness.value,
                            value: brightness.value,
                            step: CUSTOM_FILTER.brightness.step,
                            min: CUSTOM_FILTER.brightness.min,
                            max: CUSTOM_FILTER.brightness.max,
                            onChange: (_, value) => {
                                updateSetting('brightness', { ...brightness, value: value as number }, false);
                            },
                            onChangeCommitted: (_, value) => {
                                updateSetting('brightness', { ...brightness, value: value as number }, true);
                            },
                        },
                    }}
                />
            )}
        </Stack>
    );
};
