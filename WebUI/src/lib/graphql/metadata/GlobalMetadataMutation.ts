/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { GLOBAL_METADATA } from '@/lib/graphql/common/Fragments.ts';

export const DELETE_GLOBAL_METADATA = gql`
    ${GLOBAL_METADATA}
    mutation DELETE_GLOBAL_METADATA($input: DeleteGlobalMetaInput!) {
        deleteGlobalMeta(input: $input) {
            meta {
                ...GLOBAL_METADATA
            }
        }
    }
`;

export const SET_GLOBAL_METADATA = gql`
    ${GLOBAL_METADATA}
    mutation SET_GLOBAL_METADATA($input: SetGlobalMetaInput!) {
        setGlobalMeta(input: $input) {
            meta {
                ...GLOBAL_METADATA
            }
        }
    }
`;
