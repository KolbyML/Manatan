/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Slider, { SliderProps } from '@mui/material/Slider';
import Typography, { TypographyProps } from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { ResetButton } from '@/base/components/buttons/ResetButton.tsx';

export const SliderInput = ({
    label,
    value,
    onDefault,
    slotProps,
}: {
    label: string;
    value: number | string;
    onDefault?: () => void;
    slotProps?: {
        label?: TypographyProps;
        value?: TypographyProps;
        slider?: SliderProps;
    };
}) => (
    <Stack sx={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
        <Stack sx={{ flexBasis: '25%' }}>
            <Typography {...slotProps?.label} sx={{ ...slotProps?.label?.sx }}>
                {label}
            </Typography>
            <Typography {...slotProps?.value} sx={{ ...slotProps?.value?.sx }}>
                {value}
            </Typography>
        </Stack>
        <Slider {...slotProps?.slider} sx={{ flexBasis: '75%', ...slotProps?.slider?.sx }} />
        {onDefault && <ResetButton asIconButton onClick={onDefault} />}
    </Stack>
);
