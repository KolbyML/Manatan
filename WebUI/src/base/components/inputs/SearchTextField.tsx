/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import TextField, { TextFieldProps } from '@mui/material/TextField';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import CancelIcon from '@mui/icons-material/Cancel';

export const SearchTextField = ({
    onCancel,
    cancelButtonProps,
    ...textFieldProps
}: TextFieldProps & { onCancel: () => void; cancelButtonProps?: IconButtonProps }) => (
    <TextField
        {...textFieldProps}
        slotProps={{
            input: {
                ...textFieldProps.InputProps,
                sx: {
                    color: 'inherit',
                },
                endAdornment: textFieldProps.InputProps?.endAdornment ?? (
                    <InputAdornment position="end">
                        <IconButton {...cancelButtonProps} onClick={() => onCancel()}>
                            <CancelIcon />
                        </IconButton>
                    </InputAdornment>
                ),
            },
        }}
    />
);
