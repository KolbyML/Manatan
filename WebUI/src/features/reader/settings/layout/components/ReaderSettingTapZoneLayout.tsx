/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { TapZoneLayouts } from '@/features/reader/tap-zones/TapZoneLayout.types.ts';
import { MultiValueButtonDefaultableProps, ValueToDisplayData } from '@/base/Base.types.ts';
import { IReaderSettingsWithDefaultFlag, ReadingDirection } from '@/features/reader/Reader.types.ts';
import { ButtonSelectInput } from '@/base/components/inputs/ButtonSelectInput.tsx';

const VALUE_TO_DISPLAY_DATA: ValueToDisplayData<TapZoneLayouts> = {
    [TapZoneLayouts.EDGE]: {
        title: 'reader.settings.tap_zones.edge',
        icon: null,
    },
    [TapZoneLayouts.KINDLE]: {
        title: 'reader.settings.tap_zones.kindle',
        icon: null,
    },
    [TapZoneLayouts.L_SHAPE]: {
        title: 'reader.settings.tap_zones.l_shape',
        icon: null,
    },
    [TapZoneLayouts.RIGHT_LEFT]: {
        title: 'reader.settings.tap_zones.right_left',
        icon: null,
    },
    [TapZoneLayouts.DISABLED]: {
        title: 'global.label.disabled',
        icon: null,
    },
};

const READER_TAP_ZONE_LAYOUT_VALUES = Object.values(TapZoneLayouts).filter((value) => typeof value === 'number');

export const ReaderSettingTapZoneLayout = ({
    tapZoneLayout,
    setTapZoneLayout,
    ...buttonSelectInputProps
}: Pick<IReaderSettingsWithDefaultFlag, 'tapZoneLayout'> &
    Pick<MultiValueButtonDefaultableProps<ReadingDirection>, 'isDefaultable' | 'onDefault'> & {
        setTapZoneLayout: (layout: TapZoneLayouts) => void;
    }) => {
    const { t } = useTranslation();

    return (
        <ButtonSelectInput
            {...buttonSelectInputProps}
            label={t('reader.settings.tap_zones.title')}
            value={tapZoneLayout.isDefault ? undefined : tapZoneLayout.value}
            defaultValue={tapZoneLayout.isDefault ? tapZoneLayout.value : undefined}
            values={READER_TAP_ZONE_LAYOUT_VALUES}
            setValue={setTapZoneLayout}
            valueToDisplayData={VALUE_TO_DISPLAY_DATA}
        />
    );
};
