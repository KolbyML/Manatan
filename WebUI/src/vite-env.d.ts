/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/// <reference types="vite/client" />

interface ViteTypeOptions {
    // By adding this line, you can make the type of ImportMetaEnv strict
    // to disallow unknown keys.
    strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
    readonly VITE_SERVER_URL_DEFAULT: string;
    readonly VITE_SUBPATH?: string;
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
