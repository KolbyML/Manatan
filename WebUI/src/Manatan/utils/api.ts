import { DictionaryResult, YomitanLanguage } from '../types';
import { isNoSpaceLanguage } from '@/Manatan/utils/language';

export type AuthCredentials = { user?: string; pass?: string };

export type ChapterStatus = 
    | { status: 'processed' }
    | { status: 'processing', progress: number, total: number }
    | { status: 'idle', cached: number, total: number };

export interface DictionaryMeta {
    id: number;
    name: string;
    priority: number;
    enabled: boolean;
}

export interface AppVersionInfo {
    version: string;
    variant: 'browser' | 'native-webview' | 'desktop' | 'ios' | 'unknown';
    update_status?: 'idle' | 'downloading' | 'ready';
}

const fetchChapterPages = async (mangaId: number, chapterIndex: number): Promise<string[] | undefined> => {
    const response = await fetch(`/api/v1/manga/${mangaId}/chapter/${chapterIndex}/pages`);
    const json = await response.json();
    return json?.pages as string[] | undefined;
};

export const buildChapterBaseUrl = (chapterPath: string): string =>
    `${window.location.origin}/api/v1${chapterPath}/page/`;

// --- SAFE API REQUEST WRAPPER ---
export const apiRequest = async <T>(
    url: string,
    options: { method?: string; body?: any; headers?: any } = {},
): Promise<T> => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    
    const response = await fetch(fullUrl, {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const toast = response.headers.get('x-manatan-toast');
    if (toast) {
        try {
            // Lazy import to avoid circular deps / bundle issues.
            const { makeToast } = await import('@/base/utils/Toast.ts');
            const variant = (response.headers.get('x-manatan-toast-variant') ?? 'info') as any;
            const description = response.headers.get('x-manatan-toast-description') ?? undefined;
            makeToast(toast, variant, description);
        } catch {
            // Ignore toast failures.
        }
    }

    const text = await response.text();
    
    // Check for HTTP errors
    if (!response.ok) {
        const errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
    }
    
    if (!text) return {} as T;

    try {
        return JSON.parse(text);
    } catch (e) {
        console.warn(`[API] Response from ${url} was not JSON:`, text.substring(0, 50));
        return {} as T; 
    }
};

// --- YOMITAN API ---

export const lookupYomitan = async (
    text: string, 
    index: number = 0, 
    groupingMode: 'grouped' | 'flat' = 'grouped',
    language?: YomitanLanguage
): Promise<DictionaryResult[] | 'loading'> => {
    try {
        // Convert dropdown value to backend boolean
        const groupParam = groupingMode === 'grouped';
        const languageParam = language ? `&language=${encodeURIComponent(language)}` : '';
        const url = `/api/yomitan/lookup?text=${encodeURIComponent(text)}&index=${index}&group=${groupParam}${languageParam}`;
        const res = await apiRequest<any>(url);
        
        if (res && res.error === 'loading') return 'loading';
        if (Array.isArray(res)) return res as DictionaryResult[];
        
        return [];
    } catch (e) {
        console.error("Lookup failed:", e);
        return [];
    }
};

export const getDictionaries = async (): Promise<DictionaryMeta[] | null> => {
    try {
        const res = await apiRequest<{ dictionaries: any[], status: string }>('/api/yomitan/dictionaries');
        if (res.status && res.status !== 'ready') {
            return null;
        }
        // Backend returns "dictionaries" array with {id: [number], name, priority, enabled}
        return res.dictionaries.map(d => ({
            id: d.id, // Rust DictionaryId is a tuple struct or plain integer based on serialization
            name: d.name,
            priority: d.priority,
            enabled: d.enabled
        }));
    } catch (e) {
        console.error("Failed to fetch dictionaries", e);
        return null;
    }
};
export const getFrequencyDictionaries = async (): Promise<string[]> => {
    try {
        const dicts = await getDictionaries();
        if (!dicts) {
            return [];
        }
        // Return all dictionary names (not just filtered ones)
        return dicts.map(d => d.name);
    } catch (e) {
        console.error('Failed to fetch dictionaries', e);
        return [];
    }
};

export const manageDictionary = async (action: 'Toggle' | 'Delete' | 'Reorder', payload: any) => {
    return apiRequest<{status: string}>('/api/yomitan/manage', {
        method: 'POST',
        body: { action, payload }
    });
};

// --- OCR / CHAPTER API ---

export const checkChapterStatus = async (
    baseUrl: string,
    creds?: AuthCredentials,
    language?: YomitanLanguage
): Promise<ChapterStatus> => {
    try {
        const body: any = { base_url: baseUrl, context: 'Check Status' };
        if (creds?.user) body.user = creds.user;
        if (creds?.pass) body.pass = creds.pass;
        if (language) body.language = language;

        const res = await apiRequest<any>('/api/ocr/is-chapter-preprocessed', {
            method: 'POST',
            body: body
        });
        
        const pickNumber = (value: any): number => {
            if (typeof value === 'number' && !Number.isNaN(value)) return value;
            if (typeof value === 'string') {
                const parsed = Number(value);
                if (!Number.isNaN(parsed)) return parsed;
            }
            return 0;
        };

        const cached = pickNumber(
            res.cached_count ?? res.cachedCount ?? res.cached ?? res.cached_pages ?? res.cachedPages,
        );
        const totalExpected = pickNumber(
            res.total_expected ?? res.totalExpected ?? res.total ?? res.total_pages ?? res.totalPages,
        );
        const progress = pickNumber(res.progress ?? res.processed ?? res.done ?? res.completed);
        const totalProgress = pickNumber(res.total ?? res.total_pages ?? res.totalPages ?? res.total_expected);

        if (res.status === 'processing') {
            return { 
                status: 'processing', 
                progress, 
                total: totalProgress 
            };
        }
        
        if (res.status === 'processed') {
            return { status: 'processed' };
        }
        
        return { 
            status: 'idle', 
            cached, 
            total: totalExpected 
        };
    } catch (e) {
        console.error("Failed to check chapter status", e);
        return { status: 'idle', cached: 0, total: 0 };
    }
};

export const checkChaptersStatus = async (
    baseUrls: string[],
    creds?: AuthCredentials,
    language?: YomitanLanguage
): Promise<Record<string, ChapterStatus>> => {
    try {
        const body: any = {
            chapters: baseUrls.map(baseUrl => ({ base_url: baseUrl })),
        };
        if (creds?.user) body.user = creds.user;
        if (creds?.pass) body.pass = creds.pass;
        if (language) body.language = language;

        const res = await apiRequest<Record<string, any>>('/api/ocr/is-chapters-preprocessed', {
            method: 'POST',
            body,
        });

        const pickNumber = (value: any): number => {
            if (typeof value === 'number' && !Number.isNaN(value)) return value;
            if (typeof value === 'string') {
                const parsed = Number(value);
                if (!Number.isNaN(parsed)) return parsed;
            }
            return 0;
        };

        const out: Record<string, ChapterStatus> = {};
        for (const baseUrl of baseUrls) {
            const item = res?.[baseUrl];
            if (!item) {
                out[baseUrl] = { status: 'idle', cached: 0, total: 0 };
                continue;
            }
            const cached = pickNumber(
                item.cached_count ?? item.cachedCount ?? item.cached ?? item.cached_pages ?? item.cachedPages,
            );
            const totalExpected = pickNumber(
                item.total_expected ?? item.totalExpected ?? item.total ?? item.total_pages ?? item.totalPages,
            );
            const progress = pickNumber(item.progress ?? item.processed ?? item.done ?? item.completed);
            const totalProgress = pickNumber(item.total ?? item.total_pages ?? item.totalPages ?? item.total_expected);

            if (item.status === 'processing') {
                out[baseUrl] = { status: 'processing', progress, total: totalProgress };
            } else if (item.status === 'processed') {
                out[baseUrl] = { status: 'processed' };
            } else {
                out[baseUrl] = { status: 'idle', cached, total: totalExpected };
            }
        }

        return out;
    } catch (e) {
        console.error('Failed to check chapters status', e);
        return Object.fromEntries(baseUrls.map((baseUrl) => [baseUrl, { status: 'idle', cached: 0, total: 0 }]));
    }
};

export const preprocessChapter = async (
    baseUrl: string,
    chapterPath: string,
    creds?: AuthCredentials,
    language?: YomitanLanguage
): Promise<void> => {
    const mangaMatch = chapterPath.match(/\/manga\/(\d+)/);
    const chapterMatch = chapterPath.match(/\/chapter\/([\d.]+)/);

    if (!mangaMatch || !chapterMatch) {
        throw new Error("Could not parse Manga ID or Chapter Number from path");
    }

    const mangaId = parseInt(mangaMatch[1], 10);
    const chapterNum = parseInt(chapterMatch[1], 10); 

    const pages = await fetchChapterPages(mangaId, chapterNum);

    if (!pages || pages.length === 0) throw new Error("No pages found via REST");

    const origin = window.location.origin;
    const absolutePages = pages.map(p => {
        if (p.startsWith('http')) return p;
        return `${origin}${p}`;
    });

    const body: any = {
        base_url: baseUrl,
        context: document.title,
        pages: absolutePages,
        add_space_on_merge: !isNoSpaceLanguage(language),
    };
    if (creds?.user) body.user = creds.user;
    if (creds?.pass) body.pass = creds.pass;
    if (language) body.language = language;

    await apiRequest('/api/ocr/preprocess-chapter', {
        method: 'POST',
        body: body
    });
};

export const deleteChapterOcr = async (
    baseUrl: string,
    creds?: AuthCredentials,
    language?: YomitanLanguage,
    deleteData: boolean = true,
): Promise<void> => {
    const body: any = {
        base_url: baseUrl,
        delete_data: deleteData,
        context: 'Delete Chapter OCR',
    };
    if (creds?.user) body.user = creds.user;
    if (creds?.pass) body.pass = creds.pass;
    if (language) body.language = language;

    await apiRequest('/api/ocr/delete-chapter', {
        method: 'POST',
        body,
    });
};

export const logDebug = (msg: string, isDebug: boolean) => {
    if (isDebug) console.log(`[OCR PC Hybrid] ${new Date().toLocaleTimeString()} ${msg}`);
};

export const cleanPunctuation = (text: string, preserveSpaces: boolean = false): string => {
    if (!text) return text;
    let t = text
        .replace(/[ ]*!!+/g, '‼')
        .replace(/[ ]*\?\?+/g, '⁇')
        .replace(/[ ]*\.\.+/g, '…')
        .replace(/[ ]*(!\?)+/g, '⁉')
        .replace(/[ ]*(\?!)+/g, '⁈')
        .replace(/[ ]*\u2026+/g, '…')
        .replace(/[ ]*\u30FB\u30FB+/g, '…')
        .replace(/[ ]*\uFF65\uFF65+/g, '…')
        .replace(/[ ]*-+/g, 'ー')
        .replace(/[ ]*\u2013+/g, '―')
        .replace(/[ ]*:+[ ]*/g, '…');

    t = t
        .replace(/^[!?:]+$/g, '')
        .replace(/([⁉⁈‼⁇])[!?:]+/g, '$1')
        .replace(/[!?:]+([⁉⁈‼⁇])/g, '$1');

    if (preserveSpaces) return t;
    return t.replace(/\u0020/g, '');
};

// --- SYSTEM API (Update & Versioning) ---

export const getAppVersion = async (): Promise<AppVersionInfo> => {
    try {
        const res = await apiRequest<{version: string, variant?: string, update_status?: string}>('/api/system/version');
        return {
            version: res.version || '0.0.0',
            variant: (res.variant as any) || 'unknown',
            update_status: (res.update_status as any) || 'idle' // <--- Essential mapping
        };
    } catch (e) {
        return { version: '0.0.0', variant: 'unknown', update_status: 'idle' };
    }
};

export const triggerAppUpdate = async (url: string, filename: string) => {
    return apiRequest('/api/system/download-update', {
        method: 'POST',
        body: { url, filename }
    });
};

export const installAppUpdate = async () => {
    return apiRequest('/api/system/install-update', { method: 'POST' });
};

const UPDATE_RELEASE_URLS = [
    'https://api.github.com/repos/KolbyML/Manatan/releases/latest',
    'https://api.github.com/repos/KolbyML/Mangatan/releases/latest',
];

const fetchLatestRelease = async () => {
    for (const url of UPDATE_RELEASE_URLS) {
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        if (json?.tag_name) return json;
    }

    return null;
};

export const checkForUpdates = async (currentVersion: string, variant: string) => {
    try {
        const json = await fetchLatestRelease();
        if (!json) return { hasUpdate: false };
        const latestTag = json.tag_name?.replace(/^v/, '');
        const current = currentVersion.replace(/^v/, '');
        
        if (latestTag && latestTag !== current) {
            let targetString = '';
            if (variant === 'native-webview') targetString = 'Android-NativeWebview';
            else if (variant === 'browser') targetString = 'Android-Browser';
            
            if (!targetString) return { hasUpdate: false };

            const asset = json.assets.find((a: any) => a.name.includes(targetString) && a.name.endsWith('.apk'));
            
            if (asset) {
                return { hasUpdate: true, version: latestTag, url: asset.browser_download_url, name: asset.name, releaseUrl: json.html_url };
            }
        }
        return { hasUpdate: false };
    } catch (e) { return { hasUpdate: false }; }
};
