/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import {
    SOURCE_BROWSE_FIELDS,
    SOURCE_LIST_FIELDS,
    SOURCE_MIGRATABLE_FIELDS,
    SOURCE_SETTING_FIELDS,
} from '@/lib/graphql/source/SourceFragments.ts';

export const GET_SOURCE_BROWSE = gql`
    ${SOURCE_BROWSE_FIELDS}

    query GET_SOURCE_BROWSE($id: LongString!) {
        source(id: $id) {
            ...SOURCE_BROWSE_FIELDS
        }
    }
`;

export const GET_SOURCE_SETTINGS = gql`
    ${SOURCE_SETTING_FIELDS}

    query GET_SOURCE_SETTINGS($id: LongString!) {
        source(id: $id) {
            ...SOURCE_SETTING_FIELDS
        }
    }
`;

export const GET_SOURCE_MIGRATABLE = gql`
    ${SOURCE_MIGRATABLE_FIELDS}

    query GET_SOURCE_MIGRATABLE($id: LongString!) {
        source(id: $id) {
            ...SOURCE_MIGRATABLE_FIELDS
        }
    }
`;

export const GET_SOURCES_LIST = gql`
    ${SOURCE_LIST_FIELDS}

    query GET_SOURCES_LIST {
        sources {
            nodes {
                ...SOURCE_LIST_FIELDS
            }
        }
    }
`;

export const GET_MIGRATABLE_SOURCES = gql`
    ${SOURCE_MIGRATABLE_FIELDS}

    query GET_MIGRATABLE_SOURCES {
        mangas(condition: { inLibrary: true }) {
            nodes {
                sourceId
                source {
                    ...SOURCE_MIGRATABLE_FIELDS
                }
            }
        }
    }
`;
