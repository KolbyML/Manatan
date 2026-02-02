/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { SERVER_SETTINGS } from '@/lib/graphql/settings/SettingsFragments.ts';

export const GET_SERVER_SETTINGS = gql`
    ${SERVER_SETTINGS}
    query GET_SERVER_SETTINGS {
        settings {
            ...SERVER_SETTINGS
        }
    }
`;
