/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import { ComponentProps, ReactNode } from 'react';
import Stack from '@mui/material/Stack';
import { TypographyMaxLines } from '@/base/components/texts/TypographyMaxLines.tsx';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';

export const ChapterCardMetadata = ({
    title,
    secondaryText,
    ternaryText,
    infoIcons,
    slotProps,
}: {
    title: string;
    secondaryText?: string | null;
    ternaryText?: string | null;
    infoIcons?: ReactNode;
    slotProps?: {
        title?: ComponentProps<typeof TypographyMaxLines>;
        secondaryText?: ComponentProps<typeof TypographyMaxLines>;
        ternaryText?: ComponentProps<typeof TypographyMaxLines>;
    };
}) => (
    <Box
        sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flexGrow: 1,
            flexShrink: 1,
            wordBreak: 'break-word',
        }}
    >
        <Stack
            sx={{
                flexDirection: 'row',
                gap: 0.5,
                alignItems: 'center',
            }}
        >
            {infoIcons}
            <CustomTooltip title={title}>
                <TypographyMaxLines variant="h6" component="h3" {...slotProps?.title}>
                    {title}
                </TypographyMaxLines>
            </CustomTooltip>
        </Stack>
        {secondaryText && (
            <CustomTooltip title={secondaryText}>
                <TypographyMaxLines
                    variant="caption"
                    display="block"
                    lines={1}
                    {...slotProps?.secondaryText}
                    sx={{ maxWidth: 'fit-content', ...slotProps?.secondaryText?.sx }}
                >
                    {secondaryText}
                </TypographyMaxLines>
            </CustomTooltip>
        )}
        {ternaryText && (
            <CustomTooltip title={ternaryText}>
                <TypographyMaxLines
                    variant="caption"
                    display="block"
                    lines={1}
                    {...slotProps?.ternaryText}
                    sx={{ maxWidth: 'fit-content', ...slotProps?.ternaryText?.sx }}
                >
                    {ternaryText}
                </TypographyMaxLines>
            </CustomTooltip>
        )}
    </Box>
);
