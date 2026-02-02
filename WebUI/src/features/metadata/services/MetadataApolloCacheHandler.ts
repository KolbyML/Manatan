/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ReadFieldFunction } from '@apollo/client/cache/core/types/common';
import { Reference } from '@apollo/client/utilities';

export const updateMetadataList = (
    key: string,
    existingMetas: Reference[] | undefined,
    readField: ReadFieldFunction,
    createMetaRef: () => Reference | undefined,
    deleted: boolean = false,
): (Reference | undefined)[] | undefined => {
    if (!existingMetas) {
        return existingMetas;
    }

    if (deleted) {
        return existingMetas.filter((metaRef: Reference) => readField('key', metaRef) !== key);
    }

    const exists = existingMetas.some((metaRef: Reference) => readField('key', metaRef) === key);
    if (exists) {
        return existingMetas;
    }

    return [...existingMetas, createMetaRef()];
};
