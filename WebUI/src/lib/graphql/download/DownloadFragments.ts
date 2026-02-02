/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';

export const DOWNLOAD_TYPE_FIELDS = gql`
    fragment DOWNLOAD_TYPE_FIELDS on DownloadType {
        chapter {
            id
            name
            sourceOrder
            isDownloaded
        }

        manga {
            id
            title
            downloadCount
        }

        progress
        state
        tries
    }
`;

export const DOWNLOAD_STATUS_FIELDS = gql`
    ${DOWNLOAD_TYPE_FIELDS}

    fragment DOWNLOAD_STATUS_FIELDS on DownloadStatus {
        state

        queue {
            ...DOWNLOAD_TYPE_FIELDS
        }
    }
`;

export const DOWNLOAD_UPDATES_FIELDS = gql`
    ${DOWNLOAD_TYPE_FIELDS}

    fragment DOWNLOAD_UPDATES_FIELDS on DownloadUpdates {
        state
        omittedUpdates

        updates {
            type
            download {
                ...DOWNLOAD_TYPE_FIELDS
                position
            }
        }
    }
`;
