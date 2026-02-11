
// ============================================================================
// Types matching Rust backend (camelCase for JSON serialization)
// ============================================================================

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
    sync_on_chapter_read: boolean;
    sync_on_chapter_open: boolean;
    sync_on_app_start: boolean;
    sync_on_app_resume: boolean;
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
