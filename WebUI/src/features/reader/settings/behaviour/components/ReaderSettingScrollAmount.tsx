/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { IReaderSettings, ReaderScrollAmount } from '@/features/reader/Reader.types.ts';
import { ValueToDisplayData } from '@/base/Base.types.ts';
import { ButtonSelectInput } from '@/base/components/inputs/ButtonSelectInput.tsx';
import { SliderInput } from '@/base/components/inputs/SliderInput.tsx';
import { DEFAULT_READER_SETTINGS, SCROLL_AMOUNT } from '@/features/reader/settings/ReaderSettings.constants.tsx';

const VALUE_TO_DISPLAY_DATA: ValueToDisplayData<ReaderScrollAmount> = {
    [ReaderScrollAmount.TINY]: {
        title: 'global.label.tiny',
        icon: null,
    },
    [ReaderScrollAmount.SMALL]: {
        title: 'global.label.small',
        icon: null,
    },
    [ReaderScrollAmount.MEDIUM]: {
        title: 'global.label.medium',
        icon: null,
    },
    [ReaderScrollAmount.LARGE]: {
        title: 'global.label.large',
        icon: null,
    },
};

const READER_SCROLL_AMOUNT_VALUES = Object.values(ReaderScrollAmount).filter((value) => typeof value === 'number');

export const ReaderSettingScrollAmount = ({
    scrollAmount,
    setScrollAmount,
}: Pick<IReaderSettings, 'scrollAmount'> & {
    setScrollAmount: (amount: ReaderScrollAmount, commit: boolean) => void;
}) => {
    const { t } = useTranslation();

    return (
        <>
            <ButtonSelectInput
                label={t('reader.settings.scroll_amount')}
                value={scrollAmount}
                values={READER_SCROLL_AMOUNT_VALUES}
                setValue={(value) => setScrollAmount(value as number, true)}
                valueToDisplayData={VALUE_TO_DISPLAY_DATA}
            />
            <SliderInput
                label={t('reader.settings.label.custom_scroll_amount')}
                value={t('global.value', { value: scrollAmount, unit: '%' })}
                onDefault={() => setScrollAmount(DEFAULT_READER_SETTINGS.scrollAmount, true)}
                slotProps={{
                    slider: {
                        defaultValue: DEFAULT_READER_SETTINGS.scrollAmount,
                        value: scrollAmount,
                        ...SCROLL_AMOUNT,
                        onChange: (_, value) => {
                            setScrollAmount(value as number, false);
                        },
                        onChangeCommitted: (_, value) => {
                            setScrollAmount(value as number, true);
                        },
                    },
                }}
            />
        </>
    );
};
