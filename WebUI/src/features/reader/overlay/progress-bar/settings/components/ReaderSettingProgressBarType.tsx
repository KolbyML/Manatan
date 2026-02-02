/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { IReaderSettings, ProgressBarType, ReaderOverlayMode } from '@/features/reader/Reader.types.ts';
import { ValueToDisplayData } from '@/base/Base.types.ts';
import { HiddenProgressBarIcon } from '@/assets/icons/svg/HiddenProgressBarIcon.tsx';
import { StandardProgressBarIcon } from '@/assets/icons/svg/StandardProgressBarIcon.tsx';
import { ButtonSelectInput } from '@/base/components/inputs/ButtonSelectInput.tsx';

const VALUE_TO_DISPLAY_DATA: ValueToDisplayData<ProgressBarType> = {
    [ProgressBarType.HIDDEN]: {
        title: 'global.label.hidden',
        icon: <HiddenProgressBarIcon />,
    },
    [ProgressBarType.STANDARD]: {
        title: 'global.label.standard',
        icon: <StandardProgressBarIcon />,
    },
};

const PROGRESS_BAR_TYPE_VALUES = Object.values(ProgressBarType).filter((value) => typeof value === 'number');

export const ReaderSettingProgressBarType = ({
    overlayMode,
    progressBarType,
    setProgressBarType,
}: Pick<IReaderSettings, 'progressBarType' | 'overlayMode'> & {
    setProgressBarType: (progressBarType: ProgressBarType) => void;
}) => {
    const { t } = useTranslation();

    if (overlayMode !== ReaderOverlayMode.DESKTOP) {
        return null;
    }

    return (
        <ButtonSelectInput
            label={t('reader.settings.progress_bar.style')}
            value={progressBarType}
            values={PROGRESS_BAR_TYPE_VALUES}
            setValue={setProgressBarType}
            valueToDisplayData={VALUE_TO_DISPLAY_DATA}
        />
    );
};
