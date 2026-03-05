import assert from 'node:assert/strict';
import test from 'node:test';

import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { getVisibleNavBarItems } from '@/features/navigation-bar/DefaultNavBar.util.ts';
import { NavBarItemMoreGroup, NavbarItem } from '@/features/navigation-bar/NavigationBar.types.ts';

const MockIcon = (() => null) as unknown as NavbarItem['IconComponent'];

const createItem = (path: NavbarItem['path'], show: NavbarItem['show'] = 'both'): NavbarItem => ({
    path,
    title: 'item' as NavbarItem['title'],
    SelectedIconComponent: MockIcon,
    IconComponent: MockIcon,
    show,
    moreGroup: NavBarItemMoreGroup.GENERAL,
});

const baseFilter = {
    hideHistory: false,
    hideBoth: false,
    hideDesktop: false,
    hideMobile: false,
    visibleTabs: [AppRoutes.anime.path, AppRoutes.about.path, AppRoutes.more.path],
};

test('getVisibleNavBarItems removes "More" when there are no hidden entries', () => {
    const items = [createItem(AppRoutes.anime.path), createItem(AppRoutes.more.path)];
    const visibleItems = getVisibleNavBarItems(items, baseFilter);

    assert.deepEqual(
        visibleItems.map((item) => item.path),
        [AppRoutes.anime.path],
    );
});

test('getVisibleNavBarItems keeps "More" when hidden entries exist', () => {
    const items = [createItem(AppRoutes.anime.path), createItem(AppRoutes.about.path), createItem(AppRoutes.more.path)];
    const visibleItems = getVisibleNavBarItems(items, {
        ...baseFilter,
        visibleTabs: [AppRoutes.anime.path, AppRoutes.more.path],
    });

    assert.deepEqual(
        visibleItems.map((item) => item.path),
        [AppRoutes.anime.path, AppRoutes.more.path],
    );
});

test('getVisibleNavBarItems appends "More" when hidden entries exist and "More" is missing', () => {
    const items = [createItem(AppRoutes.anime.path), createItem(AppRoutes.about.path), createItem(AppRoutes.more.path)];
    const visibleItems = getVisibleNavBarItems(items, {
        ...baseFilter,
        visibleTabs: [AppRoutes.anime.path],
    });

    assert.deepEqual(
        visibleItems.map((item) => item.path),
        [AppRoutes.anime.path, AppRoutes.more.path],
    );
});
