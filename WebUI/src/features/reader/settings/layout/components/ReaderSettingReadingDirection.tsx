/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import ArrowCircleLeftIcon from '@mui/icons-material/ArrowCircleLeft';
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight';
import { useTranslation } from 'react-i18next';
import { IReaderSettingsWithDefaultFlag, ReadingDirection } from '@/features/reader/Reader.types.ts';
import { MultiValueButtonDefaultableProps, ValueToDisplayData } from '@/base/Base.types.ts';
import { ButtonSelectInput } from '@/base/components/inputs/ButtonSelectInput.tsx';

const VALUE_TO_DISPLAY_DATA: ValueToDisplayData<ReadingDirection> = {
    [ReadingDirection.LTR]: {
        title: 'reader.settings.reading_direction.ltr',
        icon: <ArrowCircleRightIcon />,
    },
    [ReadingDirection.RTL]: {
        title: 'reader.settings.reading_direction.rtl',
        icon: <ArrowCircleLeftIcon />,
    },
};

const READING_DIRECTION_VALUES = Object.values(ReadingDirection).filter((value) => typeof value === 'number');

export const ReaderSettingReadingDirection = ({
    readingDirection,
    setReadingDirection,
    ...buttonSelectInputProps
}: Pick<IReaderSettingsWithDefaultFlag, 'readingDirection'> &
    Pick<MultiValueButtonDefaultableProps<ReadingDirection>, 'isDefaultable' | 'onDefault'> & {
        setReadingDirection: (readingDirection: ReadingDirection) => void;
    }) => {
    const { t } = useTranslation();

    return (
        <ButtonSelectInput
            {...buttonSelectInputProps}
            label={t('reader.settings.label.reading_direction')}
            value={readingDirection.isDefault ? undefined : readingDirection.value}
            defaultValue={readingDirection.isDefault ? readingDirection.value : undefined}
            values={READING_DIRECTION_VALUES}
            setValue={setReadingDirection}
            valueToDisplayData={VALUE_TO_DISPLAY_DATA}
        />
    );
};
