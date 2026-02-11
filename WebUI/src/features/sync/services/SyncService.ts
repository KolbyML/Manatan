import { AppStorage, LNMetadata, LNProgress, LNParsedBook } from '@/lib/storage/AppStorage';
import { SyncApi } from './SyncApi';
import { SyncConfig, SyncPayload, MergeResponse, SyncProgress } from '../Sync.types';

const DEVICE_ID_KEY = 'manatan_device_id';
const LAST_SYNC_KEY = 'manatan_last_sync';

export class SyncService {
    private static deviceId: string | null = null;

    // ========================================================================
    // Device ID
    // ========================================================================

    static getDeviceId(): string {
        if (this.deviceId) return this.deviceId;

        let deviceId = localStorage.getItem(DEVICE_ID_KEY);

        if (!deviceId) {
            deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem(DEVICE_ID_KEY, deviceId);
        }

        this.deviceId = deviceId;
        return deviceId;
    }

    // ========================================================================
    // Last Sync Time
    // ========================================================================

    static getLastSyncTime(): Date | null {
        const stored = localStorage.getItem(LAST_SYNC_KEY);
        return stored ? new Date(parseInt(stored, 10)) : null;
    }

    static setLastSyncTime(timestamp: number): void {
        localStorage.setItem(LAST_SYNC_KEY, timestamp.toString());
    }

    // ========================================================================
    // Collect Local Data
    // ========================================================================

    static async collectLocalData(
        config: SyncConfig,
        onProgress?: (progress: SyncProgress) => void,
    ): Promise<SyncPayload> {
        console.log('[SYNC] ===== COLLECTING LOCAL DATA =====');
        console.log('[SYNC] Config: progress=%s, metadata=%s, content=%s, files=%s',
            config.lnProgress, config.lnMetadata, config.lnContent, config.lnFiles);

        const payload: SyncPayload = {
            schemaVersion: 1,
            deviceId: this.getDeviceId(),
            lastModified: Date.now(),
            lnProgress: {},
            lnMetadata: {},
            lnContent: {},
            lnFiles: {},
        };

        // Collect progress
        if (config.lnProgress) {
            const progressMsg = 'Collecting reading progress...';
            console.log('[SYNC] ' + progressMsg);
            onProgress?.({ phase: 'collecting', message: progressMsg });
            const progressKeys = await AppStorage.lnProgress.keys();
            console.log('[SYNC] Found %d progress entries', progressKeys.length);
            for (const key of progressKeys) {
                let progress = await AppStorage.lnProgress.getItem<any>(key);
                if (progress) {
                    // Apply progress migration if needed
                    if (progress.chapter_index !== undefined) {
                        // Old snake_case format - migrate to camelCase
                        progress = {
                            chapterIndex: progress.chapter_index,
                            pageNumber: progress.page_number,
                            chapterCharOffset: progress.chapter_char_offset,
                            totalCharsRead: progress.total_chars_read,
                            sentenceText: progress.sentence_text,
                            chapterProgress: progress.chapter_progress,
                            totalProgress: progress.total_progress,
                            blockId: progress.block_id,
                            blockLocalOffset: progress.block_local_offset,
                            contextSnippet: progress.context_snippet,
                            lastRead: progress.last_read,
                            lastModified: progress.last_modified,
                            syncVersion: progress.sync_version,
                            deviceId: progress.device_id,
                        };
                        // Save migrated data back to storage
                        await AppStorage.lnProgress.setItem(key, progress);
                    }
                    
                    payload.lnProgress[key] = progress;
                }
            }
            console.log('[SYNC] Collected %d progress entries', Object.keys(payload.lnProgress).length);
        }

        // Collect metadata
        if (config.lnMetadata) {
            const metadataMsg = 'Collecting book metadata...';
            console.log('[SYNC] ' + metadataMsg);
            onProgress?.({ phase: 'collecting', message: metadataMsg });
            const metadataKeys = await AppStorage.lnMetadata.keys();
            console.log('[SYNC] Found %d metadata entries', metadataKeys.length);
            for (const key of metadataKeys) {
                let metadata = await AppStorage.lnMetadata.getItem<any>(key);
                if (metadata) {
                    let needsMigration = false;
                    
                    // Check if migration is needed (snake_case format OR wrong blockMaps format)
                    const hasSnakeCase = metadata.added_at !== undefined || 
                        metadata.is_processing !== undefined || 
                        metadata.stats?.chapter_lengths !== undefined;
                    
                    // Check if blockMaps is in old reader format (nested blocks array)
                    const blockMaps = metadata.stats?.block_maps || metadata.stats?.blockMaps || [];
                    const hasReaderFormatBlocks = blockMaps.length > 0 && blockMaps[0]?.blocks !== undefined;
                    
                    if (hasSnakeCase || hasReaderFormatBlocks) {
                        needsMigration = true;
                        
                        // Migrate to camelCase and fix blockMaps format
                        metadata = {
                            id: metadata.id,
                            title: metadata.title,
                            author: metadata.author,
                            cover: metadata.cover,
                            addedAt: metadata.added_at || metadata.addedAt,
                            isProcessing: metadata.is_processing || metadata.isProcessing,
                            isError: metadata.is_error || metadata.isError,
                            errorMsg: metadata.error_msg || metadata.errorMsg,
                            stats: {
                                chapterLengths: metadata.stats?.chapter_lengths || metadata.stats?.chapterLengths || [],
                                totalLength: metadata.stats?.total_length || metadata.stats?.totalLength || 0,
                                blockMaps: (() => {
                                    const blockMaps = metadata.stats?.block_maps || metadata.stats?.blockMaps || [];
                                    
                                    // Check if it's reader-format (nested blocks array)
                                    if (blockMaps.length > 0 && blockMaps[0]?.blocks !== undefined) {
                                        // Convert reader-format to sync-format (flat)
                                        return blockMaps.flatMap((chapter: any) => {
                                            if (!chapter.blocks || !Array.isArray(chapter.blocks)) return [];
                                            return chapter.blocks.map((block: any) => ({
                                                blockId: block.id || `ch${chapter.chapterIndex}-b${block.order || 0}`,
                                                startOffset: block.order || 0,
                                                endOffset: (block.order || 0) + (block.cleanCharCount || 0),
                                            }));
                                        });
                                    }
                                    
                                    // Already in sync-format or empty
                                    return blockMaps
                                        .filter((block: any) => block && (block.blockId !== undefined || block.block_id !== undefined))
                                        .map((block: any) => ({
                                            blockId: block.blockId || block.block_id || `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                            startOffset: block.startOffset || block.start_offset || 0,
                                            endOffset: block.endOffset || block.end_offset || 0,
                                        }));
                                })(),
                            },
                            chapterCount: metadata.chapter_count || metadata.chapterCount,
                            toc: (metadata.toc || []).map((toc: any) => ({
                                label: toc.label,
                                href: toc.href,
                                chapterIndex: toc.chapter_index || toc.chapterIndex,
                            })),
                            hasProgress: metadata.has_progress || metadata.hasProgress,
                            lastModified: metadata.last_modified || metadata.lastModified,
                            syncVersion: metadata.sync_version || metadata.syncVersion,
                        };
                        
                        // Save migrated data back to storage
                        await AppStorage.lnMetadata.setItem(key, metadata);
                    }
                    
                    payload.lnMetadata[key] = metadata;
                }
            }
            console.log('[SYNC] Collected %d metadata entries', Object.keys(payload.lnMetadata).length);
        }

        // Collect content (large!)
        if (config.lnContent) {
            const contentMsg = 'Collecting parsed content...';
            console.log('[SYNC] ' + contentMsg);
            onProgress?.({ phase: 'collecting', message: contentMsg });
            payload.lnContent = {};
            const contentKeys = await AppStorage.lnContent.keys();
            console.log('[SYNC] Found %d content entries', contentKeys.length);
            
            for (let i = 0; i < contentKeys.length; i++) {
                const key = contentKeys[i];
                let content = await AppStorage.lnContent.getItem<any>(key);
                
                if (content) {
                    let needsMigration = false;
                    
                    // Check if migration is needed (snake_case format)
                    if ((content as any).image_blobs !== undefined || (content as any).chapter_filenames !== undefined) {
                        needsMigration = true;
                        
                        // Migrate to camelCase
                        content = {
                            chapters: content.chapters || (content as any).chapters || [],
                            imageBlobs: (content as any).image_blobs || content.imageBlobs || {},
                            chapterFilenames: (content as any).chapter_filenames || content.chapterFilenames || [],
                        };
                        
                        // Save migrated data back to storage
                        await AppStorage.lnContent.setItem(key, content);
                    }
                    
                    // Convert Blobs to base64
                    const imageBlobs: Record<string, string> = {};
                    const storedImageBlobs = content.imageBlobs || {};
                    for (const [imgKey, blob] of Object.entries(storedImageBlobs)) {
                        if (blob instanceof Blob) {
                            imageBlobs[imgKey] = await this.blobToBase64(blob);
                        } else {
                            imageBlobs[imgKey] = blob as string;
                        }
                    }
                    
                    payload.lnContent[key] = {
                        chapters: content.chapters || [],
                        imageBlobs,
                        chapterFilenames: content.chapterFilenames || [],
                    };
                }

                const progressPercent = ((i + 1) / contentKeys.length) * 100;
                onProgress?.({
                    phase: 'collecting',
                    message: `Collecting content (${i + 1}/${contentKeys.length})...`,
                    percent: progressPercent,
                });
            }
            console.log('[SYNC] Collected %d content entries', Object.keys(payload.lnContent || {}).length);
        }

        // Collect files (very large!)
        if (config.lnFiles) {
            const filesMsg = 'Collecting EPUB files...';
            console.log('[SYNC] ' + filesMsg);
            onProgress?.({ phase: 'collecting', message: filesMsg });
            payload.lnFiles = {};
            const fileKeys = await AppStorage.files.keys();
            console.log('[SYNC] Found %d files', fileKeys.length);

            for (let i = 0; i < fileKeys.length; i++) {
                const key = fileKeys[i];
                const file = await AppStorage.files.getItem<Blob>(key);
                
                if (file) {
                    payload.lnFiles[key] = await this.blobToBase64(file);
                }

                const progressPercent = ((i + 1) / fileKeys.length) * 100;
                onProgress?.({
                    phase: 'collecting',
                    message: `Collecting files (${i + 1}/${fileKeys.length})...`,
                    percent: progressPercent,
                });
            }
            console.log('[SYNC] Collected %d files', Object.keys(payload.lnFiles || {}).length);
        }

        console.log('[SYNC] ===== LOCAL DATA COLLECTION COMPLETE =====');
        console.log('[SYNC] Summary: %d progress, %d metadata, %d content, %d files',
            Object.keys(payload.lnProgress).length,
            Object.keys(payload.lnMetadata).length,
            Object.keys(payload.lnContent || {}).length,
            Object.keys(payload.lnFiles || {}).length);

        return payload;
    }

    // ========================================================================
    // Apply Merged Data
    // ========================================================================

    static async applyMergedData(
        payload: SyncPayload,
        config: SyncConfig,
        onProgress?: (progress: SyncProgress) => void,
    ): Promise<void> {
        // Apply progress
        if (config.lnProgress) {
            onProgress?.({ phase: 'applying', message: 'Applying reading progress...' });
            const entries = Object.entries(payload.lnProgress);
            
            for (let i = 0; i < entries.length; i++) {
                const [bookId, progress] = entries[i];
                await AppStorage.lnProgress.setItem(bookId, progress);
                
                onProgress?.({
                    phase: 'applying',
                    message: `Applying progress (${i + 1}/${entries.length})...`,
                    percent: ((i + 1) / entries.length) * 100,
                });
            }
        }

        // Apply metadata
        if (config.lnMetadata) {
            onProgress?.({ phase: 'applying', message: 'Applying book metadata...' });
            const entries = Object.entries(payload.lnMetadata);
            
            for (let i = 0; i < entries.length; i++) {
                const [bookId, metadata] = entries[i];
                await AppStorage.lnMetadata.setItem(bookId, metadata);
            }
        }

        // Apply content
        if (config.lnContent && payload.lnContent) {
            onProgress?.({ phase: 'applying', message: 'Applying parsed content...' });
            const entries = Object.entries(payload.lnContent);
            
            for (let i = 0; i < entries.length; i++) {
                const [bookId, content] = entries[i];
                
                // Convert base64 back to Blobs
                const imageBlobs: Record<string, Blob> = {};
                for (const [imgKey, base64] of Object.entries(content.imageBlobs || {})) {
                    imageBlobs[imgKey] = this.base64ToBlob(base64);
                }
                
                await AppStorage.lnContent.setItem(bookId, {
                    ...content,
                    imageBlobs,
                });

                onProgress?.({
                    phase: 'applying',
                    message: `Applying content (${i + 1}/${entries.length})...`,
                    percent: ((i + 1) / entries.length) * 100,
                });
            }
        }

        // Apply files
        if (config.lnFiles && payload.lnFiles) {
            onProgress?.({ phase: 'applying', message: 'Applying EPUB files...' });
            const entries = Object.entries(payload.lnFiles);
            
            for (let i = 0; i < entries.length; i++) {
                const [bookId, base64] = entries[i];
                const blob = this.base64ToBlob(base64, 'application/epub+zip');
                await AppStorage.files.setItem(bookId, blob);

                onProgress?.({
                    phase: 'applying',
                    message: `Applying files (${i + 1}/${entries.length})...`,
                    percent: ((i + 1) / entries.length) * 100,
                });
            }
        }
    }

    // ========================================================================
    // Main Sync Operations
    // ========================================================================

    static async sync(onProgress?: (progress: SyncProgress) => void): Promise<MergeResponse> {
        console.log('[SYNC] ===== STARTING FULL SYNC =====');

        // Get current config
        const config = await SyncApi.getConfig();
        console.log('[SYNC] Config loaded');

        // Collect local data
        const collectingMsg = 'Collecting local data...';
        console.log('[SYNC] ' + collectingMsg);
        onProgress?.({ phase: 'collecting', message: collectingMsg });
        const localPayload = await this.collectLocalData(config, onProgress);

        // Send to backend for merge
        const uploadingMsg = 'Syncing with cloud...';
        console.log('[SYNC] ' + uploadingMsg);
        onProgress?.({ phase: 'uploading', message: uploadingMsg });
        const response = await SyncApi.merge({
            payload: localPayload,
            config,
        });

        console.log('[SYNC] Merge response received:');
        console.log('  - Timestamp: %d', response.syncTimestamp);
        console.log('  - Conflicts: %d', response.conflicts.length);
        console.log('  - Files to upload: %d', response.filesToUpload.length);
        console.log('  - Files to download: %d', response.filesToDownload.length);

        // Apply merged data
        const applyingMsg = 'Applying changes...';
        console.log('[SYNC] ' + applyingMsg);
        onProgress?.({ phase: 'applying', message: applyingMsg });
        await this.applyMergedData(response.payload, config, onProgress);

        // Store last sync time (both in localStorage and return the value for context)
        this.setLastSyncTime(response.syncTimestamp);
        console.log('[SYNC] Last sync time set to:', new Date(response.syncTimestamp));

        console.log('[SYNC] ===== SYNC COMPLETE =====');
        return response;
    }

    static async pullOnly(onProgress?: (progress: SyncProgress) => void): Promise<void> {
        console.log('[SYNC] ===== STARTING PULL ONLY =====');

        const config = await SyncApi.getConfig();
        console.log('[SYNC] Config loaded');
        
        const downloadingMsg = 'Downloading from cloud...';
        console.log('[SYNC] ' + downloadingMsg);
        onProgress?.({ phase: 'merging', message: downloadingMsg });
        const payload = await SyncApi.pull();
        
        if (payload) {
            const applyingMsg = 'Applying changes...';
            console.log('[SYNC] ' + applyingMsg);
            onProgress?.({ phase: 'applying', message: applyingMsg });
            await this.applyMergedData(payload, config, onProgress);
            this.setLastSyncTime(Date.now());
            console.log('[SYNC] ===== PULL COMPLETE =====');
        } else {
            console.log('[SYNC] No remote data to pull');
            console.log('[SYNC] ===== PULL COMPLETE (NO DATA) =====');
        }
    }

    static async pushOnly(onProgress?: (progress: SyncProgress) => void): Promise<void> {
        console.log('[SYNC] ===== STARTING PUSH ONLY =====');

        const config = await SyncApi.getConfig();
        console.log('[SYNC] Config loaded');
        
        const collectingMsg = 'Collecting local data...';
        console.log('[SYNC] ' + collectingMsg);
        onProgress?.({ phase: 'collecting', message: collectingMsg });
        const payload = await this.collectLocalData(config, onProgress);
        
        const uploadingMsg = 'Uploading to cloud...';
        console.log('[SYNC] ' + uploadingMsg);
        onProgress?.({ phase: 'uploading', message: uploadingMsg });
        const response = await SyncApi.push(payload);
        
        this.setLastSyncTime(response.syncTimestamp);
        console.log('[SYNC] Push complete! Timestamp: %d', response.syncTimestamp);
        console.log('[SYNC] ===== PUSH COMPLETE =====');
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    static async isAvailable(): Promise<boolean> {
        try {
            const status = await SyncApi.getStatus();
            return status.connected;
        } catch {
            return false;
        }
    }

    private static async blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                const base64Data = base64.split(',')[1] || base64;
                resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    private static base64ToBlob(base64: string, mimeType = 'application/octet-stream'): Blob {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }
}