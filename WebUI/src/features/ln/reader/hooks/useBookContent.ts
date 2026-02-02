

import { useState, useEffect, useRef } from 'react';
import { AppStorage, LNMetadata, BookStats } from '@/lib/storage/AppStorage';

export interface BookContent {
    chapters: string[];
    stats: BookStats;
    metadata: LNMetadata;
    chapterFilenames: string[];
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

    const objectUrlsRef = useRef<string[]>([]);

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

                const [metadata, parsedBook] = await Promise.all([
                    AppStorage.getLnMetadata(bookId),
                    AppStorage.getLnContent(bookId),
                ]);

                if (cancelled) return;

                if (!metadata || !parsedBook) {
                    setError('Book not found. It may need to be re-imported.');
                    setIsLoading(false);
                    return;
                }


                let bookBlobUrls = blobUrlCache.get(bookId);

                if (!bookBlobUrls) {

                    bookBlobUrls = new Map<string, string>();

                    for (const [path, blob] of Object.entries(parsedBook.imageBlobs)) {
                        const url = URL.createObjectURL(blob);
                        bookBlobUrls.set(path, url);
                        objectUrlsRef.current.push(url);
                    }

                    blobUrlCache.set(bookId, bookBlobUrls);
                }


                const processedChapters = parsedBook.chapters.map((html) => {
                    return html.replace(/data-epub-src="([^"]+)"/g, (match, path) => {

                        let blobUrl = bookBlobUrls!.get(path);


                        if (!blobUrl) {
                            blobUrl = bookBlobUrls!.get('/' + path);
                        }

                        if (!blobUrl) {
                            blobUrl = bookBlobUrls!.get(path.replace(/^\//, ''));
                        }


                        if (!blobUrl) {
                            const filename = path.split('/').pop() || '';
                            for (const [storedPath, url] of bookBlobUrls!.entries()) {
                                if (storedPath.endsWith('/' + filename) || storedPath === filename) {
                                    blobUrl = url;
                                    break;
                                }
                            }
                        }

                        if (blobUrl) {
                            console.log(`[useBookContent] Resolved image: ${path} -> ${blobUrl.substring(0, 30)}...`);
                            return `src="${blobUrl}" href="${blobUrl}" xlink:href="${blobUrl}" data-epub-src="${path}"`;
                        }

                        console.warn(`[useBookContent] Failed to resolve image path: ${path} in book ${bookId}`);
                        console.log('[useBookContent] Available paths:', Array.from(bookBlobUrls!.keys()));
                        return match;
                    });
                });

                if (cancelled) return;

                setContent({
                    chapters: processedChapters,
                    stats: metadata.stats,
                    metadata,
                    chapterFilenames: parsedBook.chapterFilenames || [],
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