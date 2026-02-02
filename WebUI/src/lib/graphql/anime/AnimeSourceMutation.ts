import gql from 'graphql-tag';

export const GET_SOURCE_ANIMES_FETCH = gql`
    mutation GET_SOURCE_ANIMES_FETCH($input: FetchSourceAnimeInput!) {
        fetchSourceAnime(input: $input) {
            animes {
                id
                title
                thumbnailUrl
                sourceId
                url
                inLibrary
            }
            hasNextPage
        }
    }
`;
