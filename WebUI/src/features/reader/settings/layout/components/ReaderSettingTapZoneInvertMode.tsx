/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { MultiValueButtonDefaultableProps, ValueToDisplayData } from '@/base/Base.types.ts';
import { IReaderSettings, IReaderSettingsWithDefaultFlag, ReadingDirection } from '@/features/reader/Reader.types.ts';
import { TapZoneInvertMode } from '@/features/reader/tap-zones/TapZoneLayout.types.ts';
import { ButtonSelectInput } from '@/base/components/inputs/ButtonSelectInput.tsx';

enum TapZonesInvertOption {
    NONE,
    HORIZONTAL,
    VERTICAL,
    BOTH,
}

const VALUE_TO_DISPLAY_DATA: ValueToDisplayData<TapZonesInvertOption> = {
    [TapZonesInvertOption.NONE]: {
        title: 'global.label.none',
        icon: null,
    },
    [TapZonesInvertOption.HORIZONTAL]: {
        title: 'global.label.horizontal',
        icon: null,
    },
    [TapZonesInvertOption.VERTICAL]: {
        title: 'global.label.vertical',
        icon: null,
    },
    [TapZonesInvertOption.BOTH]: {
        title: 'global.label.both',
        icon: null,
    },
};

const TAP_ZONES_INVERT_OPTION_VALUES = Object.values(TapZonesInvertOption).filter((value) => typeof value === 'number');

const TAP_ZONES_INVERT_OPTION_TO_SETTING: Record<TapZonesInvertOption, TapZoneInvertMode> = {
    [TapZonesInvertOption.NONE]: {
        vertical: false,
        horizontal: false,
    },
    [TapZonesInvertOption.HORIZONTAL]: {
        vertical: false,
        horizontal: true,
    },
    [TapZonesInvertOption.VERTICAL]: {
        vertical: true,
        horizontal: false,
    },
    [TapZonesInvertOption.BOTH]: {
        vertical: true,
        horizontal: true,
    },
};

const convertTapZoneInvertModeToOption = ({ vertical, horizontal }: TapZoneInvertMode): TapZonesInvertOption => {
    if (vertical && horizontal) {
        return TapZonesInvertOption.BOTH;
    }

    if (vertical) {
        return TapZonesInvertOption.VERTICAL;
    }

    if (horizontal) {
        return TapZonesInvertOption.HORIZONTAL;
    }

    return TapZonesInvertOption.NONE;
};

export const ReaderSettingTapZoneInvertMode = ({
    tapZoneInvertMode,
    setTapZoneInvertMode,
    ...buttonSelectInputProps
}: Pick<IReaderSettingsWithDefaultFlag, 'tapZoneInvertMode'> &
    Pick<MultiValueButtonDefaultableProps<ReadingDirection>, 'isDefaultable' | 'onDefault'> & {
        setTapZoneInvertMode: (invert: IReaderSettings['tapZoneInvertMode']) => void;
    }) => {
    const { t } = useTranslation();

    const tapZonesInvertOption = convertTapZoneInvertModeToOption(tapZoneInvertMode.value);

    return (
        <ButtonSelectInput
            {...buttonSelectInputProps}
            label={t('reader.settings.tap_zones.invert')}
            value={tapZoneInvertMode.isDefault ? undefined : tapZonesInvertOption}
            defaultValue={tapZoneInvertMode.isDefault ? tapZonesInvertOption : undefined}
            values={TAP_ZONES_INVERT_OPTION_VALUES}
            setValue={(value) => setTapZoneInvertMode(TAP_ZONES_INVERT_OPTION_TO_SETTING[value])}
            valueToDisplayData={VALUE_TO_DISPLAY_DATA}
        />
    );
};
