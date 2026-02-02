/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';

export const SOURCE_META_FIELDS = gql`
    fragment SOURCE_META_FIELDS on SourceMetaType {
        sourceId
        key
        value
    }
`;

export const SOURCE_BASE_FIELDS = gql`
    fragment SOURCE_BASE_FIELDS on SourceType {
        id
        name
        displayName
        lang
    }
`;

export const SOURCE_MIGRATABLE_FIELDS = gql`
    ${SOURCE_BASE_FIELDS}

    fragment SOURCE_MIGRATABLE_FIELDS on SourceType {
        ...SOURCE_BASE_FIELDS

        lang
        iconUrl
    }
`;

export const SOURCE_LIST_FIELDS = gql`
    ${SOURCE_BASE_FIELDS}
    ${SOURCE_META_FIELDS}

    fragment SOURCE_LIST_FIELDS on SourceType {
        ...SOURCE_BASE_FIELDS

        lang
        iconUrl
        isNsfw
        isConfigurable
        supportsLatest

        meta {
            ...SOURCE_META_FIELDS
        }

        extension {
            pkgName
            repo
        }
    }
`;

export const SOURCE_BROWSE_FIELDS = gql`
    ${SOURCE_BASE_FIELDS}
    ${SOURCE_META_FIELDS}

    fragment SOURCE_BROWSE_FIELDS on SourceType {
        ...SOURCE_BASE_FIELDS

        baseUrl

        isConfigurable
        supportsLatest

        meta {
            ...SOURCE_META_FIELDS
        }

        filters {
            ... on CheckBoxFilter {
                type: __typename
                CheckBoxFilterDefault: default
                name
            }
            ... on HeaderFilter {
                type: __typename
                name
            }
            ... on SelectFilter {
                type: __typename
                SelectFilterDefault: default
                name
                values
            }
            ... on TriStateFilter {
                type: __typename
                TriStateFilterDefault: default
                name
            }
            ... on TextFilter {
                type: __typename
                TextFilterDefault: default
                name
            }
            ... on SortFilter {
                type: __typename
                SortFilterDefault: default {
                    ascending
                    index
                }
                name
                values
            }
            ... on SeparatorFilter {
                type: __typename
                name
            }
            ... on GroupFilter {
                type: __typename
                name
                filters {
                    ... on CheckBoxFilter {
                        type: __typename
                        CheckBoxFilterDefault: default
                        name
                    }
                    ... on HeaderFilter {
                        type: __typename
                        name
                    }
                    ... on SelectFilter {
                        type: __typename
                        SelectFilterDefault: default
                        name
                        values
                    }
                    ... on TriStateFilter {
                        type: __typename
                        TriStateFilterDefault: default
                        name
                    }
                    ... on TextFilter {
                        type: __typename
                        TextFilterDefault: default
                        name
                    }
                    ... on SortFilter {
                        type: __typename
                        SortFilterDefault: default {
                            ascending
                            index
                        }
                        name
                        values
                    }
                    ... on SeparatorFilter {
                        type: __typename
                        name
                    }
                }
            }
        }
    }
`;

export const SOURCE_SETTING_FIELDS = gql`
    ${SOURCE_BASE_FIELDS}

    fragment SOURCE_SETTING_FIELDS on SourceType {
        ...SOURCE_BASE_FIELDS

        preferences {
            ... on CheckBoxPreference {
                type: __typename
                CheckBoxCheckBoxCurrentValue: currentValue
                summary
                CheckBoxDefault: default
                key
                CheckBoxTitle: title
            }
            ... on EditTextPreference {
                type: __typename
                EditTextPreferenceCurrentValue: currentValue
                EditTextPreferenceDefault: default
                EditTextPreferenceTitle: title
                text
                summary
                key
                dialogTitle
                dialogMessage
            }
            ... on SwitchPreference {
                type: __typename
                SwitchPreferenceCurrentValue: currentValue
                summary
                key
                SwitchPreferenceDefault: default
                SwitchPreferenceTitle: title
            }
            ... on MultiSelectListPreference {
                type: __typename
                dialogMessage
                dialogTitle
                MultiSelectListPreferenceTitle: title
                summary
                key
                entryValues
                entries
                MultiSelectListPreferenceDefault: default
                MultiSelectListPreferenceCurrentValue: currentValue
            }
            ... on ListPreference {
                type: __typename
                ListPreferenceCurrentValue: currentValue
                ListPreferenceDefault: default
                ListPreferenceTitle: title
                summary
                key
                entryValues
                entries
            }
        }
    }
`;
