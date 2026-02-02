/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useContext, useCallback, useMemo, useState } from 'react';
import { INavbarOverride, NavbarContextType } from '@/features/navigation-bar/NavigationBar.types.ts';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';

export const NavBarContext = React.createContext<NavbarContextType>({
    title: 'Suwayomi',
    setTitle: (): void => {},
    appBarHeight: 0,
    setAppBarHeight: (): void => {},
    action: <div />,
    setAction: (): void => {},
    override: { status: false, value: <div /> },
    setOverride: (): void => {},
    isCollapsed: false,
    setIsCollapsed: (): void => {},
    navBarWidth: 0,
    setNavBarWidth: (): void => {},
    readerNavBarWidth: 0,
    setReaderNavBarWidth: (): void => {},
    bottomBarHeight: 0,
    setBottomBarHeight: (): void => {},
});

export const useNavBarContext = () => useContext(NavBarContext);

interface IProps {
    children: React.ReactNode;
}

export function NavBarContextProvider({ children }: IProps) {
    const [title, setTitle] = useState<string | React.ReactNode>('Suwayomi');
    const [action, setAction] = useState<any>(<div />);
    const [appBarHeight, setAppBarHeight] = useState(0);
    const [override, setOverride] = useState<INavbarOverride>({
        status: false,
        value: <div />,
    });
    const [isCollapsed, setIsCollapsed] = useLocalStorage('NavBar::isCollapsed', false);
    const [navBarWidth, setNavBarWidth] = useState(0);
    const [readerNavBarWidth, setReaderNavBarWidth] = useState(0);
    const [bottomBarHeight, setBottomBarHeight] = useState(0);

    const updateTitle = useCallback(
        (newTitle: string | React.ReactNode, browserTitle: string = typeof newTitle === 'string' ? newTitle : '') => {
            document.title = `${browserTitle} - Suwayomi`;
            setTitle(newTitle);
        },
        [setTitle],
    );

    const value = useMemo(
        () => ({
            title,
            setTitle: updateTitle,
            appBarHeight,
            setAppBarHeight,
            action,
            setAction,
            override,
            setOverride,
            isCollapsed,
            setIsCollapsed,
            navBarWidth,
            setNavBarWidth,
            readerNavBarWidth,
            setReaderNavBarWidth,
            bottomBarHeight,
            setBottomBarHeight,
        }),
        [
            title,
            updateTitle,
            appBarHeight,
            setAppBarHeight,
            action,
            setAction,
            override,
            setOverride,
            isCollapsed,
            setIsCollapsed,
            navBarWidth,
            setNavBarWidth,
            readerNavBarWidth,
            setReaderNavBarWidth,
            bottomBarHeight,
            setBottomBarHeight,
        ],
    );
    return <NavBarContext.Provider value={value}>{children}</NavBarContext.Provider>;
}
