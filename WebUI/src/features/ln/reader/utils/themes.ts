
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

export const POPUP_THEMES = {
    light: { 
        bg: '#ffffff', 
        fg: '#1a1a1a', 
        border: '#ccc',
        secondary: '#666666',
        accent: '#9b59b6',
        hoverBg: '#f5f5f5',
    },
    dark: { 
        bg: '#1a1d21', 
        fg: '#eeeeee', 
        border: '#444444',
        secondary: '#aaaaaa',
        accent: '#9b59b6',
        hoverBg: '#2a2d31',
    },
} as const;

export type PopupThemeKey = keyof typeof POPUP_THEMES;
export type PopupTheme = typeof POPUP_THEMES[PopupThemeKey];

export function getPopupTheme(key: string | undefined): PopupTheme {
    const themeKey = (key || 'dark') as PopupThemeKey;
    return POPUP_THEMES[themeKey] || POPUP_THEMES.dark;
}