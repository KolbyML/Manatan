/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { MANGA_CHAPTER_NODE_FIELDS, MANGA_CHAPTER_STAT_FIELDS } from '@/lib/graphql/manga/MangaFragments.ts';

const UPDATER_MANGA_FIELDS = gql`
    ${MANGA_CHAPTER_STAT_FIELDS}
    ${MANGA_CHAPTER_NODE_FIELDS}

    fragment UPDATER_MANGA_FIELDS on MangaUpdateType {
        status
        manga {
            id
            title
            thumbnailUrl

            ...MANGA_CHAPTER_STAT_FIELDS
            ...MANGA_CHAPTER_NODE_FIELDS
        }
    }
`;

const UPDATER_CATEGORY_FIELDS = gql`
    fragment UPDATER_CATEGORY_FIELDS on CategoryUpdateType {
        status
        category {
            id
            name
        }
    }
`;

const UPDATER_JOB_INFO_FIELDS = gql`
    fragment UPDATER_JOB_INFO_FIELDS on UpdaterJobsInfoType {
        isRunning
        totalJobs
        finishedJobs
        skippedCategoriesCount
        skippedMangasCount
    }
`;

export const UPDATER_STATUS_FIELDS = gql`
    ${UPDATER_JOB_INFO_FIELDS}
    ${UPDATER_CATEGORY_FIELDS}
    ${UPDATER_MANGA_FIELDS}

    fragment UPDATER_STATUS_FIELDS on LibraryUpdateStatus {
        jobsInfo {
            ...UPDATER_JOB_INFO_FIELDS
        }

        categoryUpdates {
            ...UPDATER_CATEGORY_FIELDS
        }

        mangaUpdates {
            ...UPDATER_MANGA_FIELDS
        }
    }
`;

export const UPDATER_SUBSCRIPTION_FIELDS = gql`
    ${UPDATER_JOB_INFO_FIELDS}
    ${UPDATER_CATEGORY_FIELDS}
    ${UPDATER_MANGA_FIELDS}

    fragment UPDATER_SUBSCRIPTION_FIELDS on UpdaterUpdates {
        omittedUpdates

        jobsInfo {
            ...UPDATER_JOB_INFO_FIELDS
        }

        categoryUpdates {
            ...UPDATER_CATEGORY_FIELDS
        }

        mangaUpdates {
            ...UPDATER_MANGA_FIELDS
        }
    }
`;

export const UPDATER_START_STOP_FIELDS = gql`
    fragment UPDATER_START_STOP_FIELDS on UpdateStatus {
        isRunning
    }
`;
