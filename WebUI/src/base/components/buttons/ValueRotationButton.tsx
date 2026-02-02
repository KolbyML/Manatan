/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { ReactNode, useMemo } from 'react';
import Button from '@mui/material/Button';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { MultiValueButtonProps } from '@/base/Base.types.ts';
import { getNextRotationValue } from '@/base/utils/ValueRotationButton.utils.ts';
import { Superscript } from '@/base/components/texts/Superscript.tsx';

export const ValueRotationButton = <Value extends string | number>({
    tooltip,
    value,
    defaultValue,
    values,
    setValue,
    valueToDisplayData,
    isDefaultable,
    onDefault,
    defaultIcon,
}: MultiValueButtonProps<Value> & { defaultIcon?: ReactNode }) => {
    const { t } = useTranslation();

    const isDefault = value === undefined;
    const indexOfValue = useMemo(() => {
        if (isDefault) {
            return -1;
        }

        return values.indexOf(value);
    }, [value, values]);

    return (
        <CustomTooltip title={tooltip}>
            {isDefault ? (
                <Button
                    onClick={() => setValue(values[0])}
                    sx={{ justifyContent: 'start', textTransform: 'unset', flexGrow: 1 }}
                    variant="contained"
                    startIcon={defaultIcon}
                    size="large"
                >
                    {defaultValue === undefined ? (
                        t('global.label.default')
                    ) : (
                        <Superscript
                            i18nKey="settings.default_value"
                            value={
                                valueToDisplayData[defaultValue].isTitleString
                                    ? valueToDisplayData[defaultValue].title
                                    : t(valueToDisplayData[defaultValue].title)
                            }
                        />
                    )}
                </Button>
            ) : (
                <Button
                    onClick={() => {
                        const nextValue = getNextRotationValue(indexOfValue, values, isDefaultable);

                        if (nextValue === undefined) {
                            onDefault?.();
                            return;
                        }

                        setValue(nextValue);
                    }}
                    sx={{ justifyContent: 'start', textTransform: 'unset', flexGrow: 1 }}
                    variant="contained"
                    startIcon={valueToDisplayData[value].icon}
                    size="large"
                >
                    {valueToDisplayData[value].isTitleString
                        ? valueToDisplayData[value].title
                        : t(valueToDisplayData[value].title)}
                </Button>
            )}
        </CustomTooltip>
    );
};
