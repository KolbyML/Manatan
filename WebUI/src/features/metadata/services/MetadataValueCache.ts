/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { MetadataHolderType } from '@/features/metadata/Metadata.types.ts';

export class MetadataValueCache {
    private static convertedValueByKey = new Map<string, unknown>();

    private static rawValueByKey = new Map<string, string | undefined>();

    private static getCacheKey(type: MetadataHolderType, holderId: string | number | undefined, key: string): string {
        return `${type}::${holderId ?? ''}::${key}`;
    }

    static getStableValue<T>(
        type: MetadataHolderType,
        holderId: string | number | undefined,
        key: string,
        rawValue: string | undefined,
        newValue: T,
    ): T {
        const cacheKey = this.getCacheKey(type, holderId, key);
        const cachedRawValue = this.rawValueByKey.get(cacheKey);
        const cachedConvertedValue = this.convertedValueByKey.get(cacheKey);

        if (cachedRawValue !== undefined && rawValue === cachedRawValue) {
            return cachedConvertedValue as T;
        }

        this.rawValueByKey.set(cacheKey, rawValue);
        this.convertedValueByKey.set(cacheKey, newValue);

        return newValue;
    }
}
