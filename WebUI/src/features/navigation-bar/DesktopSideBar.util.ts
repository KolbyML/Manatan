/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { NavbarItem } from '@/features/navigation-bar/NavigationBar.types.ts';

export const getDesktopManatanAnchorTargetPath = (navBarItems: NavbarItem[]): NavbarItem['path'] | null => {
    if (navBarItems.some((item) => item.path === AppRoutes.about.path)) {
        return AppRoutes.about.path;
    }

    if (navBarItems.some((item) => item.path === AppRoutes.more.path)) {
        return AppRoutes.more.path;
    }

    return null;
};
