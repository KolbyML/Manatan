/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect } from 'react';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { NavbarContextType } from '@/features/navigation-bar/NavigationBar.types.ts';

export const useAppAction = (action: NavbarContextType['action'], dependencies: any[] = []) => {
    const { setAction } = useNavBarContext();

    useEffect(() => {
        setAction(action);
        return () => setAction(null);
    }, dependencies);
};
