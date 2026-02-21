export interface Rect { x: number; y: number; width: number; height: number; rotation?: number; }
import { AnimeHotkey, DEFAULT_ANIME_HOTKEYS } from '@/Manatan/hotkeys/AnimeHotkeys.ts';
export interface OcrBlock {
    text: string;
    tightBoundingBox: Rect;
    forcedOrientation?: 'vertical' | 'horizontal';
    isMerged?: boolean;
}

export interface SiteConfig {
    imageContainerSelectors: string[];
    overflowFixSelector?: string;
    contentRootSelector?: string;
}

// Added 'dark' to the allowed types
export type ColorTheme = 'blue' | 'red' | 'green' | 'orange' | 'purple' | 'turquoise' | 'pink' | 'grey' | 'white' | 'dark';
export type YomitanLanguage =
    | 'japanese'
    | 'english'
    | 'chinese'
    | 'korean'
    | 'arabic'
    | 'spanish'
    | 'french'
    | 'german'
    | 'portuguese'
    | 'bulgarian'
    | 'czech'
    | 'danish'
    | 'greek'
    | 'estonian'
    | 'persian'
    | 'finnish'
    | 'hebrew'
    | 'hindi'
    | 'hungarian'
    | 'indonesian'
    | 'italian'
    | 'latin'
    | 'lao'
    | 'latvian'
    | 'georgian'
    | 'kannada'
    | 'khmer'
    | 'mongolian'
    | 'maltese'
    | 'dutch'
    | 'norwegian'
    | 'polish'
    | 'romanian'
    | 'russian'
    | 'swedish'
    | 'thai'
    | 'tagalog'
    | 'turkish'
    | 'ukrainian'
    | 'vietnamese'
    | 'welsh'
    | 'cantonese';

export type WordAudioSource =
    | 'jpod101'
    | 'language-pod-101'
    | 'jisho'
    | 'lingua-libre'
    | 'wiktionary';

export type WordAudioSourceSelection = WordAudioSource | 'auto';

export interface ServerSettingsData { authUsername?: string; authPassword?: string; }

export interface Settings {
    interactionMode: 'hover' | 'click';
    colorTheme: ColorTheme;
    dimmedOpacity: number;
    fontMultiplierHorizontal: number;
    fontMultiplierVertical: number;
    focusScaleMultiplier: number;
    boundingBoxAdjustment: number;
    subtitleFontSize: number;
    subtitleFontWeight: number;
    animePopupWidthUnit: 'percent' | 'px';
    animePopupHeightUnit: 'percent' | 'px';
    animePopupTopOffsetUnit: 'percent' | 'px';
    animePopupLeftOffsetUnit: 'percent' | 'px';
    animePopupWidthPercent: number;
    animePopupHeightPercent: number;
    animePopupTopOffsetPercent: number;
    animePopupLeftOffsetPercent: number;
    animePopupWidthPx: number;
    animePopupHeightPx: number;
    animePopupTopOffsetPx: number;
    animePopupLeftOffsetPx: number;
    animeSubtitleHoverLookup: boolean;
    animeSubtitleHoverAutoResume: boolean;
    animePopupCustomCss: string;
    animeHotkeys: Record<AnimeHotkey, string[]>;
    tapZonePercent: number;
    jimakuApiKey?: string;
    yomitanLanguage: YomitanLanguage;
    yomitanPopupWidthPx: number;
    yomitanPopupHeightPx: number;
    yomitanPopupScalePercent: number;
    yomitanPopupCustomCss: string;
    yomitanPopupTheme: 'dark' | 'light';
    animePopupTheme: 'dark' | 'light';
    yomitanShowPitchGraph: boolean;
    yomitanShowPitchText: boolean;
    yomitanShowPitchNotation: boolean;
    debugMode: boolean;
    mobileMode: boolean;
    soloHoverMode: boolean;
    enableOverlay: boolean;
    enableDoubleClickEdit: boolean;
    enableDoubleTapZoom: boolean;
    disableStatusIcon: boolean;
    autoPlayWordAudio: boolean;
    enableYomitan: boolean;
    deleteModifierKey: string;
    mergeModifierKey: string;
    site: SiteConfig;
    ankiConnectEnabled: boolean;
    ankiConnectUrl: string;
    ankiImageQuality: number;
    ankiEnableCropper: boolean;
    ankiDownscaleMaxWidth?: number;
    ankiDownscaleMaxHeight?: number;
    // New Anki Settings
    ankiDeck?: string;
    ankiModel?: string;
    ankiFieldMap?: Record<string, string>;
    ankiCheckDuplicates?: boolean;
    skipAnkiUpdateConfirm: boolean;
    showHarmonicMeanFreq: boolean;
    ankiFreqMode: string;
    // Light Novel Settings
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
    lnFontWeight: number;
    lnSecondaryFontFamily: string;
    lnTextBrightness: number;
    lnDisableAnimations: boolean;
    lnLockProgressBar?: boolean;
    lnShowCharProgress?: boolean;
     lnAutoBookmark?: boolean;         
    lnBookmarkDelay?: number;  
    // Navigation settings
    lnHideNavButtons?: boolean;
    lnEnableClickZones?: boolean;
    lnClickZoneSize?: number;
    lnClickZonePosition?: 'full' | 'start' | 'center' | 'end';
    lnClickZoneCoverage?: number;
    lnClickZonePlacement?: 'horizontal' | 'vertical';
    lnEnableSwipe?: boolean;   
    lnDragThreshold?: number;   
    // Dropdown setting for grouping behavior
    resultGroupingMode: 'grouped' | 'flat';
    yomitanLookupNavigationMode: 'tabs' | 'stacked';
    yomitanLookupMaxHistory: number;

}

export type MergeState = { imgSrc: string; index: number; } | null;

export type OcrStatus = 'idle' | 'loading' | 'success' | 'error';

// --- YOMITAN / DICTIONARY TYPES ---

export interface DictionaryResult {
    headword: string;
    reading: string;
    furigana?: string[][];
    glossary: DictionaryDefinition[];
    forms?: { headword: string; reading: string }[];
    source?: number;
    matchLen?: number;
    termTags?: Array<string | { name?: string; label?: string; tag?: string; value?: string }>;
    frequencies?: any[];
    pitchAccents?: Array<{
        dictionaryName: string;
        reading: string;
        pitches: Array<{
            position: number;
            pattern?: string;
            nasal?: number[];
            devoice?: number[];
            tags?: string[];
        }>;
    }>;
    ipa?: Array<{
        dictionaryName: string;
        reading: string;
        transcriptions: Array<{
            ipa: string;
            tags?: string[];
        }>;
    }>;
    styles?: Record<string, string>;
}

export interface DictionaryDefinition {
    dictionaryName: string;
    tags: string[];
    content: string[];
}

export interface DictPopupContext {
    imgSrc?: string;
    spreadData?: { leftSrc: string; rightSrc: string };
    sentence: string;
    source?: {
        kind: 'manga' | 'ln';
        bookId?: string;
        chapterIndex?: number;
    };
}

export interface DictPopupState {
    visible: boolean;
    x: number;
    y: number;
    results: DictionaryResult[];
    isLoading: boolean;
    systemLoading?: boolean;
    highlight?: {
        imgSrc?: string;
        index?: number;
        startChar: number;
        length: number;
        rects?: Rect[];
        source?: {
            kind: 'manga' | 'ln';
            bookId?: string;
            chapterIndex?: number;
        };
    };
    context?: DictPopupContext;
}

// --- GLOBAL DIALOG STATE ---
export interface DialogState {
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'progress';
    title?: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    extraAction?: {
        label: string;
        onClick: () => void;
        closeOnClick?: boolean;
    };
}

// --- ENVIRONMENT DETECTION ---
const isBrowser = typeof navigator !== 'undefined';
const ua = isBrowser ? navigator.userAgent : '';

const isAndroidNative = ua.includes('MangatanNative') || ua.includes('ManatanNative');
const isIOS = /iPhone|iPad|iPod/i.test(ua);

const ENABLE_YOMITAN_DEFAULT = isAndroidNative || isIOS;

export const DEFAULT_SETTINGS: Settings = {
    interactionMode: 'hover',
    colorTheme: 'white',
    // Removed brightnessMode default
    dimmedOpacity: 0.3,
    fontMultiplierHorizontal: 1.0,
    fontMultiplierVertical: 1.0,
    focusScaleMultiplier: 1.1,
    boundingBoxAdjustment: 5,
    subtitleFontSize: 22,
    subtitleFontWeight: 600,
    animePopupWidthUnit: 'percent',
    animePopupHeightUnit: 'percent',
    animePopupTopOffsetUnit: 'percent',
    animePopupLeftOffsetUnit: 'percent',
    animePopupWidthPercent: 100,
    animePopupHeightPercent: 50,
    animePopupTopOffsetPercent: 0,
    animePopupLeftOffsetPercent: 0,
    animePopupWidthPx: 960,
    animePopupHeightPx: 420,
    animePopupTopOffsetPx: 0,
    animePopupLeftOffsetPx: 0,
    animeSubtitleHoverLookup: true,
    animeSubtitleHoverAutoResume: false,
    animePopupCustomCss: '',
    animeHotkeys: DEFAULT_ANIME_HOTKEYS,
    tapZonePercent: 30,
    jimakuApiKey: '',
    yomitanLanguage: 'japanese',
    yomitanPopupWidthPx: 340,
    yomitanPopupHeightPx: 450,
    yomitanPopupScalePercent: 100,
    yomitanPopupCustomCss: '',
    yomitanPopupTheme: 'dark',
    animePopupTheme: 'dark',
    yomitanShowPitchGraph: false,
    yomitanShowPitchText: true,
    yomitanShowPitchNotation: true,
    debugMode: false,
    mobileMode: false,
    soloHoverMode: true,
    enableOverlay: true,
    enableDoubleClickEdit: false,
    enableDoubleTapZoom: false,
    disableStatusIcon: false,
    autoPlayWordAudio: false,
    enableYomitan: ENABLE_YOMITAN_DEFAULT,
    // Default to grouped
    resultGroupingMode: 'grouped',
    yomitanLookupNavigationMode: 'stacked',
    yomitanLookupMaxHistory: 10,
    deleteModifierKey: 'Alt',
    mergeModifierKey: 'Control',
    site: {
        imageContainerSelectors: [
            'div.muiltr-masn8', 'div.muiltr-79elbk', 'div.muiltr-u43rde',
            'div.muiltr-1r1or1s', 'div.muiltr-18sieki', 'div.muiltr-cns6dc',
            '.MuiBox-root.muiltr-1noqzsz', '.MuiBox-root.muiltr-1tapw32',
            'img[src*="/api/v1/manga/"]',
        ],
        overflowFixSelector: '.MuiBox-root.muiltr-13djdhf',
        contentRootSelector: '#root',
    },
    ankiConnectEnabled: false,
    ankiConnectUrl: 'http://127.0.0.1:8765',
    ankiImageQuality: 0.92,
    ankiEnableCropper: false,
    ankiDownscaleMaxWidth: undefined,
    ankiDownscaleMaxHeight: undefined,
    ankiDeck: '',
    ankiModel: '',
    ankiFieldMap: {},
    ankiCheckDuplicates: true,
    skipAnkiUpdateConfirm: false,
    showHarmonicMeanFreq: false,
    ankiFreqMode: 'lowest',
    // LN Defaults
    lnFontSize: 16,
    lnLineHeight: 1.6,
    lnFontFamily: "'Noto Serif JP', serif",
    lnTheme: 'light',
    lnReadingDirection: 'vertical-rtl',
    lnPaginationMode: 'paginated',
    lnPageWidth: 800,
    lnPageMargin: 40,
    lnEnableFurigana: true,
    lnTextAlign: 'justify',
    lnLetterSpacing: 0,
    lnParagraphSpacing: 1.5,
    lnFontWeight: 400,
    lnSecondaryFontFamily: '',
    lnTextBrightness: 100,
    lnDisableAnimations: true,
    lnLockProgressBar: false,
    lnShowCharProgress: false,
    lnAutoBookmark: true,
    lnBookmarkDelay: 15,
    // Navigation defaults
    lnHideNavButtons: false,
    lnEnableClickZones: true,
    lnClickZoneSize: 10,
    lnClickZonePosition: 'full',
    lnClickZoneCoverage: 60,
    lnClickZonePlacement: 'vertical',
    lnEnableSwipe: true,
    lnDragThreshold: 10,
};

export const COLOR_THEMES: Record<ColorTheme, { accent: string; background: string }> = {
    blue: { accent: '#4890ff', background: '#e5f3ff' },
    red: { accent: '#ff484b', background: '#ffe5e6' },
    green: { accent: '#227731', background: '#efffe5' },
    orange: { accent: '#f39c12', background: '#fff5e5' },
    purple: { accent: '#9b59b6', background: '#f5e5ff' },
    turquoise: { accent: '#1abc9c', background: '#e5fffa' },
    pink: { accent: '#ff4dde', background: '#ffe5ff' },
    grey: { accent: '#95a5a6', background: '#e5ecec' },
    white: { accent: '#333333', background: '#ffffff' },
    dark: { accent: '#555555', background: '#1a1d21' },
};
