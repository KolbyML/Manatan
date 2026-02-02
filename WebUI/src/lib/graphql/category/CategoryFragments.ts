/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';

export const CATEGORY_META_FIELDS = gql`
    fragment CATEGORY_META_FIELDS on CategoryMetaType {
        categoryId
        key
        value
    }
`;

export const CATEGORY_BASE_FIELDS = gql`
    fragment CATEGORY_BASE_FIELDS on CategoryType {
        id
        name

        default
        order
    }
`;

export const CATEGORY_LIBRARY_FIELDS = gql`
    ${CATEGORY_BASE_FIELDS}
    ${CATEGORY_META_FIELDS}

    fragment CATEGORY_LIBRARY_FIELDS on CategoryType {
        ...CATEGORY_BASE_FIELDS

        meta {
            ...CATEGORY_META_FIELDS
        }
        mangas {
            totalCount
        }
    }
`;

export const CATEGORY_SETTING_FIELDS = gql`
    ${CATEGORY_BASE_FIELDS}

    fragment CATEGORY_SETTING_FIELDS on CategoryType {
        ...CATEGORY_BASE_FIELDS

        includeInUpdate
        includeInDownload
    }
`;
