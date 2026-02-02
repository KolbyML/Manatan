/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { IReaderSettings, ReaderExitMode } from '@/features/reader/Reader.types.ts';
import { ValueToDisplayData } from '@/base/Base.types.ts';
import { ButtonSelectInput } from '@/base/components/inputs/ButtonSelectInput.tsx';

const VALUE_TO_DISPLAY_DATA: ValueToDisplayData<ReaderExitMode> = {
    [ReaderExitMode.PREVIOUS]: {
        title: 'global.label.previous',
        icon: null,
    },
    [ReaderExitMode.MANGA]: {
        title: 'manga.title_one',
        icon: null,
    },
};

const READER_EXIT_MODE_VALUES = Object.values(ReaderExitMode).filter((value) => typeof value === 'number');

export const ReaderSettingExitMode = ({
    exitMode,
    setExitMode,
}: Pick<IReaderSettings, 'exitMode'> & {
    setExitMode: (mode: ReaderExitMode) => void;
}) => {
    const { t } = useTranslation();

    return (
        <ButtonSelectInput
            label={t('reader.settings.exit_mode')}
            value={exitMode}
            values={READER_EXIT_MODE_VALUES}
            setValue={setExitMode}
            valueToDisplayData={VALUE_TO_DISPLAY_DATA}
        />
    );
};
