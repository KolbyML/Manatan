/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { MANGA_META_FIELDS, MANGA_SCREEN_FIELDS } from '@/lib/graphql/manga/MangaFragments.ts';

export const DELETE_MANGA_METADATA = gql`
    ${MANGA_META_FIELDS}

    mutation DELETE_MANGA_METADATA($input: DeleteMangaMetaInput!) {
        deleteMangaMeta(input: $input) {
            meta {
                ...MANGA_META_FIELDS
            }
        }
    }
`;

// makes the server fetch and return the manga
export const GET_MANGA_FETCH = gql`
    ${MANGA_SCREEN_FIELDS}

    mutation GET_MANGA_FETCH($input: FetchMangaInput!) {
        fetchManga(input: $input) {
            manga {
                ...MANGA_SCREEN_FIELDS
            }
        }
    }
`;

// makes the server fetch and return the manga
export const GET_MANGA_TO_MIGRATE_TO_FETCH = gql`
    mutation GET_MANGA_TO_MIGRATE_TO_FETCH(
        $id: Int!
        $migrateChapters: Boolean!
        $migrateCategories: Boolean!
        $migrateTracking: Boolean!
    ) {
        fetchManga(input: { id: $id }) {
            manga {
                id
                title
                inLibrary
                categories @include(if: $migrateCategories) {
                    nodes {
                        id
                    }
                }
                trackRecords @include(if: $migrateTracking) {
                    nodes {
                        id
                        remoteId
                        trackerId
                    }
                }
            }
        }
        fetchChapters(input: { mangaId: $id }) @include(if: $migrateChapters) {
            chapters {
                id
                manga {
                    id
                }
                chapterNumber
                isRead
                isDownloaded
                isBookmarked
            }
        }
    }
`;

export const SET_MANGA_METADATA = gql`
    ${MANGA_META_FIELDS}

    mutation SET_MANGA_METADATA($input: SetMangaMetaInput!) {
        setMangaMeta(input: $input) {
            meta {
                ...MANGA_META_FIELDS
            }
        }
    }
`;

export const UPDATE_MANGA = gql`
    mutation UPDATE_MANGA(
        $input: UpdateMangaInput!
        $updateCategoryInput: UpdateMangaCategoriesInput!
        $updateCategories: Boolean!
    ) {
        updateMangaCategories(input: $updateCategoryInput) @include(if: $updateCategories) {
            manga {
                id
                categories {
                    nodes {
                        id
                        mangas {
                            totalCount
                        }
                    }
                    totalCount
                }
            }
        }
        updateManga(input: $input) {
            manga {
                id
                inLibrary
                inLibraryAt
            }
        }
    }
`;

export const UPDATE_MANGAS = gql`
    mutation UPDATE_MANGAS(
        $input: UpdateMangasInput!
        $updateCategoryInput: UpdateMangasCategoriesInput!
        $updateCategories: Boolean!
    ) {
        updateMangasCategories(input: $updateCategoryInput) @include(if: $updateCategories) {
            mangas {
                id
                categories {
                    nodes {
                        id
                        mangas {
                            totalCount
                        }
                    }
                    totalCount
                }
            }
        }
        updateMangas(input: $input) {
            mangas {
                id
                inLibrary
                inLibraryAt
                categories {
                    nodes {
                        id
                        mangas {
                            totalCount
                        }
                    }
                    totalCount
                }
            }
        }
    }
`;

export const UPDATE_MANGA_CATEGORIES = gql`
    mutation UPDATE_MANGA_CATEGORIES($input: UpdateMangaCategoriesInput!) {
        updateMangaCategories(input: $input) {
            manga {
                id
                categories {
                    nodes {
                        id
                        mangas {
                            totalCount
                        }
                    }
                    totalCount
                }
            }
        }
    }
`;

export const UPDATE_MANGAS_CATEGORIES = gql`
    mutation UPDATE_MANGAS_CATEGORIES($input: UpdateMangasCategoriesInput!) {
        updateMangasCategories(input: $input) {
            mangas {
                id
                categories {
                    nodes {
                        id
                        mangas {
                            totalCount
                        }
                    }
                    totalCount
                }
            }
        }
    }
`;
