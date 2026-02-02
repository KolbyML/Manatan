/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const CACHE_NAME = 'image-cache';

export class ImageCache {
    static async has(url: string): Promise<boolean> {
        try {
            const cache = await caches.open(CACHE_NAME);
            const response = await cache.match(url, { ignoreVary: true });

            return response !== undefined;
        } catch (error) {
            return false;
        }
    }

    static async get(url: string): Promise<Response | null> {
        try {
            const cache = await caches.open(CACHE_NAME);
            const response = await cache.match(url);

            return response || null;
        } catch (error) {
            return null;
        }
    }

    static async clear(): Promise<void> {
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();

        await Promise.all(keys.map((key) => cache.delete(key)));
    }
}
