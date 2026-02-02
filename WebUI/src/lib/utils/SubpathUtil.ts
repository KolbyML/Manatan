/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export class SubpathUtil {
    public static getSubpath(): string {
        const envSubpath = import.meta.env.VITE_SUBPATH;
        if (envSubpath && envSubpath !== '/') {
            return envSubpath;
        }

        const serverSubpath = this.getServerSubpath();
        if (serverSubpath && serverSubpath !== '/') {
            return serverSubpath;
        }

        return '';
    }

    private static getServerSubpath(): string | null {
        const baseTag = document.querySelector('base');
        if (!baseTag) {
            return null;
        }

        return baseTag.href.replace(window.location.origin, '').slice(0, -1);
    }

    public static getRouterBasename(): string | undefined {
        return this.getSubpath() || undefined;
    }

    public static getApiBaseUrl(serverUrl: string): string {
        const baseUrl = serverUrl;
        const subpath = this.getSubpath();

        if (!subpath) {
            return baseUrl;
        }

        return `${baseUrl}${subpath}`;
    }
}
