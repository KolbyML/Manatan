/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { DOWNLOAD_UPDATES_FIELDS } from '@/lib/graphql/download/DownloadFragments.ts';

export const DOWNLOAD_STATUS_SUBSCRIPTION = gql`
    ${DOWNLOAD_UPDATES_FIELDS}

    subscription DOWNLOAD_STATUS_SUBSCRIPTION($input: DownloadChangedInput!) {
        downloadStatusChanged(input: $input) {
            ...DOWNLOAD_UPDATES_FIELDS
        }
    }
`;
