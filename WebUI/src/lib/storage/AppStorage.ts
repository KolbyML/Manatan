/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// eslint-disable-next-line max-classes-per-file
import { BlockIndexMap } from '@/features/ln/reader/types/block';
import { jsonSaveParse } from '@/lib/HelperFunctions.ts';
import localforage from 'localforage';

type StorageBackend = typeof window.localStorage | null;

export class Storage {
    private readonly memory = new Map<string, string>();

    constructor(private readonly storage: StorageBackend) { }

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
}

export interface LNParsedBook {
    chapters: string[];              // Pre-parsed HTML for each chapter
    imageBlobs: Record<string, Blob>; // Original blobs for images
    chapterFilenames: string[];      // Filename for each chapter
}

export class AppStorage {
    static readonly local = new Storage(AppStorage.getSafeStorage(() => window.localStorage));
    static readonly session = new Storage(AppStorage.getSafeStorage(() => window.sessionStorage));

    // Raw EPUB files (can delete after parsing if needed)
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

    // Reading progress
    static readonly lnProgress = localforage.createInstance({
        name: 'Manatan',
        storeName: 'ln_progress',
        description: 'Reading progress',
    });

    // --- Helper Methods ---

    static async saveLnProgress(bookId: string, progress: Omit<LNProgress, 'lastRead'>): Promise<void> {
        await this.lnProgress.setItem(bookId, {
            ...progress,
            lastRead: Date.now(),
        });
    }

    static async getLnProgress(bookId: string): Promise<LNProgress | null> {
        try {
            return await this.lnProgress.getItem<LNProgress>(bookId);
        } catch {
            return null;
        }
    }

    static async getLnMetadata(bookId: string): Promise<LNMetadata | null> {
        try {
            return await this.lnMetadata.getItem<LNMetadata>(bookId);
        } catch {
            return null;
        }
    }

    static async getLnContent(bookId: string): Promise<LNParsedBook | null> {
        try {
            return await this.lnContent.getItem<LNParsedBook>(bookId);
        } catch {
            return null;
        }
    }

    static async deleteLnData(bookId: string): Promise<void> {
        await Promise.all([
            this.files.removeItem(bookId),
            this.lnMetadata.removeItem(bookId),
            this.lnContent.removeItem(bookId),
            this.lnProgress.removeItem(bookId),
        ]);
    }

    private static getSafeStorage(getter: () => StorageBackend): StorageBackend {
        try {
            return getter();
        } catch {
            return null;
        }
    }
}
