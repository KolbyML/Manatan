/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { enqueueSnackbar, OptionsObject, SnackbarKey } from 'notistack';

export function makeToast(message: string, severity?: OptionsObject['variant'], description?: string): SnackbarKey;
export function makeToast(message: string, options?: OptionsObject, description?: string): SnackbarKey;
export function makeToast(
    message: string,
    options: OptionsObject['variant'] | OptionsObject = 'default',
    description?: string,
): SnackbarKey {
    const variant = typeof options === 'string' ? options : undefined;
    const snackbarOptions = typeof options === 'object' ? options : {};

    return enqueueSnackbar(message, {
        variant,
        ...snackbarOptions,
        // @ts-ignore - TS2353, "notistack" is outdated and the provided way to define custom props is not working, however,
        // everything in the options object gets passed to the custom snackbar component
        description,
    });
}
