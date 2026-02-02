/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

type ChapterEntry = {
    id?: number;
    sourceOrder?: number;
    index?: number;
    name?: string;
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

const getBaseUrl = (): string => {
    const raw =
        process.env.MANATAN_BASE_URL ||
        process.env.VITE_SERVER_URL_DEFAULT ||
        'http://localhost:4567';
    return raw.replace(/\/+$/, '');
};

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

    const payload = (await response.json()) as { data?: T; errors?: { message: string }[] };
    if (payload.errors?.length) {
        throw new Error(`GraphQL error: ${payload.errors.map((error) => error.message).join('; ')}`);
    }

    if (!payload.data) {
        throw new Error('GraphQL response missing data');
    }

    return payload.data;
};

const main = async () => {
    const baseUrl = getBaseUrl();
    const allowGqlFallback = ['1', 'true', 'yes'].includes((process.env.ALLOW_GQL_FALLBACK || '').toLowerCase());

    const envMangaId = getEnvNumber('MANATAN_MANGA_ID');
    const envChapterIndex = getEnvNumber('MANATAN_CHAPTER_INDEX');
    const envChapterId = getEnvNumber('MANATAN_CHAPTER_ID');

    let mangaId = envMangaId;
    if (mangaId == null) {
        const mangaQuery =
            'query GetMangaForSmoke($first:Int){mangas(first:$first){nodes{id title}}}';
        const mangaData = await fetchGraphql<{
            mangas?: { nodes?: { id?: number; title?: string }[] };
        }>(baseUrl, mangaQuery, { first: 1 });
        mangaId = mangaData.mangas?.nodes?.[0]?.id;
        if (mangaId == null) {
            throw new Error('No manga found from GraphQL query. Set MANATAN_MANGA_ID to override.');
        }
    }

    const chaptersResponse = await fetchJson<ChapterEntry[] | { chapters?: ChapterEntry[] }>(
        `${baseUrl}/api/v1/manga/${mangaId}/chapters`,
    );
    const chapters = Array.isArray(chaptersResponse) ? chaptersResponse : chaptersResponse?.chapters ?? [];
    if (!chapters.length) {
        throw new Error(`No chapters found for manga ${mangaId}`);
    }

    let chapterIndex = envChapterIndex;
    let chapterId = envChapterId;

    const fallbackChapter =
        chapters.find((entry) => Number.isFinite(Number(entry.sourceOrder ?? entry.index))) ?? chapters[0];
    if (chapterIndex == null) {
        chapterIndex = Number(fallbackChapter.sourceOrder ?? fallbackChapter.index);
    }
    if (!Number.isFinite(Number(chapterIndex))) {
        throw new Error('Chapter index missing. Set MANATAN_CHAPTER_INDEX to override.');
    }

    if (chapterId == null) {
        chapterId = fallbackChapter.id;
    }

    let restPages: string[] = [];
    let restError: string | null = null;
    try {
        const restResponse = await fetchJson<string[] | { pages?: string[] }>(
            `${baseUrl}/api/v1/manga/${mangaId}/chapter/${chapterIndex}/pages`,
        );
        restPages = Array.isArray(restResponse) ? restResponse : restResponse?.pages ?? [];
    } catch (error) {
        restError = (error as Error).message;
    }

    let gqlPages: string[] = [];
    let gqlError: string | null = null;
    if (restError && chapterId != null) {
        try {
            const gqlMutation =
                'mutation GetChapterPages($input:FetchChapterPagesInput!){fetchChapterPages(input:$input){pages}}';
            const gqlData = await fetchGraphql<{
                fetchChapterPages?: { pages?: string[] } | null;
            }>(baseUrl, gqlMutation, { input: { chapterId } });
            gqlPages = gqlData.fetchChapterPages?.pages ?? [];
        } catch (error) {
            gqlError = (error as Error).message;
        }
    }

    const restProxyMatch = restPages.filter((page) => page.includes('/api/v1/media/image'));
    const restProxyStatus = restPages.length
        ? restProxyMatch.length === restPages.length
            ? 'all'
            : restProxyMatch.length
              ? 'partial'
              : 'none'
        : 'unknown';

    const result = {
        baseUrl,
        mangaId,
        chapterIndex,
        chapterId,
        rest: {
            ok: !restError,
            pageCount: restPages.length,
            firstPage: restPages[0] ?? null,
            mediaProxyStatus: restProxyStatus,
            error: restError,
        },
        graphqlFallback: {
            attempted: !!restError && chapterId != null,
            ok: !gqlError && gqlPages.length > 0,
            pageCount: gqlPages.length,
            firstPage: gqlPages[0] ?? null,
            error: gqlError,
        },
    };

    console.log(JSON.stringify(result, null, 2));

    if (!restError) {
        if (restPages.length && restProxyStatus !== 'all') {
            console.warn('REST pages did not all use /api/v1/media/image proxy.');
        }
        return;
    }

    if (result.graphqlFallback.ok && allowGqlFallback) {
        console.warn('REST pages failed; GraphQL fallback succeeded (ALLOW_GQL_FALLBACK enabled).');
        return;
    }

    throw new Error('REST pages request failed. See output for details.');
};

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
