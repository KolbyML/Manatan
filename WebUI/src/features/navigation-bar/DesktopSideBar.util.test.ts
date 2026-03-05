import assert from 'node:assert/strict';
import test from 'node:test';

import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { getDesktopManatanAnchorTargetPath } from '@/features/navigation-bar/DesktopSideBar.util.ts';
import { NavBarItemMoreGroup, NavbarItem } from '@/features/navigation-bar/NavigationBar.types.ts';

const MockIcon = (() => null) as unknown as NavbarItem['IconComponent'];

const createItem = (path: NavbarItem['path']): NavbarItem => ({
    path,
    title: 'item' as NavbarItem['title'],
    SelectedIconComponent: MockIcon,
    IconComponent: MockIcon,
    show: 'both',
    moreGroup: NavBarItemMoreGroup.GENERAL,
});

test('getDesktopManatanAnchorTargetPath places anchor before About when About exists', () => {
    const targetPath = getDesktopManatanAnchorTargetPath([
        createItem(AppRoutes.settings.path),
        createItem(AppRoutes.about.path),
        createItem(AppRoutes.more.path),
    ]);

    assert.equal(targetPath, AppRoutes.about.path);
});

test('getDesktopManatanAnchorTargetPath falls back to More when About is absent', () => {
    const targetPath = getDesktopManatanAnchorTargetPath([
        createItem(AppRoutes.settings.path),
        createItem(AppRoutes.more.path),
    ]);

    assert.equal(targetPath, AppRoutes.more.path);
});

test('getDesktopManatanAnchorTargetPath returns null when neither About nor More exists', () => {
    const targetPath = getDesktopManatanAnchorTargetPath([createItem(AppRoutes.settings.path)]);

    assert.equal(targetPath, null);
});
