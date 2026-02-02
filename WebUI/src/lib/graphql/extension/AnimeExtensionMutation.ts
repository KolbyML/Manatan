import gql from 'graphql-tag';
import { ANIME_EXTENSION_LIST_FIELDS } from '@/lib/graphql/extension/AnimeExtensionFragments.ts';

export const GET_ANIME_EXTENSIONS_FETCH = gql`
    ${ANIME_EXTENSION_LIST_FIELDS}
    mutation GET_ANIME_EXTENSIONS_FETCH($input: FetchAnimeExtensionsInput = {}) {
        fetchAnimeExtensions(input: $input) {
            extensions {
                ...ANIME_EXTENSION_LIST_FIELDS
            }
        }
    }
`;

export const UPDATE_ANIME_EXTENSION = gql`
    ${ANIME_EXTENSION_LIST_FIELDS}
    mutation UPDATE_ANIME_EXTENSION($input: UpdateAnimeExtensionInput!) {
        updateAnimeExtension(input: $input) {
            extension {
                ...ANIME_EXTENSION_LIST_FIELDS
            }
        }
    }
`;

export const UPDATE_ANIME_EXTENSIONS = gql`
    ${ANIME_EXTENSION_LIST_FIELDS}
    mutation UPDATE_ANIME_EXTENSIONS($input: UpdateAnimeExtensionsInput!) {
        updateAnimeExtensions(input: $input) {
            extensions {
                ...ANIME_EXTENSION_LIST_FIELDS
            }
        }
    }
`;
