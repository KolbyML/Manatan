/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';

export const UPDATE_ANIME = gql`
    mutation UPDATE_ANIME($input: UpdateAnimeInput!) {
        updateAnime(input: $input) {
            anime {
                id
                inLibrary
                inLibraryAt
            }
        }
    }
`;

export const UPDATE_ANIMES = gql`
    mutation UPDATE_ANIMES($input: UpdateAnimesInput!) {
        updateAnimes(input: $input) {
            animes {
                id
                inLibrary
                inLibraryAt
            }
        }
    }
`;
