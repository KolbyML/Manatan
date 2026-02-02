/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import FormControlLabel from '@mui/material/FormControlLabel';
import Radio, { RadioProps } from '@mui/material/Radio';
import React from 'react';

export interface RadioInputProps extends RadioProps {
    label?: string;
}

export const RadioInput: React.FC<RadioInputProps> = ({ label, sx, ...rest }) => (
    <FormControlLabel control={<Radio {...rest} />} label={label} sx={sx} />
);
