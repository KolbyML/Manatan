/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useLayoutEffect } from 'react';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { NavbarContextType } from '@/features/navigation-bar/NavigationBar.types.ts';

export function useAppTitle(
    title: NavbarContextType['title'],
    browserTitleOrDependencies: string,
    dependencies?: any[],
): void;
export function useAppTitle(title: NavbarContextType['title'], browserTitleOrDependencies?: any[]): void;
export function useAppTitle(
    title: NavbarContextType['title'],
    browserTitleOrDependencies?: string | any[],
    dependencies: any[] = [title, browserTitleOrDependencies],
): void {
    const { setTitle } = useNavBarContext();

    useLayoutEffect(() => {
        if (typeof browserTitleOrDependencies === 'string') {
            setTitle(title, browserTitleOrDependencies);
        } else {
            setTitle(title);
        }

        return () => {
            setTitle('');
        };
    }, dependencies);
}
