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
        const payload: SyncPayload = {
            schemaVersion: 1,
            deviceId: this.getDeviceId(),
            lastModified: Date.now(),
            lnProgress: {},
            lnMetadata: {},
        };

        // Collect progress
        if (config.lnProgress) {
            onProgress?.({ phase: 'collecting', message: 'Collecting reading progress...' });
            const progressKeys = await AppStorage.lnProgress.keys();
            for (const key of progressKeys) {
                const progress = await AppStorage.lnProgress.getItem<LNProgress>(key);
                if (progress) {
                    payload.lnProgress[key] = progress;
                }
            }
        }

        // Collect metadata
        if (config.lnMetadata) {
            onProgress?.({ phase: 'collecting', message: 'Collecting book metadata...' });
            const metadataKeys = await AppStorage.lnMetadata.keys();
            for (const key of metadataKeys) {
                const metadata = await AppStorage.lnMetadata.getItem<LNMetadata>(key);
                if (metadata) {
                    payload.lnMetadata[key] = metadata;
                }
            }
        }

        // Collect content (large!)
        if (config.lnContent) {
            onProgress?.({ phase: 'collecting', message: 'Collecting parsed content...' });
            payload.lnContent = {};
            const contentKeys = await AppStorage.lnContent.keys();
            
            for (let i = 0; i < contentKeys.length; i++) {
                const key = contentKeys[i];
                const content = await AppStorage.lnContent.getItem<LNParsedBook>(key);
                
                if (content) {
                    // Convert Blobs to base64
                    const imageBlobs: Record<string, string> = {};
                    for (const [imgKey, blob] of Object.entries(content.imageBlobs || {})) {
                        if (blob instanceof Blob) {
                            imageBlobs[imgKey] = await this.blobToBase64(blob);
                        } else {
                            imageBlobs[imgKey] = blob as string;
                        }
                    }
                    payload.lnContent[key] = {
                        ...content,
                        imageBlobs,
                    };
                }

                onProgress?.({
                    phase: 'collecting',
                    message: `Collecting content (${i + 1}/${contentKeys.length})...`,
                    percent: ((i + 1) / contentKeys.length) * 100,
                });
            }
        }

        // Collect files (very large!)
        if (config.lnFiles) {
            onProgress?.({ phase: 'collecting', message: 'Collecting EPUB files...' });
            payload.lnFiles = {};
            const fileKeys = await AppStorage.files.keys();

            for (let i = 0; i < fileKeys.length; i++) {
                const key = fileKeys[i];
                const file = await AppStorage.files.getItem<Blob>(key);
                
                if (file) {
                    payload.lnFiles[key] = await this.blobToBase64(file);
                }

                onProgress?.({
                    phase: 'collecting',
                    message: `Collecting files (${i + 1}/${fileKeys.length})...`,
                    percent: ((i + 1) / fileKeys.length) * 100,
                });
            }
        }

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
        // Get current config
        const config = await SyncApi.getConfig();

        // Collect local data
        onProgress?.({ phase: 'collecting', message: 'Collecting local data...' });
        const localPayload = await this.collectLocalData(config, onProgress);

        // Send to backend for merge
        onProgress?.({ phase: 'uploading', message: 'Syncing with cloud...' });
        const response = await SyncApi.merge({
            payload: localPayload,
            config,
        });

        // Apply merged data
        onProgress?.({ phase: 'applying', message: 'Applying changes...' });
        await this.applyMergedData(response.payload, config, onProgress);

        // Store last sync time
        this.setLastSyncTime(response.syncTimestamp);

        return response;
    }

    static async pullOnly(onProgress?: (progress: SyncProgress) => void): Promise<void> {
        const config = await SyncApi.getConfig();
        
        onProgress?.({ phase: 'merging', message: 'Downloading from cloud...' });
        const payload = await SyncApi.pull();
        
        if (payload) {
            onProgress?.({ phase: 'applying', message: 'Applying changes...' });
            await this.applyMergedData(payload, config, onProgress);
            this.setLastSyncTime(Date.now());
        }
    }

    static async pushOnly(onProgress?: (progress: SyncProgress) => void): Promise<void> {
        const config = await SyncApi.getConfig();
        
        onProgress?.({ phase: 'collecting', message: 'Collecting local data...' });
        const payload = await this.collectLocalData(config, onProgress);
        
        onProgress?.({ phase: 'uploading', message: 'Uploading to cloud...' });
        const response = await SyncApi.push(payload);
        
        this.setLastSyncTime(response.syncTimestamp);
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