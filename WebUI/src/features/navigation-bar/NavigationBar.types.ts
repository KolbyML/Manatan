/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { OverridableComponent } from '@mui/material/OverridableComponent';
import { SvgIconTypeMap } from '@mui/material/SvgIcon';
import { ReactNode } from 'react';
import { StaticAppRoute } from '@/base/AppRoute.constants.ts';
import { TranslationKey } from '@/base/Base.types.ts';

export interface INavbarOverride {
    status: boolean;
    value: any;
}

export enum NavBarItemMoreGroup {
    GENERAL,
    HIDDEN_ITEM,
    SETTING_INFO,
}

export interface NavbarItem {
    path: StaticAppRoute;
    title: TranslationKey;
    moreTitle?: TranslationKey;
    SelectedIconComponent: OverridableComponent<SvgIconTypeMap<{}, 'svg'>>;
    IconComponent: OverridableComponent<SvgIconTypeMap<{}, 'svg'>>;
    show: 'mobile' | 'desktop' | 'both';
    moreGroup: NavBarItemMoreGroup;
    useBadge?: () => { count: number; title: string };
}

export type NavbarContextType = {
    // AppBar title
    title: string | React.ReactNode;
    setTitle: (title: NavbarContextType['title'], browserTitle?: string) => void;

    appBarHeight: number;
    setAppBarHeight: React.Dispatch<React.SetStateAction<number>>;

    // AppBar action buttons
    action: ReactNode;
    setAction: React.Dispatch<React.SetStateAction<ReactNode>>;

    // Allow default navbar to be overrided
    override: INavbarOverride;
    setOverride: React.Dispatch<React.SetStateAction<INavbarOverride>>;

    // NavBar
    isCollapsed: boolean;
    setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;

    navBarWidth: number;
    setNavBarWidth: React.Dispatch<React.SetStateAction<number>>;

    readerNavBarWidth: number;
    setReaderNavBarWidth: React.Dispatch<React.SetStateAction<number>>;

    bottomBarHeight: number;
    setBottomBarHeight: React.Dispatch<React.SetStateAction<number>>;
};
