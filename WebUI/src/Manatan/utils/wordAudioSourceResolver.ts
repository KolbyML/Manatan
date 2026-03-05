import type { WordAudioSource } from '@/Manatan/types';

export const resolveFirstAvailableWordAudioSource = async (
    sources: WordAudioSource[],
    resolveUrl: (source: WordAudioSource) => Promise<string | null>,
): Promise<{ source: WordAudioSource; url: string } | null> => {
    for (const source of sources) {
        const url = await resolveUrl(source);
        if (url) {
            return { source, url };
        }
    }
    return null;
};
