/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';

export const VALIDATE_BACKUP = gql`
    query VALIDATE_BACKUP($backup: Upload!) {
        validateBackup(input: { backup: $backup }) {
            missingSources {
                id
                name
            }
            missingTrackers {
                name
            }
        }
    }
`;

export const GET_RESTORE_STATUS = gql`
    query GET_RESTORE_STATUS($id: String!) {
        restoreStatus(id: $id) {
            mangaProgress
            state
            totalManga
        }
    }
`;
