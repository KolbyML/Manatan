import gql from 'graphql-tag';

export const ANIME_SOURCE_BROWSE_FIELDS = gql`
    fragment ANIME_SOURCE_BROWSE_FIELDS on AnimeSourceType {
        id
        name
        displayName
        lang
        baseUrl
        isConfigurable
        supportsLatest
        isNsfw
        iconUrl
        filters {
            ... on AnimeCheckBoxFilter {
                type: __typename
                CheckBoxFilterDefault: default
                name
            }
            ... on AnimeHeaderFilter {
                type: __typename
                name
            }
            ... on AnimeSelectFilter {
                type: __typename
                SelectFilterDefault: default
                name
                values
            }
            ... on AnimeTriStateFilter {
                type: __typename
                TriStateFilterDefault: default
                name
            }
            ... on AnimeTextFilter {
                type: __typename
                TextFilterDefault: default
                name
            }
            ... on AnimeSortFilter {
                type: __typename
                SortFilterDefault: default {
                    ascending
                    index
                }
                name
                values
            }
            ... on AnimeSeparatorFilter {
                type: __typename
                name
            }
            ... on AnimeGroupFilter {
                type: __typename
                name
                filters {
                    ... on AnimeCheckBoxFilter {
                        type: __typename
                        CheckBoxFilterDefault: default
                        name
                    }
                    ... on AnimeHeaderFilter {
                        type: __typename
                        name
                    }
                    ... on AnimeSelectFilter {
                        type: __typename
                        SelectFilterDefault: default
                        name
                        values
                    }
                    ... on AnimeTriStateFilter {
                        type: __typename
                        TriStateFilterDefault: default
                        name
                    }
                    ... on AnimeTextFilter {
                        type: __typename
                        TextFilterDefault: default
                        name
                    }
                    ... on AnimeSortFilter {
                        type: __typename
                        SortFilterDefault: default {
                            ascending
                            index
                        }
                        name
                        values
                    }
                    ... on AnimeSeparatorFilter {
                        type: __typename
                        name
                    }
                }
            }
        }
    }
`;
