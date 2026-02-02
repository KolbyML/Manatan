/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ListItemButton from '@mui/material/ListItemButton';
import * as React from 'react';
import ListItemIcon from '@mui/material/ListItemIcon';
import Slider from '@mui/material/Slider';
import DialogContentText from '@mui/material/DialogContentText';
import InfoIcon from '@mui/icons-material/Info';
import { SxProps, Theme } from '@mui/material/styles';

type BaseProps = {
    settingTitle: string;
    settingValue: string;
    settingIcon?: React.ReactNode;
    value: number;
    defaultValue?: number;
    minValue?: number;
    maxValue?: number;
    stepSize?: number;
    dialogTitle?: string;
    dialogDescription?: string;
    dialogDisclaimer?: string;
    valueUnit: string;
    handleUpdate: (value: number) => void;
    showSlider?: never;
    disabled?: boolean;
    listItemTextSx?: SxProps<Theme>;
    handleLiveUpdate?: (value: number) => void;
};

type PropsWithSlider = Omit<BaseProps, 'defaultValue' | 'minValue' | 'maxValue' | 'showSlider'> &
    Required<Pick<BaseProps, 'defaultValue' | 'minValue' | 'maxValue'>> & { showSlider: true };

type Props = BaseProps | PropsWithSlider;

export const NumberSetting = ({
    settingTitle,
    settingValue,
    settingIcon,
    dialogDescription,
    dialogDisclaimer,
    value,
    defaultValue,
    minValue,
    maxValue,
    stepSize,
    dialogTitle = settingTitle,
    valueUnit,
    handleUpdate,
    showSlider,
    disabled = false,
    handleLiveUpdate,
    listItemTextSx: sx,
}: Props) => {
    const { t } = useTranslation();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogValue, setDialogValue] = useState(value);
    const [originalValue, setOriginalValue] = useState(value);

    const isInvalid =
        (minValue !== undefined && minValue > dialogValue) || (maxValue !== undefined && maxValue < dialogValue);

    const updateValue = useCallback(
        (newValue: number, persist: boolean) => {
            setDialogValue(newValue);
            const didValueChange = newValue !== originalValue;
            // Call handleUpdate if the value changed and 'persist' is true,
            // otherwise call handleLiveUpdate if it's defined.
            if (persist && didValueChange) {
                handleUpdate(newValue);
            } else if (handleLiveUpdate) {
                handleLiveUpdate(newValue);
            }
        },
        [originalValue, setDialogValue, handleLiveUpdate, handleUpdate],
    );

    const cancel = useCallback(() => {
        updateValue(originalValue, true);
        setOriginalValue(originalValue);
        setIsDialogOpen(false);
    }, [originalValue, handleUpdate]);

    const resetToDefault = useCallback(() => {
        if (defaultValue !== undefined) {
            updateValue(defaultValue, true);
            setOriginalValue(defaultValue);
            setIsDialogOpen(false);
        }
    }, [defaultValue, handleUpdate]);

    const submit = () => {
        updateValue(dialogValue, true);
        setOriginalValue(dialogValue);
        setIsDialogOpen(false);
    };

    return (
        <>
            <ListItemButton disabled={disabled} onClick={() => setIsDialogOpen(true)}>
                {settingIcon ? <ListItemIcon>{settingIcon}</ListItemIcon> : null}
                <ListItemText
                    primary={settingTitle}
                    secondary={settingValue}
                    sx={sx}
                    secondaryTypographyProps={{ style: { display: 'flex', flexDirection: 'column' } }}
                />
            </ListItemButton>

            <Dialog open={isDialogOpen} onClose={cancel}>
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogContent>
                    {(!!dialogDescription || !!dialogDisclaimer) && (
                        <DialogContentText sx={{ paddingBottom: '10px' }} component="div">
                            {dialogDescription && (
                                <Typography
                                    variant="body1"
                                    sx={{
                                        whiteSpace: 'pre-line',
                                    }}
                                >
                                    {dialogDescription}
                                </Typography>
                            )}
                            {dialogDisclaimer && (
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
                                        {dialogDisclaimer}
                                    </Typography>
                                </Stack>
                            )}
                        </DialogContentText>
                    )}
                    <TextField
                        sx={{
                            width: '100%',
                            margin: 'auto',
                        }}
                        autoFocus
                        value={dialogValue}
                        type="number"
                        error={isInvalid}
                        helperText={isInvalid ? t('global.error.label.invalid_input') : ''}
                        onChange={(e) => {
                            const newValue = Number(e.target.value);
                            updateValue(newValue, false);
                        }}
                        slotProps={{
                            input: {
                                inputProps: { min: minValue, max: maxValue, step: stepSize },
                                endAdornment: <InputAdornment position="end">{valueUnit}</InputAdornment>,
                            },
                        }}
                    />
                    {showSlider ? (
                        <Slider
                            aria-label="number-setting-slider"
                            defaultValue={defaultValue}
                            value={dialogValue}
                            step={stepSize}
                            min={minValue}
                            max={maxValue}
                            onChange={(_, newValue) => {
                                updateValue(newValue as number, false);
                            }}
                        />
                    ) : null}
                </DialogContent>
                <DialogActions>
                    {defaultValue !== undefined ? (
                        <Button onClick={resetToDefault} color="primary">
                            {t('global.button.reset_to_default')}
                        </Button>
                    ) : null}
                    <Button onClick={cancel} color="primary">
                        {t('global.button.cancel')}
                    </Button>
                    <Button disabled={isInvalid} onClick={submit} color="primary">
                        {t('global.button.ok')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};
