/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Checkbox, { CheckboxProps } from '@mui/material/Checkbox';
import FormControlLabel, { FormControlLabelProps } from '@mui/material/FormControlLabel';
import React from 'react';

interface IProps extends CheckboxProps {
    label?: FormControlLabelProps['label'];
}

export const CheckboxInput: React.FC<IProps> = ({ label, sx, ...rest }) => (
    <FormControlLabel control={<Checkbox {...rest} />} label={label} sx={sx} />
);
