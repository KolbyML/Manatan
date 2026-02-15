/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { BlockIndexMap } from '@/features/ln/reader/types/block';
import { jsonSaveParse } from '@/lib/HelperFunctions.ts';
import localforage from 'localforage';

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
    imageBlobs: Record<string, Blob>;
    chapterFilenames: string[];
}

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
// AppStorage Class
// ============================================================================

export class AppStorage {
    static readonly local = new Storage(AppStorage.getSafeStorage(() => window.localStorage));
    static readonly session = new Storage(AppStorage.getSafeStorage(() => window.sessionStorage));

    // Raw EPUB files
    static readonly files = localforage.createInstance({
        name: 'Manatan',
        storeName: 'ln_files',
        description: 'EPUB source files',
    });

    // Book metadata with stats
    static readonly lnMetadata = localforage.createInstance({
        name: 'Manatan',
        storeName: 'ln_metadata',
        description: 'Light Novel metadata',
    });

    // Pre-parsed book content
    static readonly lnContent = localforage.createInstance({
        name: 'Manatan',
        storeName: 'ln_content',
        description: 'Pre-parsed book chapters and images',
    });

    // Reading progress (the bookmark)
    static readonly lnProgress = localforage.createInstance({
        name: 'Manatan',
        storeName: 'ln_progress',
        description: 'Reading progress',
    });

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
        });
    }

    static async getLnProgress(bookId: string): Promise<LNProgress | null> {
        try {
            return await this.lnProgress.getItem<LNProgress>(bookId);
        } catch {
            return null;
        }
    }

    static async hasProgress(bookId: string): Promise<boolean> {
        const progress = await this.getLnProgress(bookId);
        return progress !== null && progress.totalProgress > 0;
    }

    // ========================================================================
    // Metadata Methods
    // ========================================================================

    static async getLnMetadata(bookId: string): Promise<LNMetadata | null> {
        try {
            return await this.lnMetadata.getItem<LNMetadata>(bookId);
        } catch {
            return null;
        }
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
        const keys = await this.lnMetadata.keys();
        const allMetadata: LNMetadata[] = [];

        for (const key of keys) {
            const metadata = await this.getLnMetadata(key as string);
            if (metadata) {
                allMetadata.push(metadata);
            }
        }

        return allMetadata.sort((a, b) => b.addedAt - a.addedAt);
    }

    // ========================================================================
    // Content Methods
    // ========================================================================

    static async getLnContent(bookId: string): Promise<LNParsedBook | null> {
        try {
            return await this.lnContent.getItem<LNParsedBook>(bookId);
        } catch {
            return null;
        }
    }

    static async saveLnContent(bookId: string, content: LNParsedBook): Promise<void> {
        await this.lnContent.setItem(bookId, content);
    }

    // ========================================================================
    // Delete Methods
    // ========================================================================

    static async deleteLnData(bookId: string): Promise<void> {
        await Promise.all([
            this.files.removeItem(bookId),
            this.lnMetadata.removeItem(bookId),
            this.lnContent.removeItem(bookId),
            this.lnProgress.removeItem(bookId),
        ]);
        console.log('[AppStorage] All data deleted for:', bookId);
    }

    static async deleteLnProgress(bookId: string): Promise<void> {
        await this.lnProgress.removeItem(bookId);
    }

    // ========================================================================
    // Sync Methods
    // ========================================================================

    static async getAllProgressForSync(): Promise<Array<{ bookId: string; progress: LNProgress }>> {
        const keys = await this.lnProgress.keys();
        const allProgress: Array<{ bookId: string; progress: LNProgress }> = [];

        for (const bookId of keys) {
            const progress = await this.getLnProgress(bookId as string);
            if (progress) {
                allProgress.push({ bookId: bookId as string, progress });
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

        // No local progress, use remote
        if (!localProgress) {
            await this.lnProgress.setItem(bookId, remoteProgress);
            return { result: 'remote' };
        }

        // No timestamps, use whichever has more progress
        if (!localProgress.lastModified || !remoteProgress.lastModified) {
            if (remoteProgress.totalProgress > localProgress.totalProgress) {
                await this.lnProgress.setItem(bookId, remoteProgress);
                return { result: 'remote' };
            }
            return { result: 'local' };
        }

        // Same device, use latest
        if (localProgress.deviceId === remoteProgress.deviceId) {
            if (remoteProgress.lastModified > localProgress.lastModified) {
                await this.lnProgress.setItem(bookId, remoteProgress);
                return { result: 'remote' };
            }
            return { result: 'local' };
        }

        // Different devices - conflict resolution
        // Strategy: Use whichever is further ahead, or more recent if same progress
        if (remoteProgress.totalProgress > localProgress.totalProgress) {
            await this.lnProgress.setItem(bookId, remoteProgress);
            return { result: 'remote' };
        } else if (localProgress.totalProgress > remoteProgress.totalProgress) {
            return { result: 'local' };
        } else {
            // Same progress, use most recent
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

        return metadata.stats.blockMaps && metadata.stats.blockMaps.length > 0;
    }
}