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
import FormControl from '@mui/material/FormControl';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ListItemButton from '@mui/material/ListItemButton';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DialogContentText from '@mui/material/DialogContentText';
import InfoIcon from '@mui/icons-material/Info';
import { Select } from '@/base/components/inputs/Select.tsx';

import { TranslationKey } from '@/base/Base.types.ts';

export type SelectSettingValueDisplayInfo = {
    text: TranslationKey | string;
    description?: TranslationKey | string;
    disclaimer?: TranslationKey | string;
};

export type SelectSettingValue<Value> = [Value: Value, DisplayInfo: SelectSettingValueDisplayInfo];

export const SelectSetting = <SettingValue extends string | number>({
    settingName,
    dialogDescription,
    value,
    values,
    handleChange,
    disabled = false,
}: {
    settingName: string;
    dialogDescription?: string;
    value: SettingValue;
    values: SelectSettingValue<SettingValue>[];
    handleChange: (value: SettingValue) => void;
    disabled?: boolean;
}) => {
    const { t } = useTranslation();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogValue, setDialogValue] = useState(value);

    const valueDisplayText = useMemo(() => values.find(([key]) => key === value)?.[1]?.text, [value]);
    const dialogValueDisplayInfo = useMemo(() => values.find(([key]) => key === dialogValue)![1], [dialogValue]);

    useEffect(() => {
        if (!value) {
            return;
        }

        setDialogValue(value);
    }, [value]);

    const closeDialog = (resetValue: boolean = true) => {
        if (resetValue) {
            setDialogValue(value);
        }

        setIsDialogOpen(false);
    };

    const updateSetting = () => {
        closeDialog(false);
        handleChange(dialogValue);
    };

    return (
        <>
            <ListItemButton disabled={disabled} onClick={() => setIsDialogOpen(true)}>
                <ListItemText
                    primary={settingName}
                    secondary={valueDisplayText ? t(valueDisplayText as TranslationKey) : t('global.label.loading')}
                    secondaryTypographyProps={{ style: { display: 'flex', flexDirection: 'column' } }}
                />
            </ListItemButton>

            <Dialog open={isDialogOpen} onClose={() => closeDialog()} fullWidth>
                <DialogTitle>{settingName}</DialogTitle>
                <DialogContent>
                    {!!dialogDescription && (
                        <DialogContentText sx={{ paddingBottom: '10px' }}>{dialogDescription}</DialogContentText>
                    )}
                    {(!!dialogValueDisplayInfo.description || !!dialogValueDisplayInfo.disclaimer) && (
                        <DialogContentText sx={{ paddingBottom: '10px' }} component="div">
                            {dialogValueDisplayInfo.description && (
                                <Typography
                                    variant="body1"
                                    sx={{
                                        whiteSpace: 'pre-line',
                                    }}
                                >
                                    {t(dialogValueDisplayInfo.description as TranslationKey)}
                                </Typography>
                            )}
                            {dialogValueDisplayInfo.disclaimer && (
                                <Stack
                                    direction="row"
                                    sx={{
                                        alignItems: 'center',
                                    }}
                                >
                                    <InfoIcon color="warning" />
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            marginLeft: '10px',
                                            marginTop: '5px',
                                            whiteSpace: 'pre-line',
                                        }}
                                    >
                                        {t(dialogValueDisplayInfo.disclaimer as TranslationKey)}
                                    </Typography>
                                </Stack>
                            )}
                        </DialogContentText>
                    )}
                    <FormControl fullWidth>
                        <Select
                            id="dialog-select"
                            value={dialogValue}
                            onChange={(e) => setDialogValue(e.target.value as SettingValue)}
                        >
                            {values.map(([selectValue, { text: selectText }]) => (
                                <MenuItem key={selectValue} value={selectValue}>
                                    {t(selectText as TranslationKey)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => closeDialog()} color="primary">
                        {t('global.button.cancel')}
                    </Button>
                    <Button onClick={() => updateSetting()} color="primary">
                        {t('global.button.ok')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};
