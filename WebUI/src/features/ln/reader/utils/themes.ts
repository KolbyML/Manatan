
export const READER_THEMES = {
    light: { bg: '#FFFFFF', fg: '#1a1a1a' },
    sepia: { bg: '#F4ECD8', fg: '#5C4B37' },
    dark: { bg: '#2B2B2B', fg: '#E0E0E0' },
    black: { bg: '#000000', fg: '#CCCCCC' },
} as const;

export type ThemeKey = keyof typeof READER_THEMES;
export type ReaderTheme = typeof READER_THEMES[ThemeKey];

export function getReaderTheme(key: string | undefined): ReaderTheme {
    const themeKey = (key || 'dark') as ThemeKey;
    return READER_THEMES[themeKey] || READER_THEMES.dark;
}