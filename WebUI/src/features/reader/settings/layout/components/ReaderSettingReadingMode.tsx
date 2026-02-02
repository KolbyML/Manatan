/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { IReaderSettingsWithDefaultFlag, ReadingMode } from '@/features/reader/Reader.types.ts';
import {
    READING_MODE_VALUE_TO_DISPLAY_DATA,
    READING_MODE_VALUES,
} from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { ButtonSelectInput } from '@/base/components/inputs/ButtonSelectInput.tsx';
import { MultiValueButtonDefaultableProps } from '@/base/Base.types.ts';

export const ReaderSettingReadingMode = ({
    readingMode,
    setReadingMode,
    ...buttonSelectInputProps
}: Pick<IReaderSettingsWithDefaultFlag, 'readingMode'> &
    Pick<MultiValueButtonDefaultableProps<ReadingMode>, 'isDefaultable' | 'onDefault'> & {
        setReadingMode: (mode: ReadingMode) => void;
    }) => {
    const { t } = useTranslation();

    return (
        <ButtonSelectInput
            {...buttonSelectInputProps}
            label={t('reader.settings.label.reading_mode')}
            value={readingMode.isDefault ? undefined : readingMode.value}
            defaultValue={readingMode.isDefault ? readingMode.value : undefined}
            values={READING_MODE_VALUES}
            setValue={setReadingMode}
            valueToDisplayData={READING_MODE_VALUE_TO_DISPLAY_DATA}
        />
    );
};
