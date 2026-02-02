/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { useLocation } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import MenuIcon from '@mui/icons-material/Menu';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import { useBackButton } from '@/base/hooks/useBackButton.ts';
import { useGetOptionForDirection } from '@/features/theme/services/ThemeCreator.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { DesktopSideBar } from '@/features/navigation-bar/components/DesktopSideBar.tsx';
import { useResizeObserver } from '@/base/hooks/useResizeObserver.tsx';
import { MobileBottomBar } from '@/features/navigation-bar/components/MobileBottomBar.tsx';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { NAVIGATION_BAR_ITEMS } from '@/features/navigation-bar/NavigationBar.constants.ts';
import { NavigationBarUtil } from '@/features/navigation-bar/NavigationBar.util.ts';

export function DefaultNavBar() {
    const { title, action, override, isCollapsed, setIsCollapsed, setAppBarHeight, navBarWidth, setNavBarWidth } =
        useNavBarContext();

    const theme = useTheme();
    const getOptionForDirection = useGetOptionForDirection();
    const { pathname } = useLocation();
    const handleBack = useBackButton();
    const isMobileWidth = MediaQuery.useIsMobileWidth();

    const {
        settings: { hideHistory },
    } = useMetadataServerSettings();

    const appBarRef = useRef<HTMLDivElement | null>(null);

    const isMainRoute = NAVIGATION_BAR_ITEMS.some(({ path, show }) => {
        if (isMobileWidth && show === 'desktop') {
            return false;
        }

        if (!isMobileWidth && show === 'mobile') {
            return false;
        }

        return path === pathname;
    });
    const actualNavBarWidth = isMobileWidth || isCollapsed ? 0 : navBarWidth;

    const visibleNavBarItems = useMemo(
        () =>
            NavigationBarUtil.filterItems(NAVIGATION_BAR_ITEMS, {
                hideHistory,
                hideBoth: false,
                hideDesktop: isMobileWidth,
                hideMobile: !isMobileWidth,
            }),
        [isMobileWidth, hideHistory],
    );
    const NavBarComponent = useMemo(() => (isMobileWidth ? MobileBottomBar : DesktopSideBar), [isMobileWidth]);

    const navBar = useMemo(
        () => <NavBarComponent navBarItems={visibleNavBarItems} />,
        [NavBarComponent, visibleNavBarItems],
    );

    useResizeObserver(
        appBarRef,
        useCallback(() => {
            setAppBarHeight(appBarRef.current?.clientHeight ?? 0);
        }, [appBarRef.current]),
    );

    useLayoutEffect(() => {
        if (override.status) {
            setAppBarHeight(0);
            setNavBarWidth(0);
        }

        return () => {
            setAppBarHeight(0);
            setNavBarWidth(0);
        };
    }, [override.status]);

    useLayoutEffect(() => {
        if (!isMobileWidth) {
            // do not reset navbar width to prevent grid from jumping due to the changing grid item width
            return;
        }

        setNavBarWidth(0);
    }, [isMobileWidth]);

    // Allow default navbar to be overrided
    if (override.status) return override.value;

    return (
        <>
            <AppBar
                ref={appBarRef}
                sx={{
                    position: 'fixed',
                    marginLeft: actualNavBarWidth,
                    pt: 'env(safe-area-inset-top)',
                    width: `calc(100% - ${actualNavBarWidth}px)`,
                    zIndex: theme.zIndex.drawer,
                }}
            >
                <Toolbar sx={{ position: 'relative' }}>
                    {!isMobileWidth && (
                        <Stack
                            sx={{
                                position: 'absolute',
                                left: 0,
                                width: `calc(${navBarWidth}px + env(safe-area-inset-left))`,
                                ...(!isCollapsed && { display: 'none' }),
                                alignItems: 'center',
                            }}
                        >
                            <IconButton aria-label="open drawer" onClick={() => setIsCollapsed(false)} color="inherit">
                                <MenuIcon />
                            </IconButton>
                        </Stack>
                    )}
                    <Stack
                        sx={{
                            ml: `${isCollapsed ? navBarWidth : 0}px`,
                            width: `calc(100% - (${isCollapsed ? navBarWidth : 0}px + env(safe-area-inset-left)))`,
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}
                    >
                        {!isMainRoute && (
                            <IconButton
                                edge="start"
                                component="button"
                                sx={{ marginRight: 2 }}
                                aria-label="menu"
                                onClick={handleBack}
                                color="inherit"
                            >
                                {getOptionForDirection(<ArrowBack />, <ArrowForwardIcon />)}
                            </IconButton>
                        )}
                        <Typography
                            variant="h5"
                            component="h1"
                            noWrap
                            sx={{
                                textOverflow: 'ellipsis',
                                flexGrow: 1,
                            }}
                        >
                            {title}
                        </Typography>
                        {action}
                    </Stack>
                </Toolbar>
            </AppBar>
            {!isMobileWidth || isMainRoute ? navBar : null}
        </>
    );
}
