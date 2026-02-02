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

export const ReaderSettingHue = ({
    hue,
    updateSetting,
}: Pick<IReaderSettings['customFilter'], 'hue'> & {
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
                label={t('reader.settings.custom_filter.hue')}
                checked={hue.enabled}
                onChange={(_, checked) => updateSetting('hue', { ...hue, enabled: checked }, true)}
            />
            {hue.enabled && (
                <SliderInput
                    label={t('reader.settings.custom_filter.hue')}
                    value={hue.value}
                    onDefault={() =>
                        updateSetting('hue', { ...hue, value: DEFAULT_READER_SETTINGS.customFilter.hue.value }, true)
                    }
                    slotProps={{
                        slider: {
                            defaultValue: DEFAULT_READER_SETTINGS.customFilter.hue.value,
                            value: hue.value,
                            step: CUSTOM_FILTER.hue.step,
                            min: CUSTOM_FILTER.hue.min,
                            max: CUSTOM_FILTER.hue.max,
                            onChange: (_, newValue) => {
                                updateSetting('hue', { ...hue, value: newValue as number }, false);
                            },
                            onChangeCommitted: (_, newValue) => {
                                updateSetting('hue', { ...hue, value: newValue as number }, true);
                            },
                        },
                    }}
                />
            )}
        </Stack>
    );
};
