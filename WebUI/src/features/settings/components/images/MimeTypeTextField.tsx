/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { ImageProcessingTargetMode } from '@/features/settings/Settings.types.ts';
import { IMAGE_PROCESSING_INPUT_WIDTH, MIME_TYPE_PREFIX } from '@/features/settings/Settings.constants.ts';
import { isUrlTargetMode } from '@/features/settings/ImageProcessing.utils.ts';

export const MimeTypeTextField = ({
    shouldAutoFocus,
    isDefault,
    isDuplicate,
    label,
    value,
    onUpdate,
    mode,
}: {
    shouldAutoFocus: boolean;
    isDefault: boolean;
    isDuplicate: boolean;
    label: string;
    value: string;
    onUpdate: (value: string) => void;
    mode: ImageProcessingTargetMode;
}) => {
    const { t } = useTranslation();

    const isImageMode = mode === ImageProcessingTargetMode.IMAGE;
    const isValidUrl = !value.length || isUrlTargetMode(value);
    const isValid = !isDuplicate && (isImageMode || isValidUrl);

    return (
        <TextField
            sx={{ width: IMAGE_PROCESSING_INPUT_WIDTH }}
            autoFocus={shouldAutoFocus}
            label={label}
            value={value}
            disabled={isDefault}
            error={!isValid}
            helperText={!isValid && t('global.error.label.invalid_input')}
            slotProps={{
                input: {
                    startAdornment: (
                        <InputAdornment position="start">{isImageMode ? MIME_TYPE_PREFIX : null}</InputAdornment>
                    ),
                },
            }}
            onChange={(e) => onUpdate(e.target.value.trim())}
        />
    );
};
