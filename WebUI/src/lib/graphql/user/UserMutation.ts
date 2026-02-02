/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';

export const USER_LOGIN = gql`
    mutation USER_LOGIN($password: String!, $username: String!) {
        login(input: { password: $password, username: $username }) {
            accessToken
            refreshToken
        }
    }
`;

export const USER_REFRESH = gql`
    mutation USER_REFRESH($refreshToken: String!) {
        refreshToken(input: { refreshToken: $refreshToken }) {
            accessToken
        }
    }
`;
