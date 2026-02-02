/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { PAGE_INFO } from '@/lib/graphql/common/Fragments.ts';
import { EXTENSION_LIST_FIELDS } from '@/lib/graphql/extension/ExtensionFragments.ts';

export const GET_EXTENSION = gql`
    ${EXTENSION_LIST_FIELDS}

    query GET_EXTENSION($pkgName: String!) {
        extension(pkgName: $pkgName) {
            ...EXTENSION_LIST_FIELDS
        }
    }
`;

// returns the current extensions from the database
export const GET_EXTENSIONS = gql`
    ${EXTENSION_LIST_FIELDS}
    ${PAGE_INFO}

    query GET_EXTENSIONS(
        $after: Cursor
        $before: Cursor
        $condition: ExtensionConditionInput
        $filter: ExtensionFilterInput
        $first: Int
        $last: Int
        $offset: Int
        $order: [ExtensionOrderInput!]
    ) {
        extensions(
            after: $after
            before: $before
            condition: $condition
            filter: $filter
            first: $first
            last: $last
            offset: $offset
            order: $order
        ) {
            nodes {
                ...EXTENSION_LIST_FIELDS
            }
            pageInfo {
                ...PAGE_INFO
            }
            totalCount
        }
    }
`;
