/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import 'i18next';
import en from 'public/locales/en.json';

const resources = {
    translation: en,
};

declare module 'i18next' {
    interface CustomTypeOptions {
        returnNull: false;
        resources: typeof resources;
    }
}
