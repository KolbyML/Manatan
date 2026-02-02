/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import { d } from 'koration';
import { useElementSize } from '@mantine/hooks';
import { Headers } from '@/features/settings/components/images/Headers.tsx';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { TranslationKey } from '@/base/Base.types.ts';
import {
    IMAGE_PROCESSING_CALL_TIMEOUT,
    IMAGE_PROCESSING_COMPRESSION,
    IMAGE_PROCESSING_CONNECT_TIMEOUT,
    IMAGE_PROCESSING_INPUT_WIDTH,
    IMAGE_PROCESSING_TARGET_MODES_SELECT_VALUES,
    TARGET_DISABLED,
} from '@/features/settings/Settings.constants.ts';
import { Select } from '@/base/components/inputs/Select.tsx';
import { TypographyMaxLines } from '@/base/components/texts/TypographyMaxLines.tsx';
import { MimeTypeTextField } from '@/features/settings/components/images/MimeTypeTextField.tsx';
import { ImageProcessingTargetMode, TSettingsDownloadConversion } from '@/features/settings/Settings.types.ts';
import {
    isDefaultMimeType,
    isValidCallTimeoutSetting,
    isValidCompressionLevel,
    isValidConnectTimeoutSetting,
} from '@/features/settings/ImageProcessing.utils.ts';

export const Processing = ({
    conversion,
    conversion: { mode, mimeType, target, compressionLevel, headers, callTimeout, connectTimeout },
    onChange,
    isDuplicate,
}: {
    conversion: TSettingsDownloadConversion;
    onChange: (newConversion: TSettingsDownloadConversion | null) => void;
    isDuplicate: boolean;
}) => {
    const { t } = useTranslation();
    const theme = useTheme();

    const { ref: textFieldRef, height: textFieldHeight } = useElementSize();

    const [areHeadersCollapsed, setAreHeadersCollapsed] = useState(true);

    const isDisabledMode = mode === ImageProcessingTargetMode.DISABLED;
    const isImageMode = mode === ImageProcessingTargetMode.IMAGE;

    const isCallTimeoutValid = isValidCallTimeoutSetting(callTimeout);
    const isConnectTimeoutValid = isValidConnectTimeoutSetting(connectTimeout);
    const isCompressionLevelValid = isValidCompressionLevel(compressionLevel);
    const isDefault = isDefaultMimeType(mimeType) && !isDuplicate;
    const isDisabled = isDefault && !target && compressionLevel == null;

    return (
        <Stack>
            <Stack
                sx={{
                    gap: 1,
                    flexDirection: 'row',
                    flexWrap: 'nowrap',
                    alignItems: 'center',
                    pt: 1,
                }}
            >
                <Stack
                    sx={{
                        gap: 1,
                        flexDirection: 'row',
                        alignItems: 'baseline',
                        flexWrap: 'wrap',
                        [theme.breakpoints.down('md')]: {
                            flexDirection: 'column',
                            width: '100%',
                        },
                    }}
                >
                    <MimeTypeTextField
                        mode={ImageProcessingTargetMode.IMAGE}
                        shouldAutoFocus
                        isDefault={isDefault}
                        isDuplicate={isDuplicate}
                        label={t('download.settings.conversion.mime_type')}
                        value={mimeType}
                        onUpdate={(value) => {
                            onChange({
                                ...conversion,
                                mimeType: value,
                            });
                        }}
                    />
                    <TypographyMaxLines
                        sx={{
                            [theme.breakpoints.up('md')]: { mx: 1 },
                        }}
                    >
                        →
                    </TypographyMaxLines>
                    <FormControl sx={{ minWidth: '100px' }}>
                        <InputLabel id="image-conversion-target-mode-label">
                            {t('download.settings.conversion.target_modes.title')}
                        </InputLabel>
                        <Select
                            ref={textFieldRef}
                            id="image-conversion-target-mode"
                            labelId="image-conversion-target-mode-label"
                            label={t('download.settings.conversion.target_modes.title')}
                            value={mode}
                            onChange={(e) =>
                                onChange({
                                    ...conversion,
                                    mode: e.target.value,
                                    target:
                                        e.target.value === ImageProcessingTargetMode.DISABLED ? TARGET_DISABLED : '',
                                })
                            }
                        >
                            {IMAGE_PROCESSING_TARGET_MODES_SELECT_VALUES.map(([selectValue, { text: selectText }]) => (
                                <MenuItem key={selectValue} value={selectValue}>
                                    {t(selectText as TranslationKey)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {!isDisabledMode && (
                        <MimeTypeTextField
                            mode={mode}
                            shouldAutoFocus={false}
                            isDefault={false}
                            isDuplicate={false}
                            label={t('download.settings.conversion.target')}
                            value={target}
                            onUpdate={(value) =>
                                onChange({
                                    ...conversion,
                                    target: value,
                                })
                            }
                        />
                    )}
                    {(() => {
                        if (isDisabledMode) {
                            return null;
                        }

                        if (isImageMode) {
                            return (
                                <TextField
                                    sx={{ width: IMAGE_PROCESSING_INPUT_WIDTH }}
                                    label={t('download.settings.conversion.compression_level')}
                                    value={compressionLevel ?? ''}
                                    type="number"
                                    error={!isCompressionLevelValid}
                                    helperText={!isCompressionLevelValid ? t('global.error.label.invalid_input') : ''}
                                    slotProps={{
                                        input: {
                                            inputProps: IMAGE_PROCESSING_COMPRESSION,
                                        },
                                    }}
                                    onChange={(e) => {
                                        onChange({
                                            ...conversion,
                                            compressionLevel: e.target.value ? Number(e.target.value) : null,
                                        });
                                    }}
                                />
                            );
                        }

                        return (
                            <>
                                <TextField
                                    sx={{ width: IMAGE_PROCESSING_INPUT_WIDTH }}
                                    label={t('download.settings.conversion.call_timeout')}
                                    value={callTimeout ? d(callTimeout).seconds.inWholeSeconds : ''}
                                    type="number"
                                    error={!isCallTimeoutValid}
                                    helperText={!isCallTimeoutValid ? t('global.error.label.invalid_input') : ''}
                                    slotProps={{
                                        input: {
                                            inputProps: IMAGE_PROCESSING_CALL_TIMEOUT,
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    {t('global.date.label.second_other')}
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                    onChange={(e) => {
                                        onChange({
                                            ...conversion,
                                            callTimeout: e.target.value
                                                ? d(Number(e.target.value)).seconds.toISOString()
                                                : null,
                                        });
                                    }}
                                />
                                <TextField
                                    sx={{ width: IMAGE_PROCESSING_INPUT_WIDTH }}
                                    label={t('download.settings.conversion.connect_timeout')}
                                    value={connectTimeout ? d(connectTimeout).seconds.inWholeSeconds : ''}
                                    type="number"
                                    error={!isConnectTimeoutValid}
                                    helperText={!isConnectTimeoutValid ? t('global.error.label.invalid_input') : ''}
                                    slotProps={{
                                        input: {
                                            inputProps: IMAGE_PROCESSING_CONNECT_TIMEOUT,
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    {t('global.date.label.second_other')}
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                    onChange={(e) => {
                                        onChange({
                                            ...conversion,
                                            connectTimeout: e.target.value
                                                ? d(Number(e.target.value)).seconds.toISOString()
                                                : null,
                                        });
                                    }}
                                />
                                <Button
                                    onClick={() => setAreHeadersCollapsed(!areHeadersCollapsed)}
                                    variant={areHeadersCollapsed ? 'outlined' : 'contained'}
                                    sx={{ height: textFieldHeight }}
                                >
                                    {t('download.settings.conversion.headers.button', {
                                        count: headers?.length ?? 0,
                                    })}
                                </Button>
                            </>
                        );
                    })()}
                </Stack>
                <CustomTooltip disabled={isDisabled} title={t('chapter.action.download.delete.label.action')}>
                    <IconButton
                        disabled={isDisabled}
                        onClick={() => {
                            onChange(null);
                        }}
                    >
                        <DeleteIcon />
                    </IconButton>
                </CustomTooltip>
            </Stack>
            <Headers
                open={!areHeadersCollapsed}
                headers={headers}
                onChange={(updatedHeaders) =>
                    onChange({
                        ...conversion,
                        headers: updatedHeaders,
                    })
                }
            />
        </Stack>
    );
};
