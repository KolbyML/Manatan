/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { PAGE_INFO } from '@/lib/graphql/common/Fragments.ts';
import {
    CATEGORY_BASE_FIELDS,
    CATEGORY_LIBRARY_FIELDS,
    CATEGORY_SETTING_FIELDS,
} from '@/lib/graphql/category/CategoryFragments.ts';
import { MANGA_LIBRARY_FIELDS } from '@/lib/graphql/manga/MangaFragments.ts';

export const GET_CATEGORIES_BASE = gql`
    ${CATEGORY_BASE_FIELDS}
    ${PAGE_INFO}

    query GET_CATEGORIES_BASE(
        $after: Cursor
        $before: Cursor
        $condition: CategoryConditionInput
        $filter: CategoryFilterInput
        $first: Int
        $last: Int
        $offset: Int
        $order: [CategoryOrderInput!]
    ) {
        categories(
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
                ...CATEGORY_BASE_FIELDS
            }
            pageInfo {
                ...PAGE_INFO
            }
            totalCount
        }
    }
`;

export const GET_CATEGORIES_LIBRARY = gql`
    ${CATEGORY_LIBRARY_FIELDS}
    ${PAGE_INFO}

    query GET_CATEGORIES_LIBRARY(
        $after: Cursor
        $before: Cursor
        $condition: CategoryConditionInput
        $filter: CategoryFilterInput
        $first: Int
        $last: Int
        $offset: Int
        $order: [CategoryOrderInput!]
    ) {
        categories(
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
                ...CATEGORY_LIBRARY_FIELDS
            }
            pageInfo {
                ...PAGE_INFO
            }
            totalCount
        }
    }
`;

export const GET_CATEGORIES_SETTINGS = gql`
    ${CATEGORY_SETTING_FIELDS}
    ${PAGE_INFO}

    query GET_CATEGORIES_SETTINGS(
        $after: Cursor
        $before: Cursor
        $condition: CategoryConditionInput
        $filter: CategoryFilterInput
        $first: Int
        $last: Int
        $offset: Int
        $order: [CategoryOrderInput!]
    ) {
        categories(
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
                ...CATEGORY_SETTING_FIELDS
            }
            pageInfo {
                ...PAGE_INFO
            }
            totalCount
        }
    }
`;

export const GET_CATEGORY_MANGAS = gql`
    ${MANGA_LIBRARY_FIELDS}
    ${PAGE_INFO}

    query GET_CATEGORY_MANGAS($id: Int!) {
        category(id: $id) {
            id
            mangas {
                nodes {
                    ...MANGA_LIBRARY_FIELDS
                }
                pageInfo {
                    ...PAGE_INFO
                }
                totalCount
            }
        }
    }
`;
