/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import DisabledByDefaultRounded from '@mui/icons-material/DisabledByDefaultRounded';
import Checkbox, { CheckboxProps } from '@mui/material/Checkbox';
import React, { useCallback } from 'react';

type CheckState = boolean | undefined | null;

function nextState(state: CheckState): CheckState {
    if (state === true) return false;
    if (state === false) return undefined;
    return true;
}

export interface ThreeStateCheckboxProps extends Omit<CheckboxProps, 'checked' | 'onChange'> {
    checked?: boolean | undefined | null;
    onChange?: (checked: boolean | undefined | null) => void;
}

/**
 * When checked is true, checkbox contains checkmark
 * When checked is false, checkbox contains cross
 * When checked is null or undefined, checkbox is empty
 */
export const ThreeStateCheckbox: React.FC<ThreeStateCheckboxProps> = ({ checked, onChange, ...rest }) => {
    const handleChange = useCallback(() => {
        if (onChange) {
            const newState = nextState(checked);
            onChange(newState);
        }
    }, [onChange]);

    return (
        <Checkbox
            indeterminateIcon={<DisabledByDefaultRounded />}
            checked={checked === true}
            indeterminate={checked === false}
            onChange={handleChange}
            {...rest}
        />
    );
};
