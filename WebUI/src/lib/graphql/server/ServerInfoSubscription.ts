/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { WEBUI_UPDATE_STATUS } from '@/lib/graphql/server/InfoFragments.ts';

export const WEBUI_UPDATE_SUBSCRIPTION = gql`
    ${WEBUI_UPDATE_STATUS}
    subscription WEBUI_UPDATE_SUBSCRIPTION {
        webUIUpdateStatusChange {
            ...WEBUI_UPDATE_STATUS
        }
    }
`;
