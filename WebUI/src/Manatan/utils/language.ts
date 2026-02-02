import type { YomitanLanguage } from '@/Manatan/types';

const NO_SPACE_LANGUAGES: YomitanLanguage[] = [
    'japanese',
    'chinese',
    'cantonese',
    'thai',
    'lao',
    'khmer',
];

export const isNoSpaceLanguage = (language?: YomitanLanguage): boolean =>
    NO_SPACE_LANGUAGES.includes(language || 'japanese');
