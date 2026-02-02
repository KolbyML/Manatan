/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export const baseCleanup = (str: string) => str.toLowerCase().trim();

export const enhancedCleanup = (str: string): string =>
    baseCleanup(str)
        .normalize('NFKC')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();

export const reverseString = (str: string, separator: string = ''): string =>
    str.split(separator).reverse().join(separator);
