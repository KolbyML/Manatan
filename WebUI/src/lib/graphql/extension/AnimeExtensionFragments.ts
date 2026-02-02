import gql from 'graphql-tag';

export const ANIME_EXTENSION_LIST_FIELDS = gql`
    fragment ANIME_EXTENSION_LIST_FIELDS on AnimeExtensionType {
        pkgName
        name
        lang
        versionCode
        versionName
        iconUrl
        repo
        isNsfw
        isInstalled
        isObsolete
        hasUpdate
    }
`;
