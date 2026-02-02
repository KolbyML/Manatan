/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useRef } from 'react';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { HotkeyScope } from '@/features/hotkeys/Hotkeys.types.ts';

export const useDisableAllHotkeysWhileMounted = (shouldDisable?: boolean) => {
    const { activeScopes, enableScope, disableScope } = useHotkeysContext();
    const previouslyEnabledScopes = useRef<typeof activeScopes>([]);

    useEffect(() => {
        if (!shouldDisable) {
            return () => {};
        }

        previouslyEnabledScopes.current = [...activeScopes];

        enableScope(HotkeyScope.NONE);
        previouslyEnabledScopes.current.forEach(disableScope);

        return () => {
            disableScope(HotkeyScope.NONE);
            previouslyEnabledScopes.current.forEach(enableScope);
        };
    }, [shouldDisable]);
};
