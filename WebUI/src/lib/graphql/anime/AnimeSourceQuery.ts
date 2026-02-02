import gql from 'graphql-tag';
import { ANIME_SOURCE_BROWSE_FIELDS } from '@/lib/graphql/anime/AnimeSourceFragments.ts';

export const GET_ANIME_SOURCE_BROWSE = gql`
    ${ANIME_SOURCE_BROWSE_FIELDS}
    query GET_ANIME_SOURCE_BROWSE($id: LongString!) {
        animeSource(id: $id) {
            ...ANIME_SOURCE_BROWSE_FIELDS
        }
    }
`;

export const GET_ANIME_SOURCES_LIST = gql`
    query GET_ANIME_SOURCES_LIST {
        animeSources {
            nodes {
                id
                name
                displayName
                lang
                iconUrl
                isNsfw
                isConfigurable
                supportsLatest
                baseUrl
                meta {
                    sourceId
                    key
                    value
                }
                extension {
                    pkgName
                    repo
                }
            }
        }
    }
`;
