/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { SourceType } from '@/lib/requests/types.ts';
import { MangaIdInfo } from '@/features/manga/Manga.types.ts';

import { ChapterSourceOrderInfo } from '@/features/chapter/Chapter.types.ts';
import { BrowseTab } from '@/features/browse/Browse.types.ts';
import { SearchParam } from '@/base/Base.types.ts';
import { UrlUtil } from '@/lib/UrlUtil.ts';

type AppRouteInfo = {
    match: string;
    path?: string | ((...args: any[]) => string);
};

type TAppRoutes = Record<string, AppRouteInfo & { childRoutes?: TAppRoutes }>;

export const AppRoutes = {
    root: {
        match: '/',
        path: '/',
    },
    matchAll: {
        match: '*',
    },
    authentication: {
        match: 'auth',
        path: '/auth',
        childRoutes: {
            login: {
                match: 'login',
                path: '/auth/login',
            },
        },
    },
    about: {
        match: 'about',
        path: '/about',
    },
    settings: {
        match: 'settings',
        path: '/settings',
        childRoutes: {
            categories: {
                match: 'categories',
                path: '/settings/categories',
            },
            reader: {
                match: 'reader',
                path: '/settings/reader',
            },
            library: {
                match: 'library',
                path: '/settings/library',

                childRoutes: {
                    duplicates: {
                        match: 'duplicates',
                        path: '/settings/library/duplicates',
                    },
                },
            },
            download: {
                match: 'download',
                path: '/settings/download',
                childRoutes: {
                    // TODO: deprecated - got moved to "settings/images/processing/downloads"
                    conversions: {
                        match: 'conversions',
                        path: '/settings/download/conversions',
                    },
                },
            },
            images: {
                match: 'images',
                path: '/settings/images',
                childRoutes: {
                    processingDownloads: {
                        match: 'processing/downloads',
                        path: '/settings/images/processing/downloads',
                    },
                    processingServe: {
                        match: 'processing/serve',
                        path: '/settings/images/processing/serve',
                    },
                },
            },
            backup: {
                match: 'backup',
                path: '/settings/backup',
            },
            server: {
                match: 'server',
                path: '/settings/server',
            },
            browse: {
                match: 'browse',
                path: '/settings/browse',
            },
            device: {
                match: 'device',
                path: '/settings/device',
            },
            tracking: {
                match: 'tracking',
                path: '/settings/tracking',
            },
            appearance: {
                match: 'appearance',
                path: '/settings/appearance',
            },
            history: {
                match: 'history',
                path: '/settings/history',
            },
        },
    },
    sources: {
        match: 'sources',
        path: '/sources',
        childRoutes: {
            browse: {
                match: ':sourceId',
                path: (sourceId: SourceType['id'], query?: string | null | undefined) =>
                    UrlUtil.addQueryParam(`/sources/${sourceId}`, query),
            },
            configure: {
                match: ':sourceId/configure',
                path: (sourceId: SourceType['id']) => `/sources/${sourceId}/configure`,
            },
            searchAll: {
                match: 'all/search',
                path: (query?: string | null | undefined) => UrlUtil.addQueryParam('/sources/all/search', query),
            },
        },
    },
    animeSources: {
        match: 'anime-sources',
        path: '/anime-sources',
        childRoutes: {
            browse: {
                match: ':sourceId',
                path: (sourceId: string, query?: string | null | undefined) =>
                    UrlUtil.addQueryParam(`/anime-sources/${sourceId}`, query),
            },
        },
    },

    extension: {
        match: 'extension',
        path: '/extension',
        childRoutes: {
            info: {
                match: ':pkgName',
                path: (pkgName: string) => `/extension/${pkgName}`,
            },
        },
    },
    downloads: {
        match: 'downloads',
        path: '/downloads',
    },
    manga: {
        match: 'manga/:id',
        path: (mangaId: MangaIdInfo['id']) => `/manga/${mangaId}`,

        childRoutes: {
            reader: {
                match: 'chapter/:chapterNum',
                path: (mangaId: MangaIdInfo['id'], chapterNum: ChapterSourceOrderInfo['sourceOrder']) =>
                    `/manga/${mangaId}/chapter/${chapterNum}`,
            },
        },
    },
    anime: {
        match: 'anime',
        path: '/anime',
        childRoutes: {
            details: {
                match: ':id',
                path: (animeId: number | string) => `/anime/${animeId}`,
            },
            episode: {
                match: ':id/episode/:episodeIndex',
                path: (animeId: number | string, episodeIndex: number | string) =>
                    `/anime/${animeId}/episode/${episodeIndex}`,
            },
        },
    },
    library: {
        match: 'library',
        path: (tab?: string, search?: string) =>
            UrlUtil.addParams('/library', {
                ...UrlUtil.createTabParam(tab),
                ...UrlUtil.createQueryParam(search),
            }),
    },
    updates: {
        match: 'updates',
        path: '/updates',
    },
    history: {
        match: 'history',
        path: '/history',
    },
    recent: {
        match: 'recent',
        path: '/recent',
    },
    browse: {
        match: 'browse',
        path: (tab?: BrowseTab) =>
            UrlUtil.addParams('/browse', {
                [SearchParam.TAB]: tab,
            }),
    },
    migrate: {
        match: 'migrate/source/:sourceId',
        path: (sourceId: SourceType['id']) => `/migrate/source/${sourceId}`,

        childRoutes: {
            search: {
                match: 'manga/:mangaId/search',
                path: (sourceId: SourceType['id'], mangaId: MangaIdInfo['id'], query?: string | null | undefined) =>
                    UrlUtil.addQueryParam(`/migrate/source/${sourceId}/manga/${mangaId}/search`, query),
            },
        },
    },
    tracker: {
        match: 'tracker/login/oauth',
        path: '/tracker/login/oauth',
    },
    reader: {
        match: '/manga/:mangaId/chapter/:chapterSourceOrder/*',
        path: (mangaId: MangaIdInfo['id'], chapterSourceOrder: ChapterSourceOrderInfo['sourceOrder']) =>
            `/manga/${mangaId}/chapter/${chapterSourceOrder}`,
    },
    more: {
        match: '/more',
        path: '/more',
    },
    dictionary: {
        match: 'dictionary',
        path: '/dictionary',
    },
    ln: {
        match: 'ln',
        path: '/ln',
        childRoutes: {
            reader: {
                match: ':id/read',
                path: (id: string) => `/ln/${id}/read`,
            },
        },
    },
} as const satisfies TAppRoutes;

type ExtractChildRouteStringPaths<T> = T extends { childRoutes: infer U } ? ExtractStringPaths<U[keyof U]> : never;

type ExtractStringPaths<T> = T extends { path: infer P }
    ? P extends string
        ? P | ExtractChildRouteStringPaths<T>
        : ExtractChildRouteStringPaths<T>
    : ExtractChildRouteStringPaths<T>;

export type StaticAppRoute = ExtractStringPaths<(typeof AppRoutes)[keyof typeof AppRoutes]>;
