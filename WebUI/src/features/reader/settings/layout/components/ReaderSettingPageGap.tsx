/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { IReaderSettings, IReaderSettingsWithDefaultFlag, ReadingMode } from '@/features/reader/Reader.types.ts';
import { SliderInput } from '@/base/components/inputs/SliderInput.tsx';
import { DEFAULT_READER_SETTINGS, PAGE_GAP } from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { isContinuousReadingMode } from '@/features/reader/settings/ReaderSettings.utils.tsx';
import { MultiValueButtonDefaultableProps } from '@/base/Base.types.ts';

export const ReaderSettingPageGap = ({
    pageGap,
    readingMode,
    isDefaultable,
    onDefault,
    updateSetting,
}: Pick<IReaderSettingsWithDefaultFlag, 'pageGap' | 'readingMode'> &
    Pick<MultiValueButtonDefaultableProps<IReaderSettings['pageGap']>, 'isDefaultable' | 'onDefault'> & {
        updateSetting: (gap: number, commit: boolean) => void;
    }) => {
    const { t } = useTranslation();

    const isChangeable = readingMode.value !== ReadingMode.WEBTOON && isContinuousReadingMode(readingMode.value);
    if (!isChangeable) {
        return null;
    }

    return (
        <SliderInput
            label={t('reader.settings.label.page_gap')}
            value={t('global.value', { value: pageGap.value, unit: t('global.unit.px') })}
            onDefault={isDefaultable ? onDefault : undefined}
            slotProps={{
                slider: {
                    defaultValue: DEFAULT_READER_SETTINGS.pageGap,
                    value: pageGap.value,
                    step: PAGE_GAP.step,
                    min: PAGE_GAP.min,
                    max: PAGE_GAP.max,
                    onChange: (_, value) => {
                        updateSetting(value as number, false);
                    },
                    onChangeCommitted: (_, value) => {
                        updateSetting(value as number, true);
                    },
                },
            }}
        />
    );
};
