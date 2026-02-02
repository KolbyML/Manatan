/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { ValueToDisplayData } from '@/base/Base.types.ts';
import { ButtonSelectInput } from '@/base/components/inputs/ButtonSelectInput.tsx';
import { IReaderSettingsWithDefaultFlag, ReaderBackgroundColor } from '@/features/reader/Reader.types.ts';

const VALUE_TO_DISPLAY_DATA: ValueToDisplayData<ReaderBackgroundColor> = {
    [ReaderBackgroundColor.THEME]: {
        title: 'settings.appearance.theme.title',
        icon: null,
    },
    [ReaderBackgroundColor.BLACK]: {
        title: 'global.colors.black',
        icon: null,
    },
    [ReaderBackgroundColor.GRAY]: {
        title: 'global.colors.gray',
        icon: null,
    },
    [ReaderBackgroundColor.WHITE]: {
        title: 'global.colors.white',
        icon: null,
    },
};

const READER_BACKGROUND_COLOR_VALUES = Object.values(ReaderBackgroundColor).filter(
    (value) => typeof value === 'number',
);

export const ReaderSettingBackgroundColor = ({
    backgroundColor,
    updateSetting,
}: Pick<IReaderSettingsWithDefaultFlag, 'backgroundColor'> & {
    updateSetting: (color: ReaderBackgroundColor) => void;
}) => {
    const { t } = useTranslation();

    return (
        <ButtonSelectInput
            label={t('reader.settings.background_color')}
            value={backgroundColor}
            values={READER_BACKGROUND_COLOR_VALUES}
            setValue={updateSetting}
            valueToDisplayData={VALUE_TO_DISPLAY_DATA}
        />
    );
};
