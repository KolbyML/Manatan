// src/ln/services/epubParser.ts

import JSZip from 'jszip';
import DOMPurify from 'dompurify';
import { resolvePath } from '../reader/utils/pathUtils';
import { BookStats, LNMetadata, LNParsedBook } from '@/lib/storage/AppStorage';

export interface ParseResult {
    success: boolean;
    metadata?: LNMetadata;
    content?: LNParsedBook;
    error?: string;
}

export interface ParseProgress {
    stage: 'init' | 'images' | 'content' | 'stats' | 'complete';
    percent: number;
    message: string;
}

type ProgressCallback = (progress: ParseProgress) => void;

/**
 * Character count for Japanese text
 */
const NOISE_REGEX = /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu;
export interface TocItem {
    label: string;
    href: string;
    chapterIndex: number;
}
function getCharacterCount(html: string): number {
    if (!html) return 0;
    const text = html.replace(/<[^>]*>/g, '');
    const clean = text.replace(NOISE_REGEX, '');
    return Array.from(clean).length;
}

/**
 * Parse EPUB file completely
 */
export async function parseEpub(
    file: Blob,
    bookId: string,
    onProgress?: ProgressCallback
): Promise<ParseResult> {
    const report = (stage: ParseProgress['stage'], percent: number, message: string) => {
        onProgress?.({ stage, percent, message });
    };

    try {
        report('init', 0, 'Reading EPUB...');

        const zip = new JSZip();
        const content = await zip.loadAsync(file);

        // --- Container & OPF ---
        const containerXml = await content.file('META-INF/container.xml')?.async('string');
        if (!containerXml) {
            return { success: false, error: 'Invalid EPUB: Missing container.xml' };
        }

        const parser = new DOMParser();
        const containerDoc = parser.parseFromString(containerXml, 'application/xml');
        const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');

        if (!opfPath) {
            return { success: false, error: 'Invalid EPUB: Missing rootfile' };
        }

        const opfContent = await content.file(opfPath)?.async('string');
        if (!opfContent) {
            return { success: false, error: 'Invalid EPUB: Missing OPF' };
        }

        const opfDoc = parser.parseFromString(opfContent, 'application/xml');

        report('init', 10, 'Extracting metadata...');

        // --- Metadata ---
        const title = opfDoc.querySelector('metadata > title, metadata title')?.textContent || 'Unknown Title';
        const author = opfDoc.querySelector('metadata > creator, metadata creator')?.textContent || 'Unknown Author';

        // --- Cover ---
        let coverBase64 = '';
        try {
            // Strategy 1: EPUB 3 'properties' attribute
            let coverItem = opfDoc.querySelector('manifest > item[properties*="cover-image"]');

            // Strategy 2: EPUB 2 <meta name="cover" content="item-id" />
            if (!coverItem) {
                const metaCover = opfDoc.querySelector('metadata > meta[name="cover"]');
                if (metaCover) {
                    const coverId = metaCover.getAttribute('content');
                    if (coverId) {
                        coverItem = opfDoc.querySelector(`manifest > item[id="${coverId}"]`);
                    }
                }
            }

            // Strategy 3: ID convention (id="cover")
            if (!coverItem) {
                coverItem = opfDoc.querySelector('manifest > item[id="cover"]')
                    || opfDoc.querySelector('manifest > item[id="cover-image"]');
            }

            // Strategy 4: Search manifest for an href containing 'cover'
            if (!coverItem) {
                const allImages = opfDoc.querySelectorAll('manifest > item[media-type^="image/"]');
                for (let i = 0; i < allImages.length; i++) {
                    const href = allImages[i].getAttribute('href') || '';
                    if (href.toLowerCase().includes('cover')) {
                        coverItem = allImages[i];
                        break;
                    }
                }
            }

            if (coverItem) {
                const href = coverItem.getAttribute('href');
                if (href) {
                    const fullPath = resolvePath(opfPath, href);

                    // Try exact match
                    let file = content.file(fullPath);

                    // Case-insensitive fallback (JSZip is case sensitive, EPUBs often aren't)
                    if (!file) {
                        const targetPath = fullPath.toLowerCase();
                        // Search all files in zip
                        for (const fileName of Object.keys(content.files)) {
                            if (fileName.toLowerCase() === targetPath) {
                                file = content.file(fileName);
                                break;
                            }
                        }
                    }

                    if (file) {
                        const coverBlob = await file.async('blob');
                        if (coverBlob) {
                            coverBase64 = await resizeCover(coverBlob);
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Cover extraction failed:', e);
            // Cover extraction is optional
        }

        // --- Manifest ---
        const manifest: Record<string, { href: string; type: string }> = {};
        opfDoc.querySelectorAll('manifest > item').forEach((item) => {
            const id = item.getAttribute('id');
            const href = item.getAttribute('href');
            const mediaType = item.getAttribute('media-type') || '';
            if (id && href) {
                manifest[id] = { href, type: mediaType };
            }
        });

        // --- Spine ---
        const spineIds: string[] = [];
        opfDoc.querySelectorAll('spine > itemref').forEach((item) => {
            const idref = item.getAttribute('idref');
            if (idref && manifest[idref]) {
                spineIds.push(idref);
            }
        });

        if (spineIds.length === 0) {
            return { success: false, error: 'No readable content in spine' };
        }
        report('init', 5, 'Extracting Table of Contents...');

        const tocItems: TocItem[] = [];

        const ncxItem = opfDoc.querySelector('manifest > item[media-type="application/x-dtbncx+xml"]');

        if (ncxItem) {
            const ncxHref = ncxItem.getAttribute('href');
            if (ncxHref) {
                const ncxPath = resolvePath(opfPath, ncxHref);
                const ncxContent = await content.file(ncxPath)?.async('string');
                if (ncxContent) {
                    const ncxDoc = new DOMParser().parseFromString(ncxContent, 'application/xml');

                    const navPoints = ncxDoc.querySelectorAll('navPoint');

                    navPoints.forEach((point) => {
                        const label =
                            point.querySelector('navLabel > text')?.textContent?.trim() ||
                            point.querySelector('text')?.textContent?.trim() ||
                            point.querySelector('navLabel')?.textContent?.trim() ||
                            'Untitled';

                        const src =
                            point.querySelector('content')?.getAttribute('src') ||
                            point.getAttribute('src') ||
                            '';

                        const cleanSrc = src.split('#')[0];

                        if (!cleanSrc) return;

                        let chapterIndex = -1;

                        const manifestEntry = Object.entries(manifest).find(([_, val]) => {
                            const normalizedManifest = val.href.split('#')[0];
                            const normalizedClean = cleanSrc.split('#')[0];

                            return normalizedManifest === normalizedClean ||
                                normalizedManifest.endsWith(normalizedClean) ||
                                normalizedClean.endsWith(normalizedManifest);
                        });

                        if (manifestEntry) {
                            const id = manifestEntry[0];
                            chapterIndex = spineIds.indexOf(id);
                        }

                        if (chapterIndex !== -1) {
                            tocItems.push({ label, href: src, chapterIndex });
                        }
                    });
                }
            }
        }

        if (tocItems.length === 0) {
            const navItem = opfDoc.querySelector('manifest > item[properties*="nav"]');
            if (navItem) {
                const navHref = navItem.getAttribute('href');
                if (navHref) {
                    const navPath = resolvePath(opfPath, navHref);
                    const navContent = await content.file(navPath)?.async('string');
                    if (navContent) {
                        const navDoc = new DOMParser().parseFromString(navContent, 'text/html');
                        const navLinks = navDoc.querySelectorAll('nav[epub\\:type="toc"] a, nav[*|type="toc"] a, nav#toc a');

                        navLinks.forEach((link) => {
                            const label = link.textContent?.trim() || 'Untitled';
                            const href = link.getAttribute('href') || '';
                            const cleanSrc = href.split('#')[0];

                            if (!cleanSrc) return;

                            const manifestEntry = Object.entries(manifest).find(([_, val]) =>
                                val.href.split('#')[0] === cleanSrc
                            );

                            if (manifestEntry) {
                                const chapterIndex = spineIds.indexOf(manifestEntry[0]);
                                if (chapterIndex !== -1) {
                                    tocItems.push({ label, href, chapterIndex });
                                }
                            }
                        });
                    }
                }
            }
        }
        report('images', 15, 'Processing images...');

        // --- Extract Images as Blobs ---
        const imageBlobs: Record<string, Blob> = {};
        const imageFiles: { path: string; file: JSZip.JSZipObject }[] = [];

        content.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir && /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(relativePath)) {
                console.log(`[EPUB Parser] Found image: ${relativePath}`);
                imageFiles.push({ path: relativePath, file: zipEntry });
            }
        });

        const BATCH_SIZE = 15;
        for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
            const batch = imageFiles.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(async ({ path, file }) => {
                    try {
                        const blob = await file.async('blob');
                        const ext = path.split('.').pop()?.toLowerCase();
                        const mimeTypes: Record<string, string> = {
                            jpg: 'image/jpeg',
                            jpeg: 'image/jpeg',
                            png: 'image/png',
                            gif: 'image/gif',
                            webp: 'image/webp',
                            svg: 'image/svg+xml',
                            bmp: 'image/bmp',
                        };
                        const mimeType = mimeTypes[ext || ''] || 'image/png';
                        console.log(`[EPUB Parser] Processed image ${path} as ${mimeType} (${blob.size} bytes)`);
                        return { path, blob: new Blob([blob], { type: mimeType }) };
                    } catch (err) {
                        console.error(`[EPUB Parser] Failed to process image ${path}:`, err);
                        return null;
                    }
                })
            );

            results.forEach((r) => {
                if (r) {
                    // Store with multiple path variations for lookup
                    imageBlobs[r.path] = r.blob;
                    imageBlobs['/' + r.path] = r.blob;
                    imageBlobs[r.path.replace(/^\//, '')] = r.blob;
                }
            });

            const progressPercent = 15 + Math.round((i / Math.max(imageFiles.length, 1)) * 25);
            report('images', progressPercent, `Processing images (${i + batch.length}/${imageFiles.length})...`);
        }

        report('content', 40, 'Parsing chapters...');

        const chapters: string[] = [];
        const chapterFilenames: string[] = [];

        for (let i = 0; i < spineIds.length; i++) {
            const id = spineIds[i];
            const entry = manifest[id];
            if (!entry) continue;

            const fullPath = resolvePath(opfPath, entry.href);
            const filename = fullPath.split('/').pop() || fullPath;

            const fileObj = content.file(fullPath);
            if (!fileObj) continue;

            const rawText = await fileObj.async('string');

            const isXHTML = fullPath.endsWith('.xhtml') || entry.type.includes('xhtml');
            let doc: Document;

            try {
                doc = parser.parseFromString(rawText, isXHTML ? 'application/xhtml+xml' : 'text/html');
                if (doc.querySelector('parsererror')) {
                    doc = parser.parseFromString(rawText, 'text/html');
                }
            } catch {
                doc = parser.parseFromString(rawText, 'text/html');
            }

            const images = doc.querySelectorAll('img, image, svg image');
            images.forEach((img) => {
                const srcAttr =
                    img.getAttribute('src') ||
                    img.getAttribute('xlink:href') ||
                    img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');

                if (srcAttr && !srcAttr.startsWith('http') && !srcAttr.startsWith('data:')) {
                    const resolvedPath = resolvePath(fullPath, srcAttr);
                    img.setAttribute('data-epub-src', resolvedPath);
                    img.removeAttribute('src');
                    img.removeAttribute('xlink:href');
                }

                img.removeAttribute('width');
                img.removeAttribute('height');
            });

            let bodyHTML = doc.body?.innerHTML || '';
            if (!bodyHTML.trim()) {
                const match = rawText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                bodyHTML = match?.[1] || rawText;
            }

            const cleanHTML = DOMPurify.sanitize(bodyHTML, {
                ADD_TAGS: ['ruby', 'rt', 'rp', 'svg', 'image'],
                ADD_ATTR: ['src', 'xlink:href', 'href', 'viewBox', 'xmlns', 'xmlns:xlink', 'data-epub-src'],
            });

            const textContent = cleanHTML.replace(/<[^>]*>/g, '').trim();

            if (textContent.length > 10 || cleanHTML.includes('<img') || cleanHTML.includes('<image')) {
                const isImageOnly =
                    textContent.length < 20 &&
                    (cleanHTML.includes('<img') || cleanHTML.includes('<image') || cleanHTML.includes('<svg'));

                chapters.push(
                    isImageOnly ? `<div class="image-only-chapter">${cleanHTML}</div>` : cleanHTML
                );
                chapterFilenames.push(filename);
            }

            const progressPercent = 40 + Math.round((i / spineIds.length) * 40);
            report('content', progressPercent, `Parsing chapters (${i + 1}/${spineIds.length})...`);
        }

        report('stats', 85, 'Calculating statistics...');

        // --- Calculate Stats ---
        const chapterLengths = chapters.map((html) => getCharacterCount(html));
        const totalLength = chapterLengths.reduce((a, b) => a + b, 0);

        const stats: BookStats = {
            chapterLengths,
            totalLength,
        };

        report('complete', 100, 'Complete!');

        // --- Build Results ---
        const metadata: LNMetadata = {
            id: bookId,
            title,
            author,
            cover: coverBase64,
            addedAt: Date.now(),
            isProcessing: false,
            stats,
            chapterCount: chapters.length,
            toc: tocItems,
        };

        const parsedBook: LNParsedBook = {
            chapters,
            chapterFilenames,
            imageBlobs,
        };

        return {
            success: true,
            metadata,
            content: parsedBook,
        };
    } catch (err: any) {
        console.error('[EPUB Parser] Error:', err);
        return {
            success: false,
            error: err.message || 'Unknown error',
        };
    }
}

/**
 * Resize cover image for storage
 */
async function resizeCover(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const scale = 300 / img.width;
                canvas.width = 300;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            } catch {
                resolve('');
            } finally {
                URL.revokeObjectURL(url);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve('');
        };

        img.src = url;
    });
}