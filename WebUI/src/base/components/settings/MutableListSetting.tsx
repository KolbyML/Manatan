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
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState, type JSX } from 'react';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useTranslation } from 'react-i18next';
import List from '@mui/material/List';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import DialogContentText from '@mui/material/DialogContentText';
import InfoIcon from '@mui/icons-material/Info';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { TextSetting, TextSettingProps } from '@/base/components/settings/text/TextSetting.tsx';
import { TextSettingDialog } from '@/base/components/settings/text/TextSettingDialog.tsx';
import { makeToast } from '@/base/utils/Toast.ts';

const MutableListItem = ({
    handleDelete,
    mutable = true,
    deletable = true,
    ...textSettingProps
}: Omit<TextSettingProps, 'isPassword' | 'disabled'> & {
    handleDelete: () => void;
    mutable?: boolean;
    deletable?: boolean;
}) => {
    const { t } = useTranslation();

    return (
        <Stack sx={{ flexDirection: 'row', alignItems: 'center' }}>
            {mutable ? (
                <TextSetting {...textSettingProps} dialogTitle="" />
            ) : (
                <ListItem>
                    <ListItemText secondary={textSettingProps.value} />
                </ListItem>
            )}
            <CustomTooltip title={t('chapter.action.download.delete.label.action')} disabled={!deletable}>
                <IconButton disabled={!deletable} onClick={handleDelete}>
                    <DeleteIcon />
                </IconButton>
            </CustomTooltip>
        </Stack>
    );
};

type MutableListSettingProps = Pick<TextSettingProps, 'settingName' | 'placeholder'> & {
    valueInfos?: (
        | [value: string]
        | [value: string, Pick<React.ComponentProps<typeof MutableListItem>, 'mutable' | 'deletable'>]
    )[];
    description?: string;
    dialogDisclaimer?: JSX.Element | string;
    addItemButtonTitle?: string;
    handleChange: (values: string[], removedValues: string[]) => void;
    allowDuplicates?: boolean;
    validateItem?: (value: string, tmpValues?: string[]) => boolean;
    invalidItemError?: string;
};

const getValues = (valueInfos: MutableListSettingProps['valueInfos']): string[] =>
    valueInfos?.map((valueInfo) => valueInfo[0]) ?? [];

export const MutableListSetting = ({
    settingName,
    description,
    dialogDisclaimer,
    valueInfos,
    handleChange,
    addItemButtonTitle,
    placeholder,
    allowDuplicates = false,
    validateItem = () => true,
    invalidItemError,
}: MutableListSettingProps) => {
    const { t } = useTranslation();

    const values = getValues(valueInfos);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogValues, setDialogValues] = useState(values);
    const dialogRef = useRef<HTMLDivElement | null>(null);

    const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);

    useEffect(() => {
        if (!valueInfos) {
            return;
        }

        setDialogValues(values);
    }, [valueInfos]);

    const closeDialog = (resetValue: boolean = true) => {
        if (resetValue) {
            setDialogValues(values);
        }

        setIsDialogOpen(false);
    };

    const updateSetting = (index: number, newValue: string | undefined) => {
        const deleteValue = newValue === undefined;
        if (deleteValue) {
            setDialogValues(dialogValues.toSpliced(index, 1));
            return;
        }

        const isDuplicate = !allowDuplicates && dialogValues.includes(newValue);
        if (isDuplicate) {
            return;
        }

        if (newValue === '') {
            return;
        }

        if (!validateItem?.(newValue, dialogValues)) {
            makeToast(invalidItemError ?? t('global.error.label.invalid_input'), 'error');
            return;
        }

        setDialogValues(dialogValues.toSpliced(index, 1, newValue.trim()));
    };

    const saveChanges = () => {
        closeDialog(true);

        const updatedValues = dialogValues.filter((dialogValue) => dialogValue !== '');
        const removedValues = values.filter((value) => !updatedValues.includes(value));

        handleChange(updatedValues, removedValues);
    };

    return (
        <>
            <ListItemButton
                onClick={() => {
                    (document.activeElement as HTMLElement | null)?.blur();
                    setIsDialogOpen(true);
                }}
            >
                <ListItemText
                    primary={settingName}
                    secondary={values?.length ? values?.join(', ') : description}
                    secondaryTypographyProps={{
                        style: { display: 'flex', flexDirection: 'column', wordBreak: 'break-word' },
                    }}
                />
            </ListItemButton>

            <Dialog
                open={isDialogOpen}
                onClose={() => closeDialog()}
                fullWidth
                onEntered={() => dialogRef.current?.focus()}
                PaperProps={{ ref: dialogRef, tabIndex: -1 }}
            >
                <DialogTitle>{settingName}</DialogTitle>
                {(!!description || !!dialogDisclaimer) && (
                    <DialogContent>
                        <DialogContentText sx={{ paddingBottom: '10px' }} component="div">
                            {description && (
                                <Typography
                                    variant="body1"
                                    sx={{
                                        whiteSpace: 'pre-line',
                                    }}
                                >
                                    {description}
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
                    </DialogContent>
                )}
                <DialogContent dividers sx={{ maxHeight: '300px' }}>
                    <List>
                        {dialogValues.map((dialogValue, index) => (
                            <MutableListItem
                                key={dialogValue}
                                settingName=""
                                placeholder={placeholder}
                                handleChange={(newValue: string) => updateSetting(index, newValue)}
                                handleDelete={() => updateSetting(index, undefined)}
                                value={dialogValue}
                                mutable={valueInfos?.find(([value]) => value === dialogValue)?.[1]?.mutable}
                                deletable={valueInfos?.find(([value]) => value === dialogValue)?.[1]?.deletable}
                            />
                        ))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Stack
                        direction="row"
                        sx={{
                            justifyContent: 'space-between',
                            width: '100%',
                        }}
                    >
                        <Button onClick={() => setIsAddItemDialogOpen(true)}>
                            {addItemButtonTitle ?? t('global.button.add')}
                        </Button>
                        <Stack direction="row">
                            <Button onClick={() => closeDialog()}>{t('global.button.cancel')}</Button>
                            <Button onClick={() => saveChanges()}>{t('global.button.ok')}</Button>
                        </Stack>
                    </Stack>
                </DialogActions>
            </Dialog>

            {isAddItemDialogOpen && (
                <TextSettingDialog
                    settingName=""
                    placeholder={placeholder}
                    handleChange={(newValue: string) => updateSetting(dialogValues.length, newValue)}
                    isDialogOpen={isAddItemDialogOpen}
                    setIsDialogOpen={setIsAddItemDialogOpen}
                    validate={(value) => validateItem?.(value, dialogValues) ?? true}
                />
            )}
        </>
    );
};
