
// ============================================================================
// Types matching Rust backend (camelCase for JSON serialization)
// ============================================================================

// LN Reader Settings for sync
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
    chapterIndex: number;
    pageNumber?: number;
    chapterCharOffset: number;
    totalCharsRead: number;
    sentenceText: string;
    chapterProgress: number;
    totalProgress: number;
    blockId?: string;
    blockLocalOffset?: number;
    contextSnippet?: string;
    lastRead?: number;
    lastModified?: number;
    syncVersion?: number;
    deviceId?: string;
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

export interface BlockIndexMap {
    blockId: string;
    startOffset: number;
    endOffset: number;
}

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
    isProcessing?: boolean;
    isError?: boolean;
    errorMsg?: string;
    stats: BookStats;
    chapterCount: number;
    toc: TocItem[];
    hasProgress?: boolean;
    lastModified?: number;
    syncVersion?: number;
    language?: string;
    categoryIds: string[];
    // Settings synced per language
    languageSettings?: Record<string, LNReaderSettings>;
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

export interface LNParsedBook {
    chapters: string[];
    imageBlobs: Record<string, string>;
    chapterFilenames: string[];
}

export interface FileReference {
    bookId: string;
    fileType: 'epub' | 'content';
    fileHash: string;
    fileSize: number;
    lastModified: number;
    driveFileId?: string;
}

export interface SyncPayload {
    schemaVersion: number;
    deviceId: string;
    lastModified: number;
    lnProgress: Record<string, LNProgress>;
    lnMetadata: Record<string, LNMetadata>;
    lnContent?: Record<string, LNParsedBook>;
    lnFiles?: Record<string, string>;
    lnCategories?: Record<string, LnCategory>;
    lnCategoryMetadata?: Record<string, LnCategoryMetadata>;
    deletedBookIds?: string[];
    deletedFileRefs?: FileReference[];
}

export type SyncBackendType = 'none' | 'googledrive' | 'webdav' | 'syncyomi';

export type GoogleDriveFolderType = 'public' | 'appData';

export type DeletionBehavior = 'keepEverywhere' | 'deleteEverywhere' | 'askEachTime';

export interface SyncConfig {
    ln_progress: boolean;
    ln_metadata: boolean;
    ln_content: boolean;
    ln_files: boolean;
    syncOnChapterRead: boolean;
    syncOnChapterOpen: boolean;
    syncOnAppStart: boolean;
    syncOnAppResume: boolean;
    backend: SyncBackendType;
    google_drive_folder: string;
    google_drive_folder_type: GoogleDriveFolderType;
    deletion_behavior: DeletionBehavior;
}

export interface AuthStatus {
    connected: boolean;
    backend: string;
    email?: string;
    last_sync?: number;
    device_id: string;
}

export interface AuthFlow {
    authUrl: string;
    state: string;
}

export interface MergeRequest {
    payload: SyncPayload;
    config?: SyncConfig;
}

export interface ConflictInfo {
    book_id: string;
    field: string;
    local_value: string;
    remote_value: string;
    resolution: string;
}

export interface MergeResponse {
    payload: SyncPayload;
    sync_timestamp: number;
    files_to_upload: string[];
    files_to_download: string[];
    conflicts: ConflictInfo[];
}

export interface PushResponse {
    success: boolean;
    etag: string;
    sync_timestamp: number;
}

// Frontend-only types
export interface SyncState {
    status: AuthStatus | null;
    config: SyncConfig | null;
    is_syncing: boolean;
    last_sync_time: Date | null;
    error: string | null;
    sync_progress: SyncProgress | null;
}

export interface SyncProgress {
    phase: 'collecting' | 'uploading' | 'merging' | 'applying';
    message: string;
    percent?: number;
}
