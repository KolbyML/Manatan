/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { HotkeysProvider } from 'react-hotkeys-hook';
import { ReactNode } from 'react';
import { HotkeyScope } from '@/features/hotkeys/Hotkeys.types.ts';

export const AppHotkeysProvider = ({ children }: { children?: ReactNode }) => (
    <HotkeysProvider initiallyActiveScopes={[HotkeyScope.GLOBAL]}>{children}</HotkeysProvider>
);
