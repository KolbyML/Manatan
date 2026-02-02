/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export enum WeblateChangeActions {
    RESOURCE_UPDATED = 0,
    TRANSLATION_COMPLETED = 1,
    TRANSLATION_CHANGED = 2,
    COMMENT_ADDED = 3,
    SUGGESTION_ADDED = 4,
    TRANSLATION_ADDED = 5,
    SUGGESTION_ACCEPTED = 7,
    TRANSLATION_REVERTED = 8,
    TRANSLATION_UPLOADED = 9,
    COMPONENT_LOCKED = 14,
    COMPONENT_UNLOCKED = 15,
    CHANGES_COMMITTED = 17,
    CHANGES_PUSHED = 18,
    REPOSITORY_RESET = 19,
    REPOSITORY_MERGED = 20,
    REPOSITORY_REBASED = 21,
    REPOSITORY_MERGE_FAILED = 22,
    REPOSITORY_REBASE_FAILED = 23,
    PARSING_FAILED = 24,
    TRANSLATION_REMOVED = 25,
    SUGGESTION_REMOVED = 26,
    MARKED_FOR_EDIT = 37,
    COMPONENT_RENAMED = 42,
    CONTRIBUTOR_JOINED = 45,
    LANGUAGE_ADDED = 48,
    COMPONENT_CREATED = 51,
    ADD_ON_CONFIGURATION_CHANGED = 61,
}

export interface WeblateChangeResult {
    translation: string;
    action: WeblateChangeActions;
    action_name: keyof WeblateChangeActions;
    user: string;
}

export interface WeblateChangePayload {
    next: string;
    results: WeblateChangeResult[];
}

export interface WeblateUserPayload {
    full_name: string;
}

export interface WeblateLanguagePayload {
    language: {
        name: string;
        code: string;
    };
    translated_percent: number;
}

export type Username = string;
export type UserUrl = string;

export type LanguageName = string;
export type TranslationUrl = string;

export type UsernameByUserUrl = Record<UserUrl, Username>;
export type LanguageNameByTranslationUrl = Record<TranslationUrl, LanguageName>;
export type UserUrlsByTranslationUrl = Record<TranslationUrl, UserUrl[]>;
export type ActionByTranslationUrlByUserUrl = Record<
    UserUrl,
    Record<TranslationUrl, { count: number; actions: Record<WeblateChangeActions, number> }>
>;

export interface Contributor {
    username: Username;
    contributionCount: number;
}

export type ContributionsByLanguage = Record<LanguageName, Contributor[]>;

export interface WeblateLanguageStatistic {
    translated_percent: number;
    code: string;
    name: string;
}
