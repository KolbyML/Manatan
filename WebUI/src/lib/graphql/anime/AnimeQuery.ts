/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';

export const GET_ANIME_LIBRARY = gql`
    query GET_ANIME_LIBRARY {
        animes(condition: { inLibrary: true }, order: [{ by: IN_LIBRARY_AT, byType: DESC }]) {
            nodes {
                id
                title
                thumbnailUrl
                url
                inLibrary
                inLibraryAt
            }
            totalCount
        }
    }
`;
