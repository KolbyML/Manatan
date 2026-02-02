/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';

export const GET_ABOUT = gql`
    query GET_ABOUT {
        aboutServer {
            buildTime
            buildType
            discord
            github
            name
            version
        }
    }
`;

export const CHECK_FOR_SERVER_UPDATES = gql`
    query CHECK_FOR_SERVER_UPDATES {
        checkForServerUpdates {
            channel
            tag
            url
        }
    }
`;
