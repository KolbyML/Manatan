/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { APP_METADATA_KEY_PREFIX, GLOBAL_METADATA_KEYS } from '@/features/metadata/Metadata.constants.ts';
import { AppMetadataKeys, Metadata } from '@/features/metadata/Metadata.types.ts';
import { getActiveDevice } from '@/features/device/services/Device.ts';

export const extractOriginalKey = (key: string) => key.split('_').slice(-1)[0];

/**
 * Returns the key with the provided prefixes.
 *
 * In case the key is not a global key ({@link GLOBAL_METADATA_KEYS}), the active device name ({@link getActiveDevice})
 * will be added as the second prefix.
 *
 * **Important**
 *
 * "default" (case-insensitive) is a reserved value and will be handled as if there is no prefix to add
 *
 * The format is <prefixes>\_<key>
 *
 *     e.g.: <base_prefix>\_[device_name]\_[optional_prefix1]\_[optional_prefix2]\_<key>
 */
export const getMetadataKey = (key: string, prefixes: string[] = [], appPrefix: string = APP_METADATA_KEY_PREFIX) => {
    const isGlobalMetadataKey = GLOBAL_METADATA_KEYS.includes(key as AppMetadataKeys);
    const addActiveDevicePrefix = !isGlobalMetadataKey;

    const finalPrefix = [appPrefix, ...(addActiveDevicePrefix ? [getActiveDevice()] : []), ...prefixes].filter(
        (prefix) => prefix.toLowerCase() !== 'default',
    );

    return `${finalPrefix.join('_')}_${key}`;
};

export const doesMetadataKeyExistIn = (
    meta: Metadata | undefined,
    key: string,
    prefixes?: string[],
    appPrefix?: string,
): boolean => Object.prototype.hasOwnProperty.call(meta ?? {}, getMetadataKey(key, prefixes, appPrefix));
