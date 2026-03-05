/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { NavigationBarUtil } from '@/features/navigation-bar/NavigationBar.util.ts';
import { NavbarItem } from '@/features/navigation-bar/NavigationBar.types.ts';

type NavBarFilter = Parameters<typeof NavigationBarUtil.filterItems>[1];

export const getVisibleNavBarItems = (navBarItems: NavbarItem[], filter: NavBarFilter): NavbarItem[] => {
    const items = NavigationBarUtil.filterItems(navBarItems, filter);
    const hiddenItems = NavigationBarUtil.getHiddenItems(navBarItems, filter);
    const hasMoreEntries = hiddenItems.length > 0;

    const moreItem = navBarItems.find((item) => item.path === AppRoutes.more.path);

    if (hasMoreEntries && moreItem && !items.some((item) => item.path === moreItem.path)) {
        return [...items, moreItem];
    }

    if (!hasMoreEntries && items.some((item) => item.path === AppRoutes.more.path)) {
        return items.filter((item) => item.path !== AppRoutes.more.path);
    }

    return items;
};
