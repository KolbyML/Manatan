/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { DOWNLOAD_STATUS_FIELDS } from '@/lib/graphql/download/DownloadFragments.ts';

export const GET_DOWNLOAD_STATUS = gql`
    ${DOWNLOAD_STATUS_FIELDS}

    query GET_DOWNLOAD_STATUS {
        downloadStatus {
            ...DOWNLOAD_STATUS_FIELDS
        }
    }
`;
