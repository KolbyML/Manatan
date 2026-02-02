/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useState } from 'react';
import ListItemText from '@mui/material/ListItemText';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';
import ListItemButton from '@mui/material/ListItemButton';

import { EditTextPreferenceProps } from '@/features/source/Source.types.ts';

export function EditTextPreference(props: EditTextPreferenceProps) {
    const { t } = useTranslation();

    const {
        EditTextPreferenceTitle: title,
        summary,
        dialogTitle,
        dialogMessage,
        EditTextPreferenceCurrentValue: currentValue,
        updateValue,
    } = props;

    const [internalCurrentValue, setInternalCurrentValue] = useState<string>(currentValue ?? '');
    const [dialogOpen, setDialogOpen] = useState<boolean>(false);

    const handleDialogCancel = () => {
        setDialogOpen(false);

        // reset the dialog
        setInternalCurrentValue(currentValue ?? '');
    };

    const handleDialogSubmit = () => {
        setDialogOpen(false);

        updateValue('editTextState', internalCurrentValue);
    };

    return (
        <>
            <ListItemButton onClick={() => setDialogOpen(true)}>
                <ListItemText primary={title} secondary={summary} />
            </ListItemButton>
            <Dialog open={dialogOpen} onClose={handleDialogCancel}>
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogContent>
                    <DialogContentText>{dialogMessage}</DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        id="name"
                        type="text"
                        fullWidth
                        value={internalCurrentValue}
                        onChange={(e) => setInternalCurrentValue(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogCancel} color="primary">
                        {t('global.button.cancel')}
                    </Button>
                    <Button onClick={handleDialogSubmit} color="primary">
                        {t('global.button.ok')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
