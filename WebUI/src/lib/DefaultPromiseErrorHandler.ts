/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export const defaultPromiseErrorHandler = (name: string) => (error: any) => {
    if (import.meta.env.PROD) {
        return;
    }

    // eslint-disable-next-line no-console
    console.error(`${name} failed due to`, error);
};
