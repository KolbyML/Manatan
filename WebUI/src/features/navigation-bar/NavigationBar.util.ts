/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { NavbarItem } from '@/features/navigation-bar/NavigationBar.types.ts';
import { MetadataHistorySettings } from '@/features/history/History.types.ts';
import { AppRoutes, StaticAppRoute } from '@/base/AppRoute.constants.ts';

type NavBarItemDeviceFilterKey = `hide${Capitalize<NavbarItem['show']>}`;

type FilterSettings = Pick<MetadataHistorySettings, 'hideHistory'> &
    Partial<Record<NavBarItemDeviceFilterKey, boolean>> & {
        hideMore?: boolean;
    };

const ITEM_TO_VISIBLE_FILTER: Partial<Record<StaticAppRoute, keyof FilterSettings>> = {
    [AppRoutes.history.path]: 'hideHistory',
    [AppRoutes.more.path]: 'hideMore',
};

export class NavigationBarUtil {
    static isPathRestricted(path: StaticAppRoute, filter: FilterSettings): boolean {
        const pathVisibleFilterKey = ITEM_TO_VISIBLE_FILTER[path];

        if (!pathVisibleFilterKey) {
            return false;
        }

        return !!filter[pathVisibleFilterKey];
    }

    static filterItems(
        items: NavbarItem[],
        { hideBoth, hideDesktop, hideMobile, ...filter }: FilterSettings,
    ): NavbarItem[] {
        return items
            .filter((item) => !NavigationBarUtil.isPathRestricted(item.path, filter))
            .filter((item) => {
                switch (item.show) {
                    case 'both':
                        return !hideBoth;
                    case 'desktop':
                        return !hideDesktop;
                    case 'mobile':
                        return !hideMobile;
                    default:
                        return true;
                }
            });
    }
}
