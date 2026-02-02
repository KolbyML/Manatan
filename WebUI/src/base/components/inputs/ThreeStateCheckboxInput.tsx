/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import FormControlLabel from '@mui/material/FormControlLabel';
import React from 'react';
import { ThreeStateCheckbox, ThreeStateCheckboxProps } from '@/base/components/inputs/ThreeStateCheckbox.tsx';

interface IProps extends ThreeStateCheckboxProps {
    label?: string;
}

export const ThreeStateCheckboxInput: React.FC<IProps> = ({ label, sx, ...rest }) => (
    <FormControlLabel control={<ThreeStateCheckbox {...rest} />} label={label} sx={sx} />
);
