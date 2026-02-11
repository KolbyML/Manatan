
import JSZip from 'jszip';
import DOMPurify from 'dompurify';
import { resolvePath } from '../reader/utils/pathUtils';
import { BookStats, LNMetadata, LNParsedBook } from '@/lib/storage/AppStorage';
import { processChapterHTML, getCleanCharacterCount, logBlockMapStats } from '../reader/utils/blockProcessor';
import { BlockIndexMap, ChapterBlockInfo } from '../reader/types/block';

// ============================================================================
// Types
// ============================================================================

export interface ParseResult {
    success: boolean;
    metadata?: LNMetadata;
    content?: LNParsedBook;
    error?: string;
}

export interface ParseProgress {
    stage: 'init' | 'images' | 'content' | 'blocks' | 'stats' | 'complete';
    percent: number;
    message: string;
}

export interface TocItem {
    label: string;
    href: string;
    chapterIndex: number;
}

type ProgressCallback = (progress: ParseProgress) => void;

// ============================================================================
// Constants
// ============================================================================

// Universal regex for character counting - works with ALL languages
// Keeps: All Unicode letters + all Unicode numbers
// Removes: Whitespace, punctuation, symbols, formatting
const NOISE_REGEX = /[^\p{L}\p{N}]+/gu;

// MIME type mapping for images
const IMAGE_MIME_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get character count from HTML (strips tags first)
 * Uses universal regex for multilingual support
 */
function getCharacterCount(html: string): number {
    if (!html) return 0;
    const text = html.replace(/<[^>]*>/g, '');
    const clean = text.replace(NOISE_REGEX, '');
    return Array.from(clean).length;
}

/**
 * Resize cover image for efficient storage
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

/**
 * Find cover image in manifest using multiple strategies
 */
function findCoverItem(opfDoc: Document): Element | null {
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

    // Strategy 3: ID convention (id="cover" or id="cover-image")
    if (!coverItem) {
        coverItem = opfDoc.querySelector('manifest > item[id="cover"]')
            || opfDoc.querySelector('manifest > item[id="cover-image"]');
    }

    // Strategy 4: Search manifest for href containing 'cover'
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

    return coverItem;
}

/**
 * Parse NCX table of contents
 */
async function parseNcxToc(
    content: JSZip,
    opfDoc: Document,
    opfPath: string,
    manifest: Record<string, { href: string; type: string }>,
    spineIds: string[]
): Promise<TocItem[]> {
    const tocItems: TocItem[] = [];
    const ncxItem = opfDoc.querySelector('manifest > item[media-type="application/x-dtbncx+xml"]');

    if (!ncxItem) return tocItems;

    const ncxHref = ncxItem.getAttribute('href');
    if (!ncxHref) return tocItems;

    const ncxPath = resolvePath(opfPath, ncxHref);
    const ncxContent = await content.file(ncxPath)?.async('string');
    if (!ncxContent) return tocItems;

    const parser = new DOMParser();
    const ncxDoc = parser.parseFromString(ncxContent, 'application/xml');
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

        // Find matching manifest entry
        const manifestEntry = Object.entries(manifest).find(([_, val]) => {
            const normalizedManifest = val.href.split('#')[0];
            const normalizedClean = cleanSrc.split('#')[0];

            return normalizedManifest === normalizedClean ||
                normalizedManifest.endsWith(normalizedClean) ||
                normalizedClean.endsWith(normalizedManifest);
        });

        if (manifestEntry) {
            const id = manifestEntry[0];
            const chapterIndex = spineIds.indexOf(id);
            if (chapterIndex !== -1) {
                tocItems.push({ label, href: src, chapterIndex });
            }
        }
    });

    return tocItems;
}

/**
 * Parse NAV table of contents (EPUB 3)
 */
async function parseNavToc(
    content: JSZip,
    opfDoc: Document,
    opfPath: string,
    manifest: Record<string, { href: string; type: string }>,
    spineIds: string[]
): Promise<TocItem[]> {
    const tocItems: TocItem[] = [];
    const navItem = opfDoc.querySelector('manifest > item[properties*="nav"]');

    if (!navItem) return tocItems;

    const navHref = navItem.getAttribute('href');
    if (!navHref) return tocItems;

    const navPath = resolvePath(opfPath, navHref);
    const navContent = await content.file(navPath)?.async('string');
    if (!navContent) return tocItems;

    const parser = new DOMParser();
    const navDoc = parser.parseFromString(navContent, 'text/html');
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

    return tocItems;
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse EPUB file completely
 * 
 * @param file - EPUB file as Blob
 * @param bookId - Unique identifier for this book
 * @param onProgress - Optional callback for progress updates
 * @returns ParseResult with metadata and content, or error
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

        // ====================================================================
        // 1. Parse Container & OPF
        // ====================================================================

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

        report('init', 5, 'Extracting metadata...');

        // ====================================================================
        // 2. Extract Metadata
        // ====================================================================

        const title = opfDoc.querySelector('metadata > title, metadata title')?.textContent || 'Unknown Title';
        const author = opfDoc.querySelector('metadata > creator, metadata creator')?.textContent || 'Unknown Author';

        // ====================================================================
        // 3. Extract Cover
        // ====================================================================

        let coverBase64 = '';
        try {
            const coverItem = findCoverItem(opfDoc);

            if (coverItem) {
                const href = coverItem.getAttribute('href');
                if (href) {
                    const fullPath = resolvePath(opfPath, href);

                    // Try exact match first
                    let file = content.file(fullPath);

                    // Case-insensitive fallback
                    if (!file) {
                        const targetPath = fullPath.toLowerCase();
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
            console.warn('[EPUB Parser] Cover extraction failed:', e);
        }

        // ====================================================================
        // 4. Build Manifest Map
        // ====================================================================

        const manifest: Record<string, { href: string; type: string }> = {};
        opfDoc.querySelectorAll('manifest > item').forEach((item) => {
            const id = item.getAttribute('id');
            const href = item.getAttribute('href');
            const mediaType = item.getAttribute('media-type') || '';
            if (id && href) {
                manifest[id] = { href, type: mediaType };
            }
        });

        // ====================================================================
        // 5. Get Spine Order
        // ====================================================================

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

        // ====================================================================
        // 6. Extract Table of Contents
        // ====================================================================

        report('init', 8, 'Extracting Table of Contents...');

        let tocItems = await parseNcxToc(content, opfDoc, opfPath, manifest, spineIds);

        // Try NAV if NCX is empty
        if (tocItems.length === 0) {
            tocItems = await parseNavToc(content, opfDoc, opfPath, manifest, spineIds);
        }

        // ====================================================================
        // 7. Process Images
        // ====================================================================

        report('images', 15, 'Processing images...');

        const imageBlobs: Record<string, Blob> = {};
        const imageFiles: { path: string; file: JSZip.JSZipObject }[] = [];

        content.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir && /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(relativePath)) {
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
                        const ext = path.split('.').pop()?.toLowerCase() || '';
                        const mimeType = IMAGE_MIME_TYPES[ext] || 'image/png';
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
            report('images', progressPercent, `Processing images (${Math.min(i + BATCH_SIZE, imageFiles.length)}/${imageFiles.length})...`);
        }

        // ====================================================================
        // 8. Parse Content Files (Chapters)
        // ====================================================================

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

            // Parse as XHTML or HTML
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

            // Process images - mark for runtime resolution
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

                // Remove fixed dimensions for responsive display
                img.removeAttribute('width');
                img.removeAttribute('height');
            });

            // Extract body content
            let bodyHTML = doc.body?.innerHTML || '';
            if (!bodyHTML.trim()) {
                const match = rawText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                bodyHTML = match?.[1] || rawText;
            }

            // Sanitize HTML
            const cleanHTML = DOMPurify.sanitize(bodyHTML, {
                ADD_TAGS: ['ruby', 'rt', 'rp', 'svg', 'image'],
                ADD_ATTR: ['src', 'xlink:href', 'href', 'viewBox', 'xmlns', 'xmlns:xlink', 'data-epub-src'],
            });

            // Check if chapter has meaningful content
            const textContent = cleanHTML.replace(/<[^>]*>/g, '').trim();

            if (textContent.length > 10 || cleanHTML.includes('<img') || cleanHTML.includes('<image')) {
                // Check if this is an image-only chapter
                const isImageOnly =
                    textContent.length < 20 &&
                    (cleanHTML.includes('<img') || cleanHTML.includes('<image') || cleanHTML.includes('<svg'));

                chapters.push(
                    isImageOnly ? `<div class="image-only-chapter">${cleanHTML}</div>` : cleanHTML
                );
                chapterFilenames.push(filename);
            }

            const progressPercent = 40 + Math.round((i / spineIds.length) * 30);
            report('content', progressPercent, `Parsing chapters (${i + 1}/${spineIds.length})...`);
        }

        // ====================================================================
        // 9. Process Chapters into Blocks
        // ====================================================================

        report('blocks', 70, 'Processing blocks for position tracking...');

        const blockMaps: BlockIndexMap[] = [];
        const chapterLengths: number[] = [];
        const chapterBlockInfos: ChapterBlockInfo[] = [];

        for (let i = 0; i < chapters.length; i++) {
            try {
                const { processedHtml, blockMap, chapterBlockInfo } = processChapterHTML(chapters[i], i);

                // Replace chapter with block-indexed HTML
                chapters[i] = processedHtml;
                blockMaps.push(...blockMap); // Spread flat array
                chapterLengths.push(chapterBlockInfo.totalChars);
                chapterBlockInfos.push(chapterBlockInfo);

                // Log stats for debugging
                if (i < 3 || i === chapters.length - 1) {
                    logBlockMapStats(chapterBlockInfo);
                }
            } catch (err) {
                console.error(`[EPUB Parser] Block processing failed for chapter ${i}:`, err);

                // Fallback: use simple character count without block indexing
                const fallbackLength = getCleanCharacterCount(chapters[i].replace(/<[^>]*>/g, ''));
                chapterLengths.push(fallbackLength);
                // Empty blockMaps for fallback - no blocks to track
            }

            if (i % 10 === 0 || i === chapters.length - 1) {
                const progressPercent = 70 + Math.round((i / chapters.length) * 15);
                report('blocks', progressPercent, `Processing blocks (${i + 1}/${chapters.length})...`);
            }
        }

        // ====================================================================
        // 10. Calculate Statistics
        // ====================================================================

        report('stats', 85, 'Calculating statistics...');

        const totalLength = chapterLengths.reduce((a, b) => a + b, 0);

        const stats: BookStats = {
            chapterLengths,
            totalLength,
            blockMaps,
        };

        // Log summary
        console.log(`[EPUB Parser] Complete:`, {
            title,
            chapters: chapters.length,
            totalChars: totalLength,
            totalBlocks: blockMaps.length,
            images: Object.keys(imageBlobs).length / 3, // Divided by 3 due to path variations
        });

        report('complete', 100, 'Complete!');

        // ====================================================================
        // 11. Build Results
        // ====================================================================

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