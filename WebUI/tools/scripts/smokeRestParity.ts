/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

type RestCheckResult = {
    ok: boolean;
    error?: string;
    count?: number;
    sample?: unknown;
    meta?: Record<string, unknown>;
};

type GraphqlResult<T> = { data?: T; errors?: { message: string }[] };

const getBaseUrl = (): string => {
    const raw =
        process.env.MANATAN_BASE_URL ||
        process.env.VITE_SERVER_URL_DEFAULT ||
        'http://localhost:4567';
    return raw.replace(/\/+$/, '');
};

const getEnvNumber = (name: string): number | undefined => {
    const value = process.env[name];
    if (value == null || value === '') {
        return undefined;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        throw new Error(`Invalid ${name}: ${value}`);
    }

    return parsed;
};

const asBool = (value?: string): boolean =>
    ['1', 'true', 'yes'].includes((value ?? '').toLowerCase());

const fetchJson = async <T>(url: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText} (${url})`);
    }
    return (await response.json()) as T;
};

const fetchGraphql = async <T>(baseUrl: string, query: string, variables?: Record<string, unknown>): Promise<T> => {
    const response = await fetch(`${baseUrl}/api/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as GraphqlResult<T>;
    if (payload.errors?.length) {
        throw new Error(payload.errors.map((error) => error.message).join('; '));
    }

    if (!payload.data) {
        throw new Error('GraphQL response missing data');
    }

    return payload.data;
};

const safeCheck = async <T>(fn: () => Promise<T>): Promise<[T | undefined, string | undefined]> => {
    try {
        return [await fn(), undefined];
    } catch (error) {
        return [undefined, error instanceof Error ? error.message : String(error)];
    }
};

const main = async () => {
    const baseUrl = getBaseUrl();
    const allowGraphqlMissing = asBool(process.env.ALLOW_GRAPHQL_MISSING);
    const allowMangaPagesMissing = asBool(process.env.ALLOW_MANGA_PAGES_MISSING);
    const strictParity = asBool(process.env.STRICT_PARITY);
    const requireAnime = asBool(process.env.REQUIRE_ANIME);

    const results: Record<string, RestCheckResult> = {};
    const warnings: string[] = [];

    const [gqlProbe] = await safeCheck(() => fetchGraphql<{ __typename: string }>(baseUrl, 'query { __typename }'));
    const graphqlAvailable = !!gqlProbe;

    const extensionsResponse = await safeCheck(() =>
        fetchJson<any[]>(`${baseUrl}/api/v1/extension/list`),
    );
    if (extensionsResponse[0]) {
        results.extensions = {
            ok: true,
            count: extensionsResponse[0].length,
            sample: extensionsResponse[0][0] ?? null,
        };
    } else {
        results.extensions = { ok: false, error: extensionsResponse[1] };
    }

    const sourcesResponse = await safeCheck(() => fetchJson<any[]>(`${baseUrl}/api/v1/source/list`));
    if (sourcesResponse[0]) {
        results.sources = {
            ok: true,
            count: sourcesResponse[0].length,
            sample: sourcesResponse[0][0] ?? null,
        };
    } else {
        results.sources = { ok: false, error: sourcesResponse[1] };
    }

    const animeSourcesResponse = await safeCheck(() =>
        fetchJson<any[]>(`${baseUrl}/api/v1/anime/source/list`),
    );
    if (animeSourcesResponse[0]) {
        results.animeSources = {
            ok: true,
            count: animeSourcesResponse[0].length,
            sample: animeSourcesResponse[0][0] ?? null,
        };
    } else {
        results.animeSources = { ok: false, error: animeSourcesResponse[1] };
    }

    const trackersResponse = await safeCheck(() => fetchJson<any[]>(`${baseUrl}/api/v1/track/list`));
    if (trackersResponse[0]) {
        results.trackers = {
            ok: true,
            count: trackersResponse[0].length,
            sample: trackersResponse[0][0] ?? null,
        };
    } else {
        results.trackers = { ok: false, error: trackersResponse[1] };
    }

    const animeSourceId =
        Array.isArray(animeSourcesResponse[0]) && animeSourcesResponse[0].length
            ? animeSourcesResponse[0][0]?.id
            : undefined;
    if (animeSourceId) {
        const [animeSource, animeSourceError] = await safeCheck(() =>
            fetchJson<any>(`${baseUrl}/api/v1/anime/source/${animeSourceId}`),
        );
        results.animeSource = animeSource
            ? { ok: true, sample: animeSource }
            : { ok: false, error: animeSourceError };

        const searchQuery = process.env.MANATAN_ANIME_SOURCE_QUERY || 'one';
        const [animeSourceSearch, animeSourceSearchError] = await safeCheck(() =>
            fetchJson<any>(
                `${baseUrl}/api/v1/anime/source/${animeSourceId}/search?query=${encodeURIComponent(searchQuery)}&page=1`,
            ),
        );
        if (animeSourceSearch) {
            const animeList = Array.isArray(animeSourceSearch)
                ? animeSourceSearch
                : animeSourceSearch?.animeList ?? [];
            results.animeSourceSearch = {
                ok: true,
                count: animeList.length,
                sample: animeList[0] ?? null,
            };
        } else {
            results.animeSourceSearch = { ok: false, error: animeSourceSearchError };
        }
    }

    const [animeLibrary, animeLibraryError] = await safeCheck(() =>
        fetchJson<any[]>(`${baseUrl}/api/v1/anime/library`),
    );
    if (animeLibrary) {
        results.animeLibrary = {
            ok: true,
            count: animeLibrary.length,
            sample: animeLibrary[0] ?? null,
        };
    } else {
        results.animeLibrary = { ok: false, error: animeLibraryError };
    }

    let mangaId = getEnvNumber('MANATAN_MANGA_ID');
    if (mangaId == null) {
        if (!graphqlAvailable && !allowGraphqlMissing) {
            throw new Error('GraphQL is unavailable. Set MANATAN_MANGA_ID to continue.');
        }
        if (graphqlAvailable) {
            const mangaQuery =
                'query GetManga($first:Int){mangas(first:$first){nodes{id title}}}';
            const mangaData = await fetchGraphql<{
                mangas?: { nodes?: { id?: number; title?: string }[] };
            }>(baseUrl, mangaQuery, { first: 1 });
            mangaId = mangaData.mangas?.nodes?.[0]?.id;
        }
    }

    if (mangaId != null) {
        const mangaResponse = await safeCheck(() => fetchJson<any>(`${baseUrl}/api/v1/manga/${mangaId}`));
        if (mangaResponse[0]) {
            results.manga = { ok: true, sample: mangaResponse[0] };
        } else {
            results.manga = { ok: false, error: mangaResponse[1] };
        }

        const chaptersResponse = await safeCheck(() =>
            fetchJson<any[]>(`${baseUrl}/api/v1/manga/${mangaId}/chapters`),
        );
        if (chaptersResponse[0]) {
            const chapters = chaptersResponse[0];
            const chapterSample = chapters[0] ?? null;
            results.mangaChapters = { ok: true, count: chapters.length, sample: chapterSample };

            const envChapterIndex = getEnvNumber('MANATAN_CHAPTER_INDEX');
            const chapterIndex =
                envChapterIndex ??
                Number(chapterSample?.sourceOrder ?? chapterSample?.index ?? chapterSample?.chapterNumber);
            if (Number.isFinite(chapterIndex)) {
                const pagesResponse = await safeCheck(() =>
                    fetchJson<string[] | { pages?: string[] }>(
                        `${baseUrl}/api/v1/manga/${mangaId}/chapter/${chapterIndex}/pages`,
                    ),
                );
                if (pagesResponse[0]) {
                    const pagesPayload = pagesResponse[0];
                    const pages = Array.isArray(pagesPayload) ? pagesPayload : pagesPayload?.pages ?? [];
                    const proxyCount = pages.filter((page) => page.includes('/api/v1/media/image')).length;
                    results.mangaPages = {
                        ok: true,
                        count: pages.length,
                        sample: pages[0] ?? null,
                        meta: {
                            mediaProxyStatus:
                                pages.length === 0
                                    ? 'unknown'
                                    : proxyCount === pages.length
                                      ? 'all'
                                      : proxyCount
                                        ? 'partial'
                                        : 'none',
                        },
                    };
                } else {
                    results.mangaPages = { ok: false, error: pagesResponse[1] };
                }
            } else {
                results.mangaPages = { ok: false, error: 'Missing chapter index' };
            }
        } else {
            results.mangaChapters = { ok: false, error: chaptersResponse[1] };
        }
    } else {
        results.manga = { ok: false, error: 'Missing manga id' };
    }

    let animeId = getEnvNumber('MANATAN_ANIME_ID');
    if (animeId == null) {
        if (Array.isArray(animeLibrary) && animeLibrary.length) {
            animeId = animeLibrary[0]?.id;
        } else if (animeLibraryError) {
            warnings.push(`Anime library REST check failed: ${animeLibraryError}`);
        }
    }

    if (animeId == null && graphqlAvailable) {
        const animeQuery = 'query GetAnime($first:Int){animes(first:$first){nodes{id title}}}';
        const [animeData, animeError] = await safeCheck(() =>
            fetchGraphql<{ animes?: { nodes?: { id?: number }[] } }>(baseUrl, animeQuery, { first: 1 }),
        );
        if (animeData?.animes?.nodes?.length) {
            animeId = animeData.animes.nodes[0]?.id;
        } else if (animeError) {
            warnings.push(`Anime GraphQL query failed: ${animeError}`);
        }
    }

    if (animeId != null) {
        const animeResponse = await safeCheck(() => fetchJson<any>(`${baseUrl}/api/v1/anime/${animeId}`));
        if (animeResponse[0]) {
            results.anime = { ok: true, sample: animeResponse[0] };
        } else {
            results.anime = { ok: false, error: animeResponse[1] };
        }

        const episodesResponse = await safeCheck(() =>
            fetchJson<any[]>(`${baseUrl}/api/v1/anime/${animeId}/episodes`),
        );
        if (episodesResponse[0]) {
            const episodes = episodesResponse[0];
            const episodeSample = episodes[0] ?? null;
            results.animeEpisodes = { ok: true, count: episodes.length, sample: episodeSample };

            const episodeIndex = Number(episodeSample?.index ?? episodeSample?.episodeNumber ?? episodeSample?.sourceOrder);
            if (Number.isFinite(episodeIndex)) {
                const episodeResponse = await safeCheck(() =>
                    fetchJson<any>(`${baseUrl}/api/v1/anime/${animeId}/episode/${episodeIndex}`),
                );
                results.animeEpisode = episodeResponse[0]
                    ? { ok: true, sample: episodeResponse[0] }
                    : { ok: false, error: episodeResponse[1] };

                const videosResponse = await safeCheck(() =>
                    fetchJson<any[]>(`${baseUrl}/api/v1/anime/${animeId}/episode/${episodeIndex}/videos`),
                );
                results.animeEpisodeVideos = videosResponse[0]
                    ? { ok: true, count: videosResponse[0].length, sample: videosResponse[0][0] ?? null }
                    : { ok: false, error: videosResponse[1] };
            } else {
                results.animeEpisode = { ok: false, error: 'Missing episode index' };
                results.animeEpisodeVideos = { ok: false, error: 'Missing episode index' };
            }
        } else {
            results.animeEpisodes = { ok: false, error: episodesResponse[1] };
        }
    } else if (requireAnime) {
        results.anime = { ok: false, error: 'Missing anime id' };
    }

    if (graphqlAvailable) {
        const extensionsRest = results.extensions.ok ? (results.extensions.count ?? 0) : 0;
        const sourcesRest = results.sources.ok ? (results.sources.count ?? 0) : 0;
        const extensionQuery =
            'query GetExtensions{extensions{nodes{pkgName} totalCount}}';
        const sourceQuery = 'query GetSources{sources{nodes{id} }}';

        const [extensionsGraphql, extensionsGraphqlError] = await safeCheck(() =>
            fetchGraphql<{ extensions?: { totalCount?: number; nodes?: { pkgName?: string }[] } }>(
                baseUrl,
                extensionQuery,
            ),
        );
        const [sourcesGraphql, sourcesGraphqlError] = await safeCheck(() =>
            fetchGraphql<{ sources?: { nodes?: { id?: string }[] } }>(baseUrl, sourceQuery),
        );

        if (extensionsGraphqlError) {
            warnings.push(`GraphQL extensions check failed: ${extensionsGraphqlError}`);
        } else if (extensionsGraphql?.extensions?.nodes) {
            const gqlCount = extensionsGraphql.extensions.nodes.length;
            if (extensionsRest && gqlCount && extensionsRest !== gqlCount) {
                warnings.push(`Extension count mismatch (rest=${extensionsRest}, graphql=${gqlCount}).`);
                if (strictParity) {
                    throw new Error('Strict parity check failed for extensions count.');
                }
            }
        }

        if (sourcesGraphqlError) {
            warnings.push(`GraphQL sources check failed: ${sourcesGraphqlError}`);
        } else if (sourcesGraphql?.sources?.nodes) {
            const gqlCount = sourcesGraphql.sources.nodes.length;
            if (sourcesRest && gqlCount && sourcesRest !== gqlCount) {
                warnings.push(`Source count mismatch (rest=${sourcesRest}, graphql=${gqlCount}).`);
                if (strictParity) {
                    throw new Error('Strict parity check failed for sources count.');
                }
            }
        }
    } else if (!allowGraphqlMissing) {
        warnings.push('GraphQL not available; parity checks skipped.');
    }

    const output = { baseUrl, graphqlAvailable, results, warnings };
    console.log(JSON.stringify(output, null, 2));

    if (allowMangaPagesMissing && results.mangaPages?.ok === false) {
        warnings.push('Manga pages REST check failed but ALLOW_MANGA_PAGES_MISSING is enabled.');
    }

    const requiredFailures = Object.entries(results)
        .filter(([key]) => !key.startsWith('anime'))
        .filter(([key]) => !(allowMangaPagesMissing && key === 'mangaPages'))
        .some(([, value]) => value.ok === false);
    const animeFailures = requireAnime
        ? Object.entries(results).some(([key, value]) => key.startsWith('anime') && value.ok === false)
        : false;

    if (requiredFailures || animeFailures) {
        throw new Error('One or more REST checks failed.');
    }
};

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
