/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { NavbarContextType } from '@/features/navigation-bar/NavigationBar.types.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { useAppAction } from '@/features/navigation-bar/hooks/useAppAction.ts';

export const useAppTitleAndAction = (
    title: NavbarContextType['title'],
    action: NavbarContextType['action'],
    actionDependencies?: any[],
) => {
    useAppTitle(title);
    useAppAction(action, actionDependencies);
};
