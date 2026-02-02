/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';

export const CREATE_BACKUP = gql`
    mutation CREATE_BACKUP($input: CreateBackupInput!) {
        createBackup(input: $input) {
            url
        }
    }
`;

export const RESTORE_BACKUP = gql`
    mutation RESTORE_BACKUP($backup: Upload!, $flags: PartialBackupFlagsInput) {
        restoreBackup(input: { backup: $backup, flags: $flags }) {
            id
            status {
                mangaProgress
                state
                totalManga
            }
        }
    }
`;
