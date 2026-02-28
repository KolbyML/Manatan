/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { jsonSaveParse } from '@/lib/HelperFunctions.ts';
import localforage from 'localforage';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { HttpMethod } from '@/lib/requests/client/RestClient.ts';
import { LNMetadata, LNProgress, LNParsedBook, LnCategory, LnCategoryMetadata } from '@/features/novel/LN.types';

type StorageBackend = typeof window.localStorage | null;

export class Storage {
    private readonly memory = new Map<string, string>();

    constructor(private readonly storage: StorageBackend) {}

    parseValue<T>(value: string | null, defaultValue: T): T {
        if (value === null) {
            return defaultValue;
        }

        const parsedValue = jsonSaveParse(value);

        if (value === 'null' || value === 'undefined') {
            return parsedValue;
        }

        return parsedValue ?? (value as T);
    }

    getItem(key: string): string | null {
        if (!this.storage) {
            return this.memory.get(key) ?? null;
        }

        try {
            return this.storage.getItem(key);
        } catch {
            return this.memory.get(key) ?? null;
        }
    }

    getItemParsed<T>(key: string, defaultValue: T): T {
        return this.parseValue(this.getItem(key), defaultValue);
    }

    setItem(key: string, value: unknown, emitEvent: boolean = true): void {
        const currentValue = this.getItem(key);

        const fireEvent = (valueToStore: string | undefined) => {
            if (!emitEvent) {
                return;
            }

            window.dispatchEvent(
                new StorageEvent('storage', {
                    key,
                    oldValue: currentValue,
                    newValue: valueToStore,
                }),
            );
        };

        if (value === undefined) {
            if (this.storage) {
                try {
                    this.storage.removeItem(key);
                } catch {
                    this.memory.delete(key);
                }
            } else {
                this.memory.delete(key);
            }
            fireEvent(undefined);
            return;
        }

        const stringify = typeof value !== 'string';
        const valueToStore = stringify ? JSON.stringify(value) : value;

        if (this.storage) {
            try {
                this.storage.setItem(key, valueToStore);
            } catch {
                this.memory.set(key, valueToStore);
            }
        } else {
            this.memory.set(key, valueToStore);
        }
        fireEvent(valueToStore as string);
    }

    setItemIfMissing(key: string, value: unknown, emitEvent?: boolean): void {
        if (this.getItem(key) === null) {
            this.setItem(key, value, emitEvent);
        }
    }
}

// ============================================================================
// Types
// ============================================================================

export * from '@/features/novel/LN.types';

// ============================================================================
// Device ID Helper
// ============================================================================

function getDeviceId(): string {
    const key = 'manatan_device_id';
    let deviceId = localStorage.getItem(key);

    if (!deviceId) {
        deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(key, deviceId);
    }

    return deviceId;
}

// ============================================================================
// Server-backed Storage Implementation
// ============================================================================

class ServerStorage<T> {
    private memCache = new Map<string, T>();

    constructor(
        private readonly endpoint: string,
        private readonly storeName: string,
    ) {}

    async getItem<R = T>(key: string): Promise<R | null> {
        if (this.memCache.has(key)) {
            return this.memCache.get(key) as unknown as R;
        }

        // Check localStorage mirror for instant UI
        if (this.storeName === 'novel_metadata_list') {
            const cached = localStorage.getItem('manatan_novel_metadata_list');
            if (cached) {
                return JSON.parse(cached) as unknown as R;
            }
        }

        return await this.fetchFromServer<R>(key);
    }

    private async fetchFromServer<R = T>(key: string): Promise<R | null> {
        try {
            const response = await requestManager.getClient().fetcher(`${this.endpoint}/${key}`);
            if (response.status === 404) return null;
            const data = await response.json();

            this.memCache.set(key, data);
            return data as R;
        } catch (e) {
            console.error(`[AppStorage] Failed to get item ${key} from ${this.storeName}:`, e);
            return null;
        }
    }

    async setItem(key: string, value: T): Promise<T> {
        try {
            await requestManager.getClient().fetcher(`${this.endpoint}/${key}`, {
                httpMethod: HttpMethod.POST,
                data: this.wrapPayload(value),
            });
            this.memCache.set(key, value);
            return value;
        } catch (e) {
            console.error(`[AppStorage] Failed to set item ${key} in ${this.storeName}:`, e);
            throw e;
        }
    }

    async removeItem(key: string): Promise<void> {
        try {
            await requestManager.getClient().fetcher(`${this.endpoint}/${key}`, {
                httpMethod: HttpMethod.DELETE,
            });
            this.memCache.delete(key);
        } catch (e) {
            console.error(`[AppStorage] Failed to remove item ${key} from ${this.storeName}:`, e);
            throw e;
        }
    }

    async keys(): Promise<string[]> {
        if (this.storeName === 'novel_metadata') {
            const response = await requestManager.getClient().fetcher(this.endpoint);
            const data = await response.json() as LNMetadata[];
            return data.map(m => m.id);
        }
        return Array.from(this.memCache.keys());
    }

    private wrapPayload(value: any) {
        if (this.storeName === 'novel_metadata') return { metadata: value };
        if (this.storeName === 'novel_progress') return { progress: value };
        if (this.storeName === 'novel_categories') return value;
        if (this.storeName === 'novel_category_metadata') return value;
        return value;
    }
}

// ============================================================================
// AppStorage Class
// ============================================================================

export class AppStorage {
    static readonly local = new Storage(AppStorage.getSafeStorage(() => window.localStorage));
    static readonly session = new Storage(AppStorage.getSafeStorage(() => window.sessionStorage));

    // Raw EPUB files
    static readonly files = {
        async setItem(key: string, file: File | Blob): Promise<void> {
            const formData = new FormData();
            formData.append('file', file);
            await requestManager.getClient().fetcher(`/api/novel/upload/${key}`, {
                httpMethod: HttpMethod.POST,
                data: formData,
            });
        },
        async getItem(key: string): Promise<Blob | null> {
            try {
                const response = await requestManager.getClient().fetcher(`/api/novel/file/${key}`, {
                    checkResponseIsJson: false
                });
                if (response.status === 404) return null;
                return await response.blob();
            } catch (e) {
                return null;
            }
        },
        async removeItem(key: string): Promise<void> {}
    };

    // Book metadata with stats
    static readonly lnMetadata = new ServerStorage<LNMetadata>('/api/novel/metadata', 'novel_metadata');

    // Pre-parsed book content
    static readonly lnContent = {
        async getItem(key: string): Promise<LNParsedBook | null> {
            try {
                const response = await requestManager.getClient().fetcher(`/api/novel/content/${key}`);
                if (response.status === 404) return null;
                const data = await response.json();

                // Static serving means we don't need to rebuild blobs for images
                return { ...data, imageBlobs: {} };
            } catch (e) {
                return null;
            }
        },
        async setItem(key: string, content: LNParsedBook): Promise<void> {
            const imageBlobs: Record<string, string> = {};
            for (const [path, blob] of Object.entries(content.imageBlobs)) {
                if (typeof blob === 'string') {
                    imageBlobs[path] = blob;
                    continue;
                }
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve) => {
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve(base64);
                    };
                });
                reader.readAsDataURL(blob);
                imageBlobs[path] = await base64Promise;
            }

            await requestManager.getClient().fetcher(`/api/novel/content/${key}`, {
                httpMethod: HttpMethod.POST,
                data: { ...content, imageBlobs },
            });
        },
        async removeItem(key: string): Promise<void> {}
    };

    // Reading progress (the bookmark)
    static readonly lnProgress = new ServerStorage<LNProgress>('/api/novel/progress', 'novel_progress');

    // LN Categories
    static readonly lnCategories = new ServerStorage<LnCategory>('/api/novel/categories', 'novel_categories');

    // LN Category metadata (sort settings per category)
    static readonly lnCategoryMetadata = new ServerStorage<LnCategoryMetadata>('/api/novel/categories/metadata', 'novel_category_metadata');

    // Custom imported fonts
    static readonly customFonts = localforage.createInstance({
        name: 'Manatan',
        storeName: 'custom_fonts',
        description: 'User-imported font files',
    });

    // ========================================================================
    // Private Helpers
    // ========================================================================

    private static getSafeStorage(getter: () => StorageBackend): StorageBackend {
        try {
            return getter();
        } catch {
            return null;
        }
    }

    // ========================================================================
    // Progress Methods
    // ========================================================================

    static async saveLnProgress(
        bookId: string,
        progress: Omit<LNProgress, 'lastRead' | 'lastModified' | 'syncVersion' | 'deviceId'>
    ): Promise<void> {
        const existing = await this.getLnProgress(bookId);
        const now = Date.now();

        await this.lnProgress.setItem(bookId, {
            ...progress,
            lastRead: now,
            lastModified: now,
            syncVersion: (existing?.syncVersion || 0) + 1,
            deviceId: getDeviceId(),
        } as LNProgress);
    }

    static async getLnProgress(bookId: string): Promise<LNProgress | null> {
        return await this.lnProgress.getItem(bookId);
    }

    static async hasProgress(bookId: string): Promise<boolean> {
        const progress = await this.getLnProgress(bookId);
        return progress !== null && progress.totalProgress > 0;
    }

    // ========================================================================
    // Metadata Methods
    // ========================================================================

    static async getLnMetadata(bookId: string): Promise<LNMetadata | null> {
        return await this.lnMetadata.getItem(bookId);
    }

    static async saveLnMetadata(metadata: LNMetadata): Promise<void> {
        await this.lnMetadata.setItem(metadata.id, metadata);
    }

    static async updateLnMetadata(bookId: string, updates: Partial<LNMetadata>): Promise<void> {
        const existing = await this.getLnMetadata(bookId);
        if (!existing) return;

        await this.lnMetadata.setItem(bookId, {
            ...existing,
            ...updates,
        });
    }

    static async getAllLnMetadata(): Promise<LNMetadata[]> {
        try {
            const response = await requestManager.getClient().fetcher('/api/novel/metadata');
            const data = await response.json() as LNMetadata[];
            // Instant library mirror update
            localStorage.setItem('manatan_novel_metadata_list', JSON.stringify(data));
            return data;
        } catch (e) {
            // Fallback to local mirror if server offline
            const cached = localStorage.getItem('manatan_novel_metadata_list');
            return cached ? JSON.parse(cached) : [];
        }
    }

    // ========================================================================
    // Content Methods
    // ========================================================================

    static async getLnContent(bookId: string): Promise<LNParsedBook | null> {
        return await this.lnContent.getItem(bookId);
    }

    static async saveLnContent(bookId: string, content: LNParsedBook): Promise<void> {
        await this.lnContent.setItem(bookId, content);
    }

    // ========================================================================
    // Delete Methods
    // ========================================================================

    static async deleteLnData(bookId: string): Promise<void> {
        await requestManager.getClient().fetcher(`/api/novel/metadata/${bookId}`, {
            httpMethod: HttpMethod.DELETE
        });
        console.log('[AppStorage] All data deleted for:', bookId);
    }

    static async deleteLnProgress(bookId: string): Promise<void> {
        await this.lnProgress.removeItem(bookId);
    }

    // ========================================================================
    // Sync Methods
    // ========================================================================

    static async getAllProgressForSync(): Promise<Array<{ bookId: string; progress: LNProgress }>> {
        const metadata = await this.getAllLnMetadata();
        const allProgress: Array<{ bookId: string; progress: LNProgress }> = [];

        for (const m of metadata) {
            const progress = await this.getLnProgress(m.id);
            if (progress) {
                allProgress.push({ bookId: m.id, progress });
            }
        }

        return allProgress;
    }

    static async getProgressModifiedSince(timestamp: number): Promise<Array<{ bookId: string; progress: LNProgress }>> {
        const all = await this.getAllProgressForSync();
        return all.filter(({ progress }) => (progress.lastModified || 0) > timestamp);
    }

    static async mergeRemoteProgress(
        bookId: string, 
        remoteProgress: LNProgress
    ): Promise<{ result: 'local' | 'remote' | 'conflict'; merged?: LNProgress }> {
        const localProgress = await this.getLnProgress(bookId);

        if (!localProgress) {
            await this.lnProgress.setItem(bookId, remoteProgress);
            return { result: 'remote' };
        }

        if (!localProgress.lastModified || !remoteProgress.lastModified) {
            if (remoteProgress.totalProgress > localProgress.totalProgress) {
                await this.lnProgress.setItem(bookId, remoteProgress);
                return { result: 'remote' };
            }
            return { result: 'local' };
        }

        if (localProgress.deviceId === remoteProgress.deviceId) {
            if (remoteProgress.lastModified > localProgress.lastModified) {
                await this.lnProgress.setItem(bookId, remoteProgress);
                return { result: 'remote' };
            }
            return { result: 'local' };
        }

        if (remoteProgress.totalProgress > localProgress.totalProgress) {
            await this.lnProgress.setItem(bookId, remoteProgress);
            return { result: 'remote' };
        } else if (localProgress.totalProgress > remoteProgress.totalProgress) {
            return { result: 'local' };
        } else {
            if (remoteProgress.lastModified > localProgress.lastModified) {
                await this.lnProgress.setItem(bookId, remoteProgress);
                return { result: 'remote' };
            }
            return { result: 'local' };
        }
    }

    static async exportProgressData(): Promise<string> {
        const allProgress = await this.getAllProgressForSync();
        return JSON.stringify({
            version: 1,
            exportedAt: Date.now(),
            deviceId: getDeviceId(),
            data: allProgress,
        });
    }

    static async importProgressData(jsonData: string): Promise<{ imported: number; conflicts: number }> {
        const parsed = JSON.parse(jsonData);
        if (parsed.version !== 1) {
            throw new Error('Unsupported export version');
        }

        let imported = 0;
        let conflicts = 0;

        for (const { bookId, progress } of parsed.data) {
            const result = await this.mergeRemoteProgress(bookId, progress);
            if (result.result === 'remote') {
                imported++;
            } else if (result.result === 'conflict') {
                conflicts++;
            }
        }

        return { imported, conflicts };
    }

    // ========================================================================
    // Block Check Methods
    // ========================================================================

    static async hasBookBlocks(bookId: string): Promise<boolean> {
        const metadata = await this.getLnMetadata(bookId);
        if (!metadata) return false;

        return !!(metadata.stats.blockMaps && metadata.stats.blockMaps.length > 0);
    }

    // ========================================================================
    // Migration Methods
    // ========================================================================

    static async migrateLnMetadata(): Promise<void> {
        const legacyMetadata = localforage.createInstance({
            name: 'Manatan',
            storeName: 'novel_metadata',
        });

        const keys = await legacyMetadata.keys();
        if (keys.length === 0) return;

        console.log(`[Migration] Found ${keys.length} books in legacy storage. Migrating...`);

        const legacyFiles = localforage.createInstance({
            name: 'Manatan',
            storeName: 'novel_files',
        });
        const legacyContent = localforage.createInstance({
            name: 'Manatan',
            storeName: 'novel_content',
        });
        const legacyProgress = localforage.createInstance({
            name: 'Manatan',
            storeName: 'novel_progress',
        });
        const legacyCategories = localforage.createInstance({
            name: 'Manatan',
            storeName: 'novel_categories',
        });
        const legacyCatMeta = localforage.createInstance({
            name: 'Manatan',
            storeName: 'novel_category_metadata',
        });

        const catKeys = await legacyCategories.keys();
        for (const key of catKeys) {
            const cat = await legacyCategories.getItem<LnCategory>(key);
            if (cat) await this.saveLnCategory(cat);
        }

        const catMetaKeys = await legacyCatMeta.keys();
        for (const key of catMetaKeys) {
            const meta = await legacyCatMeta.getItem<LnCategoryMetadata>(key);
            if (meta) await this.setLnCategoryMetadata(key, meta);
        }

        for (const key of keys) {
            try {
                const metadata = await legacyMetadata.getItem<LNMetadata>(key);
                if (!metadata) continue;

                const file = await legacyFiles.getItem<Blob>(key);
                const content = await legacyContent.getItem<LNParsedBook>(key);
                const progress = await legacyProgress.getItem<LNProgress>(key);

                if (file) await this.files.setItem(key, file);
                if (content) await this.saveLnContent(key, content);
                if (progress) await this.lnProgress.setItem(key, progress);
                await this.saveLnMetadata(metadata);

                console.log(`[Migration] Successfully migrated: ${metadata.title}`);
            } catch (e) {
                console.error(`[Migration] Failed to migrate book ${key}:`, e);
            }
        }

        await Promise.all([
            legacyMetadata.clear(),
            legacyFiles.clear(),
            legacyContent.clear(),
            legacyProgress.clear(),
            legacyCategories.clear(),
            legacyCatMeta.clear(),
        ]);

        console.log('[Migration] Migration complete. Legacy storage cleared.');
    }

    // ========================================================================
    // Category Methods
    // ========================================================================

    static async getLnCategories(): Promise<LnCategory[]> {
        try {
            const response = await requestManager.getClient().fetcher('/api/novel/categories');
            return await response.json();
        } catch (e) {
            return [];
        }
    }

    static async getLnCategory(categoryId: string): Promise<LnCategory | null> {
        return await this.lnCategories.getItem(categoryId);
    }

    static async saveLnCategory(category: LnCategory): Promise<void> {
        await this.lnCategories.setItem(category.id, category);
    }

    static async createLnCategory(name: string): Promise<LnCategory> {
        const categories = await this.getLnCategories();
        const maxOrder = categories.reduce((max, c) => Math.max(max, c.order), -1);
        
        const newCategory: LnCategory = {
            id: `lncat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            order: maxOrder + 1,
            createdAt: Date.now(),
            lastModified: Date.now(),
        };

        await requestManager.getClient().fetcher('/api/novel/categories', {
            httpMethod: HttpMethod.POST,
            data: newCategory,
        });
        return newCategory;
    }

    static async updateLnCategory(categoryId: string, updates: Partial<LnCategory>): Promise<void> {
        const existing = await this.getLnCategory(categoryId);
        if (!existing) return;

        const updated = {
            ...existing,
            ...updates,
            lastModified: Date.now(),
        };

        await this.lnCategories.setItem(categoryId, updated);
    }

    static async deleteLnCategory(categoryId: string): Promise<void> {
        await this.lnCategories.removeItem(categoryId);
    }

    static async getLnCategoryMetadata(categoryId: string): Promise<LnCategoryMetadata | null> {
        return await this.lnCategoryMetadata.getItem(categoryId);
    }

    static async setLnCategoryMetadata(categoryId: string, metadata: LnCategoryMetadata): Promise<void> {
        await this.lnCategoryMetadata.setItem(categoryId, metadata);
    }

    static async getAllLnCategoryMetadata(): Promise<Record<string, LnCategoryMetadata>> {
        try {
            const response = await requestManager.getClient().fetcher('/api/novel/categories/metadata');
            return await response.json();
        } catch (e) {
            return {};
        }
    }
}
