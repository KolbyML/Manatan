/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useState, useEffect, useMemo } from 'react';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import Checkbox from '@mui/material/Checkbox';
import {
    CheckBoxPreferenceProps,
    SwitchPreferenceCompatProps,
    TwoStatePreferenceProps,
} from '@/features/source/Source.types.ts';

function getTwoStateType(type: TwoStatePreferenceProps['twoStateType']) {
    if (type === 'Switch') {
        return Switch;
    }
    return Checkbox;
}

const getTwoStateValues = (
    props: TwoStatePreferenceProps,
): {
    title: string | null | undefined;
    defaultValue: boolean;
    currentValue?: boolean | null | undefined;
} => {
    if (props.type === 'CheckBoxPreference') {
        return {
            title: props.CheckBoxTitle,
            defaultValue: props.CheckBoxDefault,
            currentValue: props.CheckBoxCheckBoxCurrentValue,
        };
    }

    return {
        title: props.SwitchPreferenceTitle,
        defaultValue: props.SwitchPreferenceDefault,
        currentValue: props.SwitchPreferenceCurrentValue,
    };
};

function TwoSatePreference(props: TwoStatePreferenceProps) {
    const { title, defaultValue, currentValue, summary, updateValue, twoStateType } = {
        ...props,
        ...getTwoStateValues(props),
    };
    const [internalCurrentValue, setInternalCurrentValue] = useState(currentValue ?? defaultValue);

    useEffect(() => {
        setInternalCurrentValue(currentValue ?? defaultValue);
    }, [currentValue]);

    const TwoStateComponent = useMemo(() => getTwoStateType(twoStateType), [twoStateType]);

    return (
        <ListItem>
            <ListItemText primary={title} secondary={summary} />
            <TwoStateComponent
                {...{
                    edge: 'end',
                    checked: internalCurrentValue,
                    onChange: () => {
                        updateValue(twoStateType === 'Switch' ? 'switchState' : 'checkBoxState', !currentValue);

                        // appear smooth
                        setInternalCurrentValue(!currentValue);
                    },
                }}
            />
        </ListItem>
    );
}

export function CheckBoxPreference(props: CheckBoxPreferenceProps) {
    return <TwoSatePreference {...props} twoStateType="Checkbox" />;
}

export function SwitchPreferenceCompat(props: SwitchPreferenceCompatProps) {
    return <TwoSatePreference {...props} twoStateType="Switch" />;
}
