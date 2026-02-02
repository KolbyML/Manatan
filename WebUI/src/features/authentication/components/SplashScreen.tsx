/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTheme } from '@mui/material/styles';
import Stack, { StackProps } from '@mui/material/Stack';
import { ComponentProps } from 'react';
import { SuwayomiLogo } from '@/assets/SuwayomiLogo.tsx';
import { ServerAddressSetting } from '@/features/settings/components/ServerAddressSetting.tsx';

import { ThemeMode } from '@/features/theme/AppTheme.types.ts';

export const SplashScreen = ({
    slots,
}: {
    slots?: {
        stackProps?: StackProps;
        logoProps?: ComponentProps<typeof SuwayomiLogo>;
        serverAddressProps?: StackProps;
    };
}) => {
    const theme = useTheme();

    return (
        <Stack
            {...slots?.stackProps}
            sx={{
                position: 'relative',
                minWidth: '100vw',
                minHeight: '100vh',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'primary.light',
                ...theme.applyStyles('dark', {
                    backgroundColor: 'primary.dark',
                }),
                ...slots?.stackProps?.sx,
            }}
        >
            <SuwayomiLogo
                circleRingColor={
                    theme.palette.mode === ThemeMode.DARK ? theme.palette.primary.light : theme.palette.primary.dark
                }
                {...slots?.logoProps}
                sx={{
                    fontSize: 250,
                    [theme.breakpoints.up('lg')]: {
                        fontSize: 350,
                    },
                    ...slots?.logoProps?.sx,
                }}
            />
            <Stack
                {...slots?.serverAddressProps}
                sx={{
                    position: 'absolute',
                    left: 0,
                    bottom: 0,
                    ...slots?.serverAddressProps?.sx,
                }}
            >
                <ServerAddressSetting />
            </Stack>
        </Stack>
    );
};
