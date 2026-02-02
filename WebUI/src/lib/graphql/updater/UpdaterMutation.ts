/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { UPDATER_STATUS_FIELDS } from '@/lib/graphql/updater/UpdaterFragments.ts';

export const UPDATE_LIBRARY = gql`
    ${UPDATER_STATUS_FIELDS}

    mutation UPDATE_LIBRARY($input: UpdateLibraryInput = {}) {
        updateLibrary(input: $input) {
            updateStatus {
                ...UPDATER_STATUS_FIELDS
            }
        }
    }
`;

export const STOP_UPDATER = gql`
    mutation STOP_UPDATER($input: UpdateStopInput = {}) {
        updateStop(input: $input) {
            clientMutationId
        }
    }
`;
