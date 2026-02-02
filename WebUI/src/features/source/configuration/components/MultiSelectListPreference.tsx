/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useState, useEffect } from 'react';
import ListItemText from '@mui/material/ListItemText';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormGroup from '@mui/material/FormGroup';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';
import ListItemButton from '@mui/material/ListItemButton';
import { cloneObject } from '@/base/utils/cloneObject.tsx';
import { MultiSelectListPreferenceProps } from '@/features/source/Source.types.ts';

interface IListDialogProps {
    selectedValues: string[];
    open: boolean;
    onClose: (arg0: string[] | null) => void;
    values: string[];
    title: string;
}

function ListDialog(props: IListDialogProps) {
    const { t } = useTranslation();

    const { selectedValues: selectedValuesProp, open, onClose, values, title } = props;
    const [selectedValues, setSelectedValues] = React.useState(selectedValuesProp);

    React.useEffect(() => {
        if (!open) {
            setSelectedValues(selectedValuesProp);
        }
    }, [selectedValuesProp, open]);

    const handleCancel = () => {
        onClose(null);
    };

    const handleOk = () => {
        onClose(selectedValues);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>, value: string) => {
        const { checked } = event.target as HTMLInputElement;

        const hasEntry = selectedValues.some((selectedValue) => value === selectedValue);
        if (checked) {
            if (!hasEntry) {
                const selectedValuesClone = cloneObject(selectedValues) as string[];
                selectedValuesClone.push(value);
                setSelectedValues(selectedValuesClone);
            }
        } else if (hasEntry) {
            // not checked and has entry
            const selectedValuesClone = cloneObject(selectedValues) as string[];
            const index = selectedValuesClone.indexOf(value);
            selectedValuesClone.splice(index, 1);
            setSelectedValues(selectedValuesClone);
        }
    };

    return (
        <Dialog
            sx={{ '& .MuiDialog-paper': { width: '80%', maxHeight: 435 } }}
            maxWidth="xs"
            open={open}
            onClose={handleCancel}
        >
            <DialogTitle>{title}</DialogTitle>
            <DialogContent dividers>
                <FormGroup>
                    {values.map((value) => (
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={selectedValues.some((selectedValue) => value === selectedValue)}
                                    onChange={(e) => handleChange(e, value)}
                                />
                            }
                            label={value}
                            key={value}
                        />
                    ))}
                </FormGroup>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={handleCancel}>
                    {t('global.button.cancel')}
                </Button>
                <Button onClick={handleOk}>{t('global.button.ok')}</Button>
            </DialogActions>
        </Dialog>
    );
}

export function MultiSelectListPreference(props: MultiSelectListPreferenceProps) {
    const {
        MultiSelectListPreferenceTitle: title,
        summary,
        MultiSelectListPreferenceCurrentValue: currentValue,
        MultiSelectListPreferenceDefault: defaultValue,
        updateValue,
        entryValues,
        entries,
    } = props;
    const [internalCurrentValue, setInternalCurrentValue] = useState(currentValue ?? defaultValue);
    const [dialogOpen, setDialogOpen] = useState<boolean>(false);

    useEffect(() => {
        setInternalCurrentValue(currentValue);
    }, [currentValue]);

    const findEntriesOf = (values?: string[] | null) =>
        values?.map((value) => {
            const idx = entryValues.indexOf(value);
            return entries[idx];
        }) ?? [];

    const findEntryValuesOf = (values?: string[] | null) =>
        values?.map((value) => {
            const idx = entries.indexOf(value);
            return entryValues[idx];
        }) ?? [];

    const getSummary = () => summary;

    const handleDialogClose = (newValue: string[] | null) => {
        if (newValue !== null) {
            // console.log(newValue);
            updateValue('multiSelectState', findEntryValuesOf(newValue));

            // appear smooth
            setInternalCurrentValue(newValue);
        }

        setDialogOpen(false);
    };

    return (
        <>
            <ListItemButton onClick={() => setDialogOpen(true)}>
                <ListItemText primary={title} secondary={getSummary()} />
            </ListItemButton>
            <ListDialog
                title={title ?? ''}
                open={dialogOpen}
                onClose={handleDialogClose}
                selectedValues={findEntriesOf(internalCurrentValue)}
                values={entries}
            />
        </>
    );
}
