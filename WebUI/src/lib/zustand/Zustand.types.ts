/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { StateCreator as ZustandStateCreator } from 'zustand';

export type StateCreator<T> = ZustandStateCreator<T, [['zustand/devtools', never], ['zustand/immer', never]], [], T>;

export type SliceCreator<T> = (
    actionNameCreator: (...names: string[]) => string,
    ...args: Parameters<StateCreator<T>>
) => T;
