/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { StyledEngineProvider } from '@mui/material/styles';
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';
import { SnackbarProvider } from 'notistack';
import { ActiveDeviceContextProvider } from '@/features/device/DeviceContext.tsx';
import { AppHotkeysProvider } from '@/features/hotkeys/AppHotkeysProvider.tsx';
import { SnackbarWithDescription } from '@/base/components/feedback/SnackbarWithDescription.tsx';
import { AppPageHistoryContextProvider } from '@/base/contexts/AppPageHistoryContext.tsx';
import { AppThemeContextProvider } from '@/features/theme/AppThemeContext.tsx';
import { NavBarContextProvider } from '@/features/navigation-bar/NavbarContext.tsx';
import { SubpathUtil } from '@/lib/utils/SubpathUtil.ts';

interface Props {
    children: React.ReactNode;
}

export const AppContext: React.FC<Props> = ({ children }) => (
    <Router basename={SubpathUtil.getRouterBasename()}>
        <StyledEngineProvider injectFirst>
            <AppThemeContextProvider>
                <QueryParamProvider adapter={ReactRouter6Adapter}>
                    <NavBarContextProvider>
                        <AppPageHistoryContextProvider>
                            <ActiveDeviceContextProvider>
                                <SnackbarProvider
                                    Components={{
                                        default: SnackbarWithDescription,
                                        info: SnackbarWithDescription,
                                        success: SnackbarWithDescription,
                                        warning: SnackbarWithDescription,
                                        error: SnackbarWithDescription,
                                    }}
                                >
                                    <AppHotkeysProvider>{children}</AppHotkeysProvider>
                                </SnackbarProvider>
                            </ActiveDeviceContextProvider>
                        </AppPageHistoryContextProvider>
                    </NavBarContextProvider>
                </QueryParamProvider>
            </AppThemeContextProvider>
        </StyledEngineProvider>
    </Router>
);
