import gql from 'graphql-tag';
import { ANIME_EXTENSION_LIST_FIELDS } from '@/lib/graphql/extension/AnimeExtensionFragments.ts';
import { PAGE_INFO } from '@/lib/graphql/common/Fragments.ts';

export const GET_ANIME_EXTENSIONS = gql`
    ${ANIME_EXTENSION_LIST_FIELDS}
    ${PAGE_INFO}
    query GET_ANIME_EXTENSIONS(
        $after: Cursor
        $before: Cursor
        $condition: AnimeExtensionConditionInput
        $filter: AnimeExtensionFilterInput
        $first: Int
        $last: Int
        $offset: Int
        $order: [AnimeExtensionOrderInput!]
    ) {
        animeExtensions(
            after: $after
            before: $before
            condition: $condition
            filter: $filter
            first: $first
            last: $last
            offset: $offset
            order: $order
        ) {
            nodes {
                ...ANIME_EXTENSION_LIST_FIELDS
            }
            pageInfo {
                ...PAGE_INFO
            }
            totalCount
        }
    }
`;
