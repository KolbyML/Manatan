/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { GLOBAL_METADATA, PAGE_INFO } from '@/lib/graphql/common/Fragments.ts';

export const GET_GLOBAL_METADATA = gql`
    ${GLOBAL_METADATA}
    query GET_GLOBAL_METADATA($key: String!) {
        meta(key: $key) {
            ...GLOBAL_METADATA
        }
    }
`;

export const GET_GLOBAL_METADATAS = gql`
    ${GLOBAL_METADATA}
    ${PAGE_INFO}
    query GET_GLOBAL_METADATAS(
        $after: Cursor
        $before: Cursor
        $condition: MetaConditionInput
        $filter: MetaFilterInput
        $first: Int
        $last: Int
        $offset: Int
        $order: [MetaOrderInput!]
    ) {
        metas(
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
                ...GLOBAL_METADATA
            }
            pageInfo {
                ...PAGE_INFO
            }
            totalCount
        }
    }
`;
