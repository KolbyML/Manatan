/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import TextField from '@mui/material/TextField';
import DialogActions from '@mui/material/DialogActions';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PasswordTextField } from '@/base/components/inputs/PasswordTextField.tsx';

export type TextSettingDialogProps = {
    settingName: string;
    dialogTitle?: string;
    dialogDescription?: string;
    value?: string;
    handleChange: (value: string) => void;
    isPassword?: boolean;
    placeholder?: string;
    isDialogOpen: boolean;
    setIsDialogOpen: (open: boolean) => void;
    validate?: (value: string) => boolean;
};

export const TextSettingDialog = ({
    settingName,
    dialogTitle = settingName,
    dialogDescription,
    value,
    handleChange,
    isPassword = false,
    placeholder = '',
    isDialogOpen,
    setIsDialogOpen,
    validate = () => true,
}: TextSettingDialogProps) => {
    const { t } = useTranslation();

    const [dialogValue, setDialogValue] = useState(value ?? '');
    const [isValidValue, setIsValidValue] = useState(true);

    const error = !isValidValue && !!dialogValue.length;

    const TextFieldComponent = useMemo(() => (isPassword ? PasswordTextField : TextField), [isPassword]);

    useEffect(() => {
        if (!value) {
            return;
        }

        setDialogValue(value);
    }, [value]);

    const closeDialog = (resetValue: boolean = true) => {
        if (resetValue) {
            setDialogValue(value ?? '');
            setIsValidValue(true);
        }

        setIsDialogOpen(false);
    };

    const updateSetting = () => {
        closeDialog(false);
        handleChange(dialogValue);
    };

    return (
        <Dialog open={isDialogOpen} onClose={() => closeDialog()} fullWidth>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogContent>
                {!!dialogDescription && (
                    <DialogContentText sx={{ paddingBottom: '10px' }}>{dialogDescription}</DialogContentText>
                )}
                <TextFieldComponent
                    sx={{
                        width: '100%',
                        margin: 'auto',
                    }}
                    autoFocus
                    placeholder={placeholder}
                    value={dialogValue}
                    error={error}
                    helperText={error ? t('global.error.label.invalid_input') : ''}
                    onChange={(e) => {
                        const newValue = e.target.value;

                        setIsValidValue(validate(newValue));
                        setDialogValue(newValue);
                    }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={() => closeDialog()} color="primary">
                    {t('global.button.cancel')}
                </Button>
                <Button onClick={() => updateSetting()} disabled={!isValidValue} color="primary">
                    {t('global.button.ok')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
