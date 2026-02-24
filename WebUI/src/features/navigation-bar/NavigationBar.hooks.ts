/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useState, useEffect } from 'react';
import { AppStorage } from '@/lib/storage/AppStorage.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { NAVIGATION_BAR_ITEMS } from '@/features/navigation-bar/NavigationBar.constants.ts';

const STORAGE_KEY_STARTUP_PAGE = 'navigation_startup_page';
const STORAGE_KEY_VISIBLE_TABS = 'navigation_visible_tabs';

const DEFAULT_STARTUP_PAGE = AppRoutes.library.path();
const DEFAULT_VISIBLE_TABS = NAVIGATION_BAR_ITEMS.map((item) => item.path);

export function useNavigationSettings() {
    const [defaultStartupPage, setDefaultStartupPage] = useState<string>(
        () => AppStorage.local.getItem(STORAGE_KEY_STARTUP_PAGE) || DEFAULT_STARTUP_PAGE,
    );

    const [visibleTabs, setVisibleTabs] = useState<string[]>(() =>
        AppStorage.local.getItemParsed<string[]>(STORAGE_KEY_VISIBLE_TABS, DEFAULT_VISIBLE_TABS),
    );

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY_STARTUP_PAGE) {
                setDefaultStartupPage(e.newValue || DEFAULT_STARTUP_PAGE);
            } else if (e.key === STORAGE_KEY_VISIBLE_TABS) {
                setVisibleTabs(AppStorage.local.parseValue(e.newValue, DEFAULT_VISIBLE_TABS));
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const updateDefaultStartupPage = (path: string) => {
        setDefaultStartupPage(path);
        AppStorage.local.setItem(STORAGE_KEY_STARTUP_PAGE, path);
    };

    const updateVisibleTabs = (paths: string[]) => {
        setVisibleTabs(paths);
        AppStorage.local.setItem(STORAGE_KEY_VISIBLE_TABS, paths);
    };

    const toggleTabVisibility = (path: string) => {
        const newVisibleTabs = visibleTabs.includes(path)
            ? visibleTabs.filter((p) => p !== path)
            : [...visibleTabs, path];
        updateVisibleTabs(newVisibleTabs);
    };

    return {
        defaultStartupPage,
        setDefaultStartupPage: updateDefaultStartupPage,
        visibleTabs,
        setVisibleTabs: updateVisibleTabs,
        toggleTabVisibility,
    };
}
