/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { SOURCE_META_FIELDS, SOURCE_SETTING_FIELDS } from '@/lib/graphql/source/SourceFragments.ts';
import { MANGA_BASE_FIELDS } from '@/lib/graphql/manga/MangaFragments.ts';

export const GET_SOURCE_MANGAS_FETCH = gql`
    ${MANGA_BASE_FIELDS}

    mutation GET_SOURCE_MANGAS_FETCH($input: FetchSourceMangaInput!) {
        fetchSourceManga(input: $input) {
            hasNextPage
            mangas {
                ...MANGA_BASE_FIELDS
            }
        }
    }
`;

export const UPDATE_SOURCE_PREFERENCES = gql`
    ${SOURCE_SETTING_FIELDS}

    mutation UPDATE_SOURCE_PREFERENCES($input: UpdateSourcePreferenceInput!) {
        updateSourcePreference(input: $input) {
            source {
                ...SOURCE_SETTING_FIELDS
            }
        }
    }
`;

export const SET_SOURCE_METADATA = gql`
    ${SOURCE_META_FIELDS}

    mutation SET_SOURCE_METADATA($input: SetSourceMetaInput!) {
        setSourceMeta(input: $input) {
            meta {
                ...SOURCE_META_FIELDS
            }
        }
    }
`;

export const DELETE_SOURCE_METADATA = gql`
    ${SOURCE_META_FIELDS}

    mutation DELETE_SOURCE_METADATA($input: DeleteSourceMetaInput!) {
        deleteSourceMeta(input: $input) {
            meta {
                ...SOURCE_META_FIELDS
            }
        }
    }
`;
