/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import ComputerIcon from '@mui/icons-material/Computer';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import { IReaderSettings, ReaderOverlayMode } from '@/features/reader/Reader.types.ts';
import { ValueToDisplayData } from '@/base/Base.types.ts';
import { ButtonSelectInput } from '@/base/components/inputs/ButtonSelectInput.tsx';

const VALUE_TO_DISPLAY_DATA: ValueToDisplayData<ReaderOverlayMode> = {
    [ReaderOverlayMode.AUTO]: {
        title: 'global.label.auto',
        icon: <AutoModeIcon />,
    },
    [ReaderOverlayMode.DESKTOP]: {
        title: 'global.label.desktop',
        icon: <ComputerIcon />,
    },
    [ReaderOverlayMode.MOBILE]: {
        title: 'global.label.mobile',
        icon: <PhoneIphoneIcon />,
    },
};

const READING_MODE_VALUES = Object.values(ReaderOverlayMode).filter((value) => typeof value === 'number');

export const ReaderSettingOverlayMode = ({
    overlayMode,
    setOverlayMode,
}: Pick<IReaderSettings, 'overlayMode'> & {
    setOverlayMode: (mode: ReaderOverlayMode) => void;
}) => {
    const { t } = useTranslation();

    return (
        <ButtonSelectInput
            label={t('reader.settings.overlay_mode')}
            value={overlayMode}
            values={READING_MODE_VALUES}
            setValue={setOverlayMode}
            valueToDisplayData={VALUE_TO_DISPLAY_DATA}
        />
    );
};
