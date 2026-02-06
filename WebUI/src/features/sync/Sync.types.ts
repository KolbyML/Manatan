
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
    fileManifest?: Record<string, FileReference>;
}

export type SyncBackendType = 'none' | 'googledrive' | 'webdav' | 'syncyomi';

export type GoogleDriveFolderType = 'public' | 'appData';

export type DeletionBehavior = 'keepEverywhere' | 'deleteEverywhere' | 'askEachTime';

export interface SyncConfig {
    lnProgress: boolean;
    lnMetadata: boolean;
    lnContent: boolean;
    lnFiles: boolean;
    syncOnChapterRead: boolean;
    syncOnChapterOpen: boolean;
    syncOnAppStart: boolean;
    syncOnAppResume: boolean;
    backend: SyncBackendType;
    googleDriveFolder: string;
    googleDriveFolderType: GoogleDriveFolderType;
    deletionBehavior: DeletionBehavior;
}

export interface AuthStatus {
    connected: boolean;
    backend: string;
    email?: string;
    lastSync?: number;
    deviceId: string;
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
    bookId: string;
    field: string;
    localValue: string;
    remoteValue: string;
    resolution: string;
}

export interface MergeResponse {
    payload: SyncPayload;
    syncTimestamp: number;
    filesToUpload: string[];
    filesToDownload: string[];
    conflicts: ConflictInfo[];
}

export interface PushResponse {
    success: boolean;
    etag: string;
    syncTimestamp: number;
}

// Frontend-only types
export interface SyncState {
    status: AuthStatus | null;
    config: SyncConfig | null;
    isSyncing: boolean;
    lastSyncTime: Date | null;
    error: string | null;
    syncProgress: SyncProgress | null;
}

export interface SyncProgress {
    phase: 'collecting' | 'uploading' | 'merging' | 'applying';
    message: string;
    percent?: number;
}