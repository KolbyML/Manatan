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
        visibleTabs?: string[];
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
            .filter((item) => {
                if (filter.visibleTabs && !filter.visibleTabs.includes(item.path)) {
                    return false;
                }
                return !NavigationBarUtil.isPathRestricted(item.path, filter);
            })
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

    static getHiddenItems(
        items: NavbarItem[],
        { hideBoth, hideDesktop, hideMobile, ...filter }: FilterSettings,
    ): NavbarItem[] {
        return items.filter((item) => {
            // "More" is a special item that shouldn't be counted as a hidden item
            if (item.path === AppRoutes.more.path) {
                return false;
            }

            // If it's explicitly restricted (like History when hideHistory is true)
            if (NavigationBarUtil.isPathRestricted(item.path, filter)) {
                return false;
            }

            // If it's hidden because of visibleTabs
            const isHiddenByVisibleTabs = filter.visibleTabs && !filter.visibleTabs.includes(item.path);

            // If it's hidden because of device type
            let isHiddenByDevice = false;
            switch (item.show) {
                case 'both':
                    isHiddenByDevice = !!hideBoth;
                    break;
                case 'desktop':
                    isHiddenByDevice = !!hideDesktop;
                    break;
                case 'mobile':
                    isHiddenByDevice = !!hideMobile;
                    break;
                default:
                    isHiddenByDevice = false;
                    break;
            }

            // We want items that are NOT shown in the main nav but ARE allowed to be shown (not restricted)
            return isHiddenByVisibleTabs || isHiddenByDevice;
        });
    }
}
