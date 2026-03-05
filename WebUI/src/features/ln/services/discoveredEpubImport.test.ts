import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createDiscoveredEpubFile,
    importDiscoveredEpubsWithDeps,
} from '@/features/ln/services/discoveredEpubImport.ts';

function createMetadata(id: string) {
    return {
        id,
        title: `Title ${id}`,
        author: 'Author',
        cover: '',
        addedAt: 1,
        isProcessing: false,
        stats: { chapterLengths: [], totalLength: 0 },
        chapterCount: 1,
        toc: [],
        language: 'en',
        categoryIds: [],
    };
}

function createContent() {
    return {
        chapters: ['chapter'],
        chapterFilenames: ['chapter-0.xhtml'],
        imageBlobs: {},
    };
}

test('createDiscoveredEpubFile keeps filename so parser gets original title context', () => {
    const blob = new Blob(['epub-bytes'], { type: 'application/epub+zip' });
    const file = createDiscoveredEpubFile(blob, 'My Book.epub') as Blob & { name?: string };

    assert.equal(file.name, 'My Book.epub');
});

test('importDiscoveredEpubsWithDeps imports discovered epubs and forwards progress callbacks', async () => {
    const savedMetadata: string[] = [];
    const savedContent: string[] = [];
    const progressCalls: Array<{ id: string; stage: string }> = [];
    let parsedFileName = '';

    const summary = await importDiscoveredEpubsWithDeps(
        {
            discover: async () => [{ id: 'book-one', fileName: 'Book One.epub' }],
            readFile: async () => new Blob(['epub-data'], { type: 'application/epub+zip' }),
            parse: async (file, id, onProgress) => {
                parsedFileName = (file as Blob & { name?: string }).name || '';
                onProgress?.({ stage: 'init', percent: 1, message: 'start' });
                return {
                    success: true,
                    metadata: createMetadata(id) as any,
                    content: createContent() as any,
                };
            },
            saveMetadata: async (id) => {
                savedMetadata.push(id);
            },
            saveContent: async (id) => {
                savedContent.push(id);
            },
        },
        (id, progress) => {
            progressCalls.push({ id, stage: progress.stage });
        },
    );

    assert.equal(parsedFileName, 'Book One.epub');
    assert.deepEqual(savedMetadata, ['book-one']);
    assert.deepEqual(savedContent, ['book-one']);
    assert.deepEqual(progressCalls, [{ id: 'book-one', stage: 'init' }]);
    assert.deepEqual(summary, {
        discoveredCount: 1,
        importedIds: ['book-one'],
        skippedIds: [],
        failedIds: [],
    });
});

test('importDiscoveredEpubsWithDeps tracks skipped and failed entries without aborting the queue', async () => {
    const savedMetadata: string[] = [];
    const savedContent: string[] = [];

    const summary = await importDiscoveredEpubsWithDeps({
        discover: async () => [
            { id: 'missing-file', fileName: 'Missing.epub' },
            { id: 'bad-parse', fileName: 'Bad.epub' },
            { id: 'good-book', fileName: 'Good.epub' },
        ],
        readFile: async (id) => {
            if (id === 'missing-file') return null;
            return new Blob(['epub-data']);
        },
        parse: async (_file, id) => {
            if (id === 'bad-parse') {
                return { success: false, error: 'Invalid EPUB' };
            }
            return {
                success: true,
                metadata: createMetadata(id) as any,
                content: createContent() as any,
            };
        },
        saveMetadata: async (id) => {
            savedMetadata.push(id);
        },
        saveContent: async (id) => {
            savedContent.push(id);
        },
    });

    assert.deepEqual(savedMetadata, ['good-book']);
    assert.deepEqual(savedContent, ['good-book']);
    assert.deepEqual(summary, {
        discoveredCount: 3,
        importedIds: ['good-book'],
        skippedIds: ['missing-file'],
        failedIds: ['bad-parse'],
    });
});
