/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { KO_SYNC_STATUS } from '@/lib/graphql/koreader/KoreaderSyncFragments.ts';

export const GET_KO_SYNC_STATUS = gql`
    ${KO_SYNC_STATUS}

    query GET_KO_SYNC_STATUS {
        koSyncStatus {
            ...KO_SYNC_STATUS
        }
    }
`;
