/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { TRACK_RECORD_BIND_FIELDS } from '@/lib/graphql/tracker/TrackRecordFragments.ts';
import { TRACKER_SETTING_FIELDS } from '@/lib/graphql/tracker/TrackFragments.ts';

export const TRACKER_LOGIN_OAUTH = gql`
    ${TRACKER_SETTING_FIELDS}

    mutation TRACKER_LOGIN_OAUTH($input: LoginTrackerOAuthInput!) {
        loginTrackerOAuth(input: $input) {
            tracker {
                ...TRACKER_SETTING_FIELDS
            }
        }
    }
`;

export const TRACKER_LOGIN_CREDENTIALS = gql`
    ${TRACKER_SETTING_FIELDS}

    mutation TRACKER_LOGIN_CREDENTIALS($input: LoginTrackerCredentialsInput!) {
        loginTrackerCredentials(input: $input) {
            isLoggedIn
            tracker {
                ...TRACKER_SETTING_FIELDS
            }
        }
    }
`;

export const TRACKER_LOGOUT = gql`
    ${TRACKER_SETTING_FIELDS}

    mutation TRACKER_LOGOUT($trackerId: Int!) {
        logoutTracker(input: { trackerId: $trackerId }) {
            tracker {
                ...TRACKER_SETTING_FIELDS
            }
        }
    }
`;

export const TRACKER_BIND = gql`
    ${TRACK_RECORD_BIND_FIELDS}

    mutation TRACKER_BIND($input: BindTrackInput!) {
        bindTrack(input: $input) {
            trackRecord {
                ...TRACK_RECORD_BIND_FIELDS
                manga {
                    id
                    trackRecords {
                        totalCount
                        nodes {
                            id
                            trackerId
                        }
                    }
                }
            }
        }
    }
`;

export const TRACKER_UNBIND = gql`
    mutation TRACKER_UNBIND($input: UnbindTrackInput!) {
        unbindTrack(input: $input) {
            trackRecord {
                id
                manga {
                    id
                    trackRecords {
                        totalCount
                        nodes {
                            id
                            trackerId
                        }
                    }
                }
            }
        }
    }
`;

export const TRACKER_UPDATE_BIND = gql`
    ${TRACK_RECORD_BIND_FIELDS}

    mutation TRACKER_UPDATE_BIND($input: UpdateTrackInput!) {
        updateTrack(input: $input) {
            trackRecord {
                ...TRACK_RECORD_BIND_FIELDS
                manga {
                    id
                    trackRecords {
                        totalCount
                        nodes {
                            id
                            trackerId
                        }
                    }
                }
            }
        }
    }
`;

export const TRACKER_FETCH_BIND = gql`
    ${TRACK_RECORD_BIND_FIELDS}

    mutation TRACKER_FETCH_BIND($recordId: Int!) {
        fetchTrack(input: { recordId: $recordId }) {
            trackRecord {
                ...TRACK_RECORD_BIND_FIELDS
            }
        }
    }
`;
