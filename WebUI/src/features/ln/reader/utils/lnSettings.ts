import { Settings } from '@/Manatan/types';

export interface LNReaderSettings {
    // Basic display
    lnFontSize: number;
    lnLineHeight: number;
    lnFontFamily: string;
    lnTheme: 'light' | 'sepia' | 'dark' | 'black';
    lnReadingDirection: 'horizontal' | 'vertical-rtl' | 'vertical-ltr';
    lnPaginationMode: 'scroll' | 'paginated' | 'single-page';
    lnPageWidth: number;
    lnPageMargin: number;
    lnEnableFurigana: boolean;
    lnTextAlign: 'left' | 'center' | 'justify';
    lnLetterSpacing: number;
    lnParagraphSpacing: number;
    
    // Additional display settings
    lnTextBrightness: number;
    lnFontWeight: number;
    lnSecondaryFontFamily: string;
    
    // Bookmark settings
    lnAutoBookmark: boolean;
    lnBookmarkDelay: number;
    lnLockProgressBar: boolean;
    
    // Navigation settings
    lnHideNavButtons: boolean;
    lnEnableSwipe: boolean;
    lnDragThreshold: number;
    
    // Click zones (paged mode)
    lnEnableClickZones: boolean;
    lnClickZoneSize: number;
    lnClickZonePlacement: 'vertical' | 'horizontal';
    lnClickZonePosition: 'full' | 'start' | 'center' | 'end';
    lnClickZoneCoverage: number;
    
    // Animations & extras
    lnDisableAnimations: boolean;
    lnShowCharProgress: boolean;
    
    // Yomitan integration
    enableYomitan: boolean;
    interactionMode: 'hover' | 'click';
}

const DEFAULT_LN_SETTINGS: LNReaderSettings = {
    // Basic display
    lnFontSize: 18,
    lnLineHeight: 1.8,
    lnFontFamily: '"Noto Serif JP", serif',
    lnTheme: 'dark',
    lnReadingDirection: 'vertical-rtl',
    lnPaginationMode: 'paginated',
    lnPageWidth: 800,
    lnPageMargin: 20,
    lnEnableFurigana: true,
    lnTextAlign: 'justify',
    lnLetterSpacing: 0,
    lnParagraphSpacing: 0,
    
    // Additional display settings
    lnTextBrightness: 100,
    lnFontWeight: 400,
    lnSecondaryFontFamily: '',
    
    // Bookmark settings
    lnAutoBookmark: true,
    lnBookmarkDelay: 5,
    lnLockProgressBar: false,
    
    // Navigation settings
    lnHideNavButtons: false,
    lnEnableSwipe: true,
    lnDragThreshold: 10,
    
    // Click zones (paged mode)
    lnEnableClickZones: true,
    lnClickZoneSize: 10,
    lnClickZonePlacement: 'vertical',
    lnClickZonePosition: 'full',
    lnClickZoneCoverage: 60,
    
    // Animations & extras
    lnDisableAnimations: false,
    lnShowCharProgress: false,
    
    // Yomitan integration
    enableYomitan: true,
    interactionMode: 'hover',
};

const STORAGE_KEY_PREFIX = 'ln_settings_';

function getStorageKey(language: string): string {
    // Normalize language: use 'default' for unknown/empty
    const normalized = (!language || language === 'unknown') ? 'default' : language.toLowerCase();
    return `${STORAGE_KEY_PREFIX}${normalized}`;
}

export function getLnSettings(language: string): LNReaderSettings {
    try {
        const key = getStorageKey(language);
        const saved = localStorage.getItem(key);
        if (saved) {
            const parsed = JSON.parse(saved);
            return { ...DEFAULT_LN_SETTINGS, ...parsed };
        }
    } catch (e) {
        console.warn('[LNSettings] Failed to load settings:', e);
    }
    return { ...DEFAULT_LN_SETTINGS };
}

export function saveLnSettings(settings: LNReaderSettings, language: string): void {
    try {
        const key = getStorageKey(language);
        localStorage.setItem(key, JSON.stringify(settings));
        console.log('[LNSettings] Saved to:', key);
    } catch (e) {
        console.error('[LNSettings] Failed to save settings:', e);
    }
}

export function getDefaultLnSettings(): LNReaderSettings {
    return { ...DEFAULT_LN_SETTINGS };
}

export function getLnSettingsAsFullSettings(lnSettings: LNReaderSettings): Partial<Settings> {
    return {
        // Basic display
        lnFontSize: lnSettings.lnFontSize,
        lnLineHeight: lnSettings.lnLineHeight,
        lnFontFamily: lnSettings.lnFontFamily,
        lnTheme: lnSettings.lnTheme,
        lnReadingDirection: lnSettings.lnReadingDirection,
        lnPaginationMode: lnSettings.lnPaginationMode,
        lnPageWidth: lnSettings.lnPageWidth,
        lnPageMargin: lnSettings.lnPageMargin,
        lnEnableFurigana: lnSettings.lnEnableFurigana,
        lnTextAlign: lnSettings.lnTextAlign,
        lnLetterSpacing: lnSettings.lnLetterSpacing,
        lnParagraphSpacing: lnSettings.lnParagraphSpacing,
        
        // Additional display
        lnTextBrightness: lnSettings.lnTextBrightness,
        lnFontWeight: lnSettings.lnFontWeight,
        lnSecondaryFontFamily: lnSettings.lnSecondaryFontFamily,
        
        // Bookmarks
        lnAutoBookmark: lnSettings.lnAutoBookmark,
        lnBookmarkDelay: lnSettings.lnBookmarkDelay,
        lnLockProgressBar: lnSettings.lnLockProgressBar,
        
        // Navigation
        lnHideNavButtons: lnSettings.lnHideNavButtons,
        lnEnableSwipe: lnSettings.lnEnableSwipe,
        lnDragThreshold: lnSettings.lnDragThreshold,
        
        // Click zones
        lnEnableClickZones: lnSettings.lnEnableClickZones,
        lnClickZoneSize: lnSettings.lnClickZoneSize,
        lnClickZonePlacement: lnSettings.lnClickZonePlacement,
        lnClickZonePosition: lnSettings.lnClickZonePosition,
        lnClickZoneCoverage: lnSettings.lnClickZoneCoverage,
        
        // Animations & extras
        lnDisableAnimations: lnSettings.lnDisableAnimations,
        lnShowCharProgress: lnSettings.lnShowCharProgress,
        
        // Yomitan
        enableYomitan: lnSettings.enableYomitan,
        interactionMode: lnSettings.interactionMode,
    };
}
