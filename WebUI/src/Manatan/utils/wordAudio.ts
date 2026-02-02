import type { DictionaryResult, WordAudioSource, WordAudioSourceSelection, YomitanLanguage } from '@/Manatan/types';
import { apiRequest } from '@/Manatan/utils/api';

const WORD_AUDIO_SOURCE_LABELS: Record<WordAudioSource, string> = {
    'jpod101': 'JapanesePod101',
    'language-pod-101': 'LanguagePod101',
    'jisho': 'Jisho',
    'lingua-libre': 'Lingua Libre',
    'wiktionary': 'Wiktionary',
};

const audioUrlCache = new Map<string, Promise<string | null>>();

let sharedAudio: HTMLAudioElement | null = null;
let clickAudioContext: AudioContext | null = null;

const getAudioUrlFromServer = async (
    source: WordAudioSource,
    term: string,
    reading: string,
    language?: YomitanLanguage,
): Promise<string | null> => {
    const params = new URLSearchParams({
        source,
        term,
        reading,
    });
    if (language) {
        params.set('language', language);
    }
    const response = await apiRequest<{ url?: string }>(`/api/yomitan/audio?${params.toString()}`);
    return response?.url ?? null;
};


const getAudioUrlForSource = async (
    source: WordAudioSource,
    term: string,
    reading: string,
    language?: YomitanLanguage,
): Promise<string | null> => {
    const cacheKey = `${source}|${language || 'japanese'}|${term}|${reading}`;
    const cached = audioUrlCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const promise = (async () => {
        try {
            switch (source) {
                case 'jpod101':
                case 'language-pod-101':
                case 'jisho':
                case 'lingua-libre':
                case 'wiktionary':
                    return getAudioUrlFromServer(source, term, reading, language);
                default:
                    return null;
            }
        } catch (error) {
            return null;
        }
    })();
    audioUrlCache.set(cacheKey, promise);
    return promise;
};

const getSharedAudio = (): HTMLAudioElement => {
    if (!sharedAudio) {
        sharedAudio = new Audio();
    }
    return sharedAudio;
};

export const playAudioFailClick = (): void => {
    if (typeof window === 'undefined') {
        return;
    }
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
        return;
    }
    if (!clickAudioContext) {
        clickAudioContext = new AudioContextClass();
    }
    const context = clickAudioContext;
    if (context.state === 'suspended') {
        context.resume().catch(() => undefined);
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 1000;
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.06);
};

const tryPlayAudioUrl = (url: string): Promise<boolean> =>
    new Promise((resolve) => {
        const audio = getSharedAudio();
        let settled = false;

        const cleanup = () => {
            audio.oncanplaythrough = null;
            audio.onerror = null;
        };

        audio.onerror = () => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            resolve(false);
        };

        audio.oncanplaythrough = () => {
            audio
                .play()
                .then(() => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    cleanup();
                    resolve(true);
                })
                .catch(() => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    cleanup();
                    resolve(false);
                });
        };

        audio.src = url;
        audio.load();
    });

export const getWordAudioSourceOptions = (language?: YomitanLanguage): WordAudioSource[] => {
    const resolved = language || 'japanese';
    return resolved === 'japanese'
        ? ['jpod101', 'language-pod-101', 'jisho']
        : ['lingua-libre', 'language-pod-101', 'wiktionary'];
};

export const getWordAudioSourceLabel = (source: WordAudioSource): string => WORD_AUDIO_SOURCE_LABELS[source];

export const resolveWordAudioUrl = async (
    entry: DictionaryResult,
    language: YomitanLanguage | undefined,
    selection: WordAudioSourceSelection = 'auto',
): Promise<{ source: WordAudioSource; url: string } | null> => {
    const term = entry.headword || '';
    const reading = entry.reading || '';
    const sources = selection === 'auto' ? getWordAudioSourceOptions(language) : [selection];
    for (const source of sources) {
        const url = await getAudioUrlForSource(source, term, reading, language);
        if (url) {
            return { source, url };
        }
    }
    return null;
};

export const playWordAudio = async (
    entry: DictionaryResult,
    language: YomitanLanguage | undefined,
    selection: WordAudioSourceSelection = 'auto',
): Promise<WordAudioSource | null> => {
    const term = entry.headword || '';
    const reading = entry.reading || '';
    const sources = selection === 'auto' ? getWordAudioSourceOptions(language) : [selection];
    for (const source of sources) {
        const url = await getAudioUrlForSource(source, term, reading, language);
        if (!url) {
            continue;
        }
        const played = await tryPlayAudioUrl(url);
        if (played) {
            return source;
        }
    }
    return null;
};

export const getWordAudioFilename = (url: string): string => {
    const cleaned = url.split('?')[0];
    const match = cleaned.match(/\.([a-z0-9]+)$/i);
    const extension = match ? match[1] : 'mp3';
    return `manatan_word_${Date.now()}.${extension}`;
};
