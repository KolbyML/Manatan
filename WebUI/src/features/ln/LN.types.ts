import { BlockIndexMap } from '@/features/novel/reader/types/block';

export interface BookStats {
    chapterLengths: number[];
    totalLength: number;
    blockMaps?: BlockIndexMap[];
}

export interface TocItem {
    label: string;
    href: string;
    chapterIndex: number;
}

export interface LNMetadata {
    id: string;
    title: string;
    author: string;
    cover?: string;
    addedAt: number;

    // Processing state
    isProcessing?: boolean;
    isError?: boolean;
    errorMsg?: string;

    // Pre-calculated on import
    stats: BookStats;
    chapterCount: number;
    toc: TocItem[];

    // For library display
    hasProgress?: boolean;

    // Language and categories
    language?: string;
    categoryIds: string[];

    // Settings per language (synced)
    languageSettings?: Record<string, LNReaderSettings>;
}

export interface LNReaderSettings {
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
    lnTextBrightness: number;
    lnFontWeight: number;
    lnSecondaryFontFamily: string;
    lnAutoBookmark: boolean;
    lnBookmarkDelay: number;
    lnLockProgressBar: boolean;
    lnHideNavButtons: boolean;
    lnEnableSwipe: boolean;
    lnDragThreshold: number;
    lnEnableClickZones: boolean;
    lnClickZoneSize: number;
    lnClickZonePlacement: 'vertical' | 'horizontal';
    lnClickZonePosition: 'full' | 'start' | 'center' | 'end';
    lnClickZoneCoverage: number;
    lnDisableAnimations: boolean;
    lnShowCharProgress: boolean;
    enableYomitan: boolean;
    interactionMode: 'hover' | 'click';
}

export interface LNProgress {
    // Current reading position (the bookmark)
    chapterIndex: number;
    pageNumber?: number;
    chapterCharOffset: number;
    totalCharsRead: number;
    sentenceText: string;
    chapterProgress: number;
    totalProgress: number;

    // Block tracking
    blockId?: string;
    blockLocalOffset?: number;
    contextSnippet?: string;

    // Sync metadata
    lastRead?: number;
    lastModified?: number;
    syncVersion?: number;
    deviceId?: string; // Track which device saved this

    // Highlights
    highlights?: LNHighlight[];
}

export interface LNHighlight {
    id: string;
    chapterIndex: number;
    blockId: string;
    text: string;
    startOffset: number;
    endOffset: number;
    createdAt: number;
}

export interface LNParsedBook {
    chapters: string[];
    imageBlobs: Record<string, Blob | string>;
    chapterFilenames: string[];
}

export interface LnCategory {
    id: string;
    name: string;
    order: number;
    createdAt: number;
    lastModified: number;
}

export interface LnCategoryMetadata {
    sortBy: string;
    sortDesc: boolean;
}
