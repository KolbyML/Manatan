/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { AssertionError } from 'assert';

export function assertIsDefined<T>(value: T | undefined): asserts value is NonNullable<T> {
    if (value === undefined || value === null) {
        throw new AssertionError({ message: 'Value is undefined or null' });
    }
}
