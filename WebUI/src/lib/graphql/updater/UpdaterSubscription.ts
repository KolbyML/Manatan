/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { UPDATER_SUBSCRIPTION_FIELDS } from '@/lib/graphql/updater/UpdaterFragments.ts';

export const UPDATER_SUBSCRIPTION = gql`
    ${UPDATER_SUBSCRIPTION_FIELDS}

    subscription UPDATER_SUBSCRIPTION($input: LibraryUpdateStatusChangedInput!) {
        libraryUpdateStatusChanged(input: $input) {
            ...UPDATER_SUBSCRIPTION_FIELDS
        }
    }
`;
