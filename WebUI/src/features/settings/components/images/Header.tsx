/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { IMAGE_PROCESSING_INPUT_WIDTH } from '@/features/settings/Settings.constants.ts';
import { TSettingsDownloadConversionHeader } from '@/features/settings/Settings.types';

export const Header = ({
    id,
    name,
    value,
    onChange,
    isDuplicate,
}: {
    isDuplicate: boolean;
    onChange: (header: TSettingsDownloadConversionHeader | null) => void;
} & TSettingsDownloadConversionHeader) => {
    const { t } = useTranslation();
    const theme = useTheme();

    return (
        <Stack
            sx={{
                gap: 1,
                flexDirection: 'row',
                flexWrap: 'nowrap',
                alignItems: 'center',
            }}
        >
            <Stack
                sx={{
                    flexDirection: 'row',
                    gap: 2,
                    [theme.breakpoints.down('md')]: {
                        flexDirection: 'column',
                        width: '100%',
                    },
                }}
            >
                <TextField
                    autoFocus
                    sx={{ width: IMAGE_PROCESSING_INPUT_WIDTH }}
                    label={t('download.settings.conversion.headers.name')}
                    value={name}
                    error={isDuplicate}
                    helperText={isDuplicate && t('global.error.label.invalid_input')}
                    onChange={(e) =>
                        onChange({
                            id,
                            name: e.target.value,
                            value,
                        })
                    }
                />
                <TextField
                    sx={{ width: IMAGE_PROCESSING_INPUT_WIDTH }}
                    label={t('download.settings.conversion.headers.value')}
                    value={value}
                    onChange={(e) =>
                        onChange({
                            id,
                            name,
                            value: e.target.value,
                        })
                    }
                />
            </Stack>
            <CustomTooltip disabled={false} title={t('chapter.action.download.delete.label.action')}>
                <IconButton
                    onClick={() => {
                        onChange(null);
                    }}
                >
                    <DeleteIcon />
                </IconButton>
            </CustomTooltip>
        </Stack>
    );
};
