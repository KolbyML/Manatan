import type { LNDiscoveredEpub, LNMetadata, LNParsedBook } from '@/lib/storage/AppStorage';
import type { ParseProgress, ParseResult } from '@/features/ln/services/epubParser.ts';

type ParseProgressCallback = (progress: ParseProgress) => void;

export interface DiscoveredImportSummary {
    discoveredCount: number;
    importedIds: string[];
    skippedIds: string[];
    failedIds: string[];
}

export interface DiscoveredImportDeps {
    discover: () => Promise<LNDiscoveredEpub[]>;
    readFile: (id: string) => Promise<Blob | null>;
    parse: (file: Blob, id: string, onProgress?: ParseProgressCallback) => Promise<ParseResult>;
    saveMetadata: (id: string, metadata: LNMetadata) => Promise<unknown>;
    saveContent: (id: string, content: LNParsedBook) => Promise<unknown>;
    logger?: Pick<Console, 'error'>;
}

export function createDiscoveredEpubFile(blob: Blob, fileName: string): Blob {
    const normalizedName = fileName.trim() || 'book.epub';
    if (typeof File !== 'undefined') {
        return new File([blob], normalizedName, {
            type: blob.type || 'application/epub+zip',
            lastModified: Date.now(),
        });
    }

    const fallbackBlob = blob as Blob & { name?: string };
    fallbackBlob.name = normalizedName;
    return fallbackBlob;
}

export async function importDiscoveredEpubsWithDeps(
    deps: DiscoveredImportDeps,
    onProgress?: (id: string, progress: ParseProgress) => void,
): Promise<DiscoveredImportSummary> {
    const discovered = await deps.discover();
    const importedIds: string[] = [];
    const skippedIds: string[] = [];
    const failedIds: string[] = [];

    for (const item of discovered) {
        try {
            const blob = await deps.readFile(item.id);
            if (!blob) {
                skippedIds.push(item.id);
                continue;
            }

            const parseTarget = createDiscoveredEpubFile(blob, item.fileName || `${item.id}.epub`);
            const parseResult = await deps.parse(parseTarget, item.id, (progress) => {
                onProgress?.(item.id, progress);
            });

            if (!parseResult.success || !parseResult.metadata || !parseResult.content) {
                failedIds.push(item.id);
                continue;
            }

            await Promise.all([
                deps.saveMetadata(item.id, parseResult.metadata),
                deps.saveContent(item.id, parseResult.content),
            ]);
            importedIds.push(item.id);
        } catch (error) {
            deps.logger?.error?.(`[LN] Failed to auto-import discovered EPUB "${item.id}"`, error);
            failedIds.push(item.id);
        }
    }

    return {
        discoveredCount: discovered.length,
        importedIds,
        skippedIds,
        failedIds,
    };
}

export async function importDiscoveredEpubs(
    onProgress?: (id: string, progress: ParseProgress) => void,
): Promise<DiscoveredImportSummary> {
    const [{ AppStorage }, { parseEpub }] = await Promise.all([
        import('@/lib/storage/AppStorage'),
        import('@/features/ln/services/epubParser.ts'),
    ]);

    return importDiscoveredEpubsWithDeps(
        {
            discover: AppStorage.files.discoverPendingEpubs,
            readFile: AppStorage.files.getItem,
            parse: parseEpub,
            saveMetadata: (id, metadata) => AppStorage.lnMetadata.setItem(id, metadata),
            saveContent: (id, content) => AppStorage.lnContent.setItem(id, content),
            logger: console,
        },
        onProgress,
    );
}
