/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';

export const TRACK_RECORD_SEARCH_FIELDS = gql`
    fragment TRACK_RECORD_SEARCH_FIELDS on TrackSearchType {
        id
        remoteId
        title
        trackingUrl
        coverUrl
        publishingType
        startDate
        publishingStatus
        summary
        score
        totalChapters
    }
`;

export const TRACK_RECORD_BIND_FIELDS = gql`
    fragment TRACK_RECORD_BIND_FIELDS on TrackRecordType {
        id
        remoteId
        trackerId
        remoteUrl
        title
        status
        lastChapterRead
        totalChapters
        score
        displayScore
        startDate
        finishDate
        private
    }
`;
