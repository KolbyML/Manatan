

import { useState, useEffect } from 'react';
import { AppStorage, LNMetadata, BookStats } from '@/lib/storage/AppStorage';
import { requestManager } from '@/lib/requests/RequestManager';

export interface BookContent {
    chapters: string[];
    stats: BookStats;
    metadata: LNMetadata;
    chapterFilenames: string[];
    css?: string;
}

interface UseBookContentReturn {
    content: BookContent | null;
    isLoading: boolean;
    error: string | null;
}


const blobUrlCache = new Map<string, Map<string, string>>();

export function useBookContent(bookId: string | undefined): UseBookContentReturn {
    const [content, setContent] = useState<BookContent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!bookId) {
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            setError(null);

            try {

                const metadata = await AppStorage.getLnMetadata(bookId);

                if (cancelled) return;

                if (!metadata) {
                    setError('Book not found. It may need to be re-imported.');
                    setIsLoading(false);
                    return;
                }

                // Check for static content on server
                const baseUrl = requestManager.getBaseUrl();
                const staticBase = `${baseUrl}/api/novel/static/${bookId}`;

                // Fetch chapter list (just to be sure we have the filenames/count)
                const parsedBook = await AppStorage.getLnContent(bookId);

                if (cancelled) return;

                if (!parsedBook) {
                     setError('Book content not found.');
                     setIsLoading(false);
                     return;
                }

                const processedChapters = parsedBook.chapters.map((html, i) => {
                    // Re-route images to static server
                    return html.replace(/data-epub-src="([^"]+)"/g, (match, path: string) => {
                        const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
                        const encodedPath = normalizedPath
                            .split('/')
                            .map((part) => encodeURIComponent(part))
                            .join('/');
                        const staticUrl = `${staticBase}/extracted/images/${encodedPath}`;
                        const fallbackUrl = `${staticBase}/extracted/images/${normalizedPath}`;
                        return `src="${staticUrl}" href="${staticUrl}" xlink:href="${staticUrl}" data-epub-src="${path}" data-ln-fallback-src="${fallbackUrl}"`;
                    });
                });

                if (cancelled) return;

                setContent({
                    chapters: processedChapters,
                    stats: metadata.stats,
                    metadata,
                    chapterFilenames: parsedBook.chapterFilenames || [],
                    css: parsedBook.css,
                });
                setIsLoading(false);

            } catch (err: any) {
                if (cancelled) return;
                console.error('[useBookContent] Load error:', err);
                setError(err.message || 'Failed to load book');
                setIsLoading(false);
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [bookId]);



    return { content, isLoading, error };
}


export function clearBookCache(bookId: string): void {
    const cache = blobUrlCache.get(bookId);
    if (cache) {
        cache.forEach((url) => URL.revokeObjectURL(url));
        blobUrlCache.delete(bookId);
    }
}


export function clearAllBookCaches(): void {
    blobUrlCache.forEach((cache) => {
        cache.forEach((url) => URL.revokeObjectURL(url));
    });
    blobUrlCache.clear();
}