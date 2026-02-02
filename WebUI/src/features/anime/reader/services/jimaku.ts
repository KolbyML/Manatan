export type JimakuEntry = {
    id: number;
    name: string;
    english_name?: string | null;
    japanese_name?: string | null;
    anilist_id?: number | null;
    flags?: {
        anime?: boolean;
        movie?: boolean;
    };
};

export type JimakuFileEntry = {
    url: string;
    name: string;
    size: number;
    last_modified: string;
};

type JimakuSearchOptions = {
    apiKey: string;
    query?: string | null;
    anilistId?: number | null;
};

type JimakuEpisodeOptions = {
    apiKey: string;
    title?: string | null;
    anilistId?: number | null;
    episodeNumber: number;
};

const JIMAKU_BASE_URL = 'https://jimaku.cc/api';

const buildHeaders = (apiKey: string) => ({
    Authorization: apiKey,
    Accept: 'application/json',
});

const buildUrl = (path: string, params?: Record<string, string>) => {
    const url = new URL(`${JIMAKU_BASE_URL}${path}`);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value) {
                url.searchParams.set(key, value);
            }
        });
    }
    return url.toString();
};

const normalizeTitle = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

const parseJapaneseEpisodeNumber = (name: string) => {
    const match = name.match(/第\s*(\d+)\s*話/);
    if (!match) {
        return null;
    }
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
};

const parseSeasonEpisodeNumber = (name: string) => {
    const match = name.match(/s\d{1,2}e(\d{1,3})/i);
    if (!match) {
        return null;
    }
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
};

const parseBracketEpisodeNumber = (name: string) => {
    const match = name.match(/[\[(]\s*(\d{1,3})(?:v\d+)?\s*[\])]/i);
    if (!match) {
        return null;
    }
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
};

const parseHyphenEpisodeNumber = (name: string) => {
    const match = name.match(/-\s*(\d{1,3})(?:v\d+)?\b/i);
    if (!match) {
        return null;
    }
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
};

const parseEpisodeTags = (name: string) => {
    const japanese = parseJapaneseEpisodeNumber(name);
    const seasonEpisode = parseSeasonEpisodeNumber(name);
    const bracketEpisode = parseBracketEpisodeNumber(name);
    const hyphenEpisode = parseHyphenEpisodeNumber(name);
    return {
        japanese,
        seasonEpisode,
        general: bracketEpisode ?? hyphenEpisode,
    };
};

const filterEpisodeMatches = (files: JimakuFileEntry[], episodeNumber: number) => {
    let hasJapanese = false;
    let hasSeason = false;
    let hasGeneral = false;
    const japaneseMatches: JimakuFileEntry[] = [];
    const seasonMatches: JimakuFileEntry[] = [];
    const generalMatches: JimakuFileEntry[] = [];

    files.forEach((file) => {
        const tags = parseEpisodeTags(file.name);
        if (tags.japanese !== null) {
            hasJapanese = true;
            if (tags.japanese === episodeNumber) {
                japaneseMatches.push(file);
            }
        }
        if (tags.seasonEpisode !== null) {
            hasSeason = true;
            if (tags.seasonEpisode === episodeNumber) {
                seasonMatches.push(file);
            }
        }
        if (tags.general !== null) {
            hasGeneral = true;
            if (tags.general === episodeNumber) {
                generalMatches.push(file);
            }
        }
    });

    if (hasJapanese) {
        return { matches: japaneseMatches, hasEpisodeTags: true };
    }
    if (hasSeason) {
        return { matches: seasonMatches, hasEpisodeTags: true };
    }
    if (hasGeneral) {
        return { matches: generalMatches, hasEpisodeTags: true };
    }
    return { matches: [], hasEpisodeTags: false };
};

const levenshteinDistance = (source: string, target: string) => {
    if (source === target) {
        return 0;
    }
    if (!source.length) {
        return target.length;
    }
    if (!target.length) {
        return source.length;
    }

    const matrix = Array.from({ length: source.length + 1 }, () => new Array(target.length + 1).fill(0));
    for (let i = 0; i <= source.length; i += 1) {
        matrix[i][0] = i;
    }
    for (let j = 0; j <= target.length; j += 1) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= source.length; i += 1) {
        for (let j = 1; j <= target.length; j += 1) {
            const cost = source[i - 1] === target[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost,
            );
        }
    }

    return matrix[source.length][target.length];
};

const similarityScore = (source: string, target: string) => {
    const normalizedSource = normalizeTitle(source);
    const normalizedTarget = normalizeTitle(target);
    if (!normalizedSource || !normalizedTarget) {
        return 0;
    }
    if (normalizedSource === normalizedTarget) {
        return 1.2;
    }

    const maxLength = Math.max(normalizedSource.length, normalizedTarget.length);
    const distance = levenshteinDistance(normalizedSource, normalizedTarget);
    const similarity = 1 - distance / maxLength;
    const substringBonus =
        normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource)
            ? 0.15
            : 0;

    return similarity + substringBonus;
};

const chooseEntryPool = (entries: JimakuEntry[]) => {
    if (!entries.length) {
        return [];
    }
    const animeNonMovie = entries.filter((entry) => entry.flags?.anime && !entry.flags?.movie);
    if (animeNonMovie.length) {
        return animeNonMovie;
    }
    const nonMovie = entries.filter((entry) => entry.flags?.movie === false);
    if (nonMovie.length) {
        return nonMovie;
    }
    const animeEntries = entries.filter((entry) => entry.flags?.anime);
    if (animeEntries.length) {
        return animeEntries;
    }
    return entries;
};

const pickBestEntry = (entries: JimakuEntry[], title?: string | null) => {
    if (!entries.length) {
        return null;
    }
    if (!title) {
        return entries[0];
    }

    let bestEntry: JimakuEntry | null = null;
    let bestScore = -1;

    entries.forEach((entry) => {
        const candidates = [entry.name, entry.english_name, entry.japanese_name].filter(
            (value): value is string => Boolean(value),
        );
        let score = 0;
        candidates.forEach((candidate) => {
            score = Math.max(score, similarityScore(candidate, title));
        });

        if (score > bestScore) {
            bestScore = score;
            bestEntry = entry;
        }
    });

    return bestEntry ?? entries[0];
};

const searchJimakuEntries = async ({ apiKey, query, anilistId }: JimakuSearchOptions) => {
    const url = buildUrl('/entries/search', {
        anime: 'true',
        query: query?.trim() || '',
        anilist_id: anilistId ? String(anilistId) : '',
    });

    const response = await fetch(url, { headers: buildHeaders(apiKey) });
    if (!response.ok) {
        throw new Error(`Jimaku search failed (${response.status})`);
    }
    return (await response.json()) as JimakuEntry[];
};

const fetchJimakuEpisodeFiles = async (apiKey: string, entryId: number, episodeNumber?: number) => {
    const params: Record<string, string> = {};
    if (episodeNumber !== undefined) {
        params.episode = String(Math.trunc(episodeNumber));
    }
    const url = buildUrl(`/entries/${entryId}/files`, params);
    const response = await fetch(url, { headers: buildHeaders(apiKey) });
    if (!response.ok) {
        throw new Error(`Jimaku files failed (${response.status})`);
    }
    return (await response.json()) as JimakuFileEntry[];
};

export const loadJimakuEpisodeFiles = async ({ apiKey, title, anilistId, episodeNumber }: JimakuEpisodeOptions) => {
    if (!apiKey) {
        return [];
    }
    const entries = await searchJimakuEntries({ apiKey, query: title, anilistId });
    let candidateEntries = entries;
    if (anilistId) {
        const matched = entries.filter((entry) => entry.anilist_id === anilistId);
        if (matched.length) {
            candidateEntries = matched;
        }
    }
    candidateEntries = chooseEntryPool(candidateEntries);
    const entry = pickBestEntry(candidateEntries, title);
    if (!entry) {
        return [];
    }
    const episodeFiles = await fetchJimakuEpisodeFiles(apiKey, entry.id, episodeNumber);
    const episodeMatch = filterEpisodeMatches(episodeFiles, episodeNumber);
    if (episodeMatch.matches.length) {
        return episodeMatch.matches;
    }

    const allFiles = await fetchJimakuEpisodeFiles(apiKey, entry.id);
    const allMatches = filterEpisodeMatches(allFiles, episodeNumber);
    if (allMatches.matches.length) {
        return allMatches.matches;
    }
    if (allMatches.hasEpisodeTags) {
        return [];
    }
    if (episodeFiles.length) {
        return episodeFiles;
    }
    return allFiles;
};
