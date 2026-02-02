import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import DOMPurify from 'dompurify';
import { resolvePath } from '../utils/pathUtils';

export interface BookMetadata {
    title: string;
    author: string;
    cover: string | null;
}

export interface TocItem {
    label: string;
    href: string;
}

// Cache for parsed books
const bookCache = new Map<string, {
    items: string[];
    metadata: BookMetadata;
    toc: TocItem[];
}>();

export const useBookParser = (file: Blob | null, cacheKey?: string) => {
    const [items, setItems] = useState<string[]>([]);
    const [toc, setToc] = useState<TocItem[]>([]);
    const [metadata, setMetadata] = useState<BookMetadata | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    const objectUrls = useRef<string[]>([]);
    const abortRef = useRef(false);

    useEffect(() => {
        if (!file) {
            console.log("📚 [useBookParser] No file provided");
            return;
        }

        // Check cache first
        if (cacheKey && bookCache.has(cacheKey)) {
            console.log("📚 [useBookParser] Using cached book data for:", cacheKey);
            const cached = bookCache.get(cacheKey)!;
            setItems(cached.items);
            setMetadata(cached.metadata);
            setToc(cached.toc);
            setProgress(100);
            setIsReady(true);
            return;
        }

        console.log("📚 [useBookParser] Starting parse for file:", file.size, "bytes");

        abortRef.current = false;
        const zip = new JSZip();

        const parseBook = async () => {
            setIsReady(false);
            setError(null);
            setItems([]);
            setProgress(0);

            try {
                console.log("📦 [ZIP] Loading zip file...");
                const content = await zip.loadAsync(file);
                console.log("📦 [ZIP] Loaded. Files in archive:");

                // Log all files in the EPUB
                const allFiles: string[] = [];
                content.forEach((relativePath, zipEntry) => {
                    allFiles.push(relativePath);
                });
                console.log("📦 [ZIP] Total files:", allFiles.length);
                console.log("📦 [ZIP] File list:", allFiles.slice(0, 20), allFiles.length > 20 ? `... and ${allFiles.length - 20} more` : '');

                if (abortRef.current) return;

                // --- 1. Container & OPF ---
                const containerXml = await content.file("META-INF/container.xml")?.async("string");
                if (!containerXml) throw new Error("Invalid EPUB: Missing container.xml");

                const parser = new DOMParser();
                const containerDoc = parser.parseFromString(containerXml, "application/xml");
                const opfPath = containerDoc.querySelector("rootfile")?.getAttribute("full-path");
                if (!opfPath) throw new Error("Missing Rootfile");

                console.log("📄 [OPF] Path:", opfPath);

                const opfContent = await content.file(opfPath)?.async("string");
                if (!opfContent) throw new Error("Missing OPF");

                const opfDoc = parser.parseFromString(opfContent, "application/xml");

                setProgress(10);

                // --- 2. Metadata ---
                const title = opfDoc.querySelector("metadata > title, metadata title")?.textContent || "Unknown Title";
                const author = opfDoc.querySelector("metadata > creator, metadata creator")?.textContent || "Unknown Author";

                console.log("📖 [Metadata] Title:", title, "| Author:", author);

                const bookMetadata: BookMetadata = { title, author, cover: null };
                setMetadata(bookMetadata);

                // --- 3. Build Manifest Map ---
                const manifest: Record<string, { href: string; type: string }> = {};
                opfDoc.querySelectorAll("manifest > item").forEach(item => {
                    const id = item.getAttribute("id");
                    const href = item.getAttribute("href");
                    const mediaType = item.getAttribute("media-type") || '';
                    if (id && href) {
                        manifest[id] = { href, type: mediaType };
                    }
                });

                console.log("📋 [Manifest] Total items:", Object.keys(manifest).length);

                // --- 4. Get Spine Order ---
                const spineIds: string[] = [];
                opfDoc.querySelectorAll("spine > itemref").forEach(item => {
                    const idref = item.getAttribute("idref");
                    if (idref && manifest[idref]) spineIds.push(idref);
                });

                console.log("📑 [Spine] Chapters:", spineIds.length);

                if (spineIds.length === 0) {
                    throw new Error("No readable content in spine");
                }

                setProgress(20);

                // --- 5. Pre-process all images ---
                console.log("🖼️ [Images] Starting image pre-processing...");
                const imageMap = new Map<string, string>();

                const imageFiles: { path: string; file: JSZip.JSZipObject }[] = [];
                content.forEach((relativePath, zipEntry) => {
                    if (!zipEntry.dir && /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(relativePath)) {
                        imageFiles.push({ path: relativePath, file: zipEntry });
                    }
                });

                console.log("🖼️ [Images] Found", imageFiles.length, "image files:");
                imageFiles.slice(0, 10).forEach(img => console.log("   -", img.path));
                if (imageFiles.length > 10) console.log("   ... and", imageFiles.length - 10, "more");

                // Process images in batches
                const BATCH_SIZE = 10;
                let processedCount = 0;
                let errorCount = 0;

                for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
                    if (abortRef.current) return;

                    const batch = imageFiles.slice(i, i + BATCH_SIZE);
                    const results = await Promise.all(
                        batch.map(async ({ path, file }) => {
                            try {
                                const blob = await file.async("blob");

                                // Determine correct MIME type
                                let mimeType = 'image/png';
                                const ext = path.split('.').pop()?.toLowerCase();
                                switch (ext) {
                                    case 'jpg':
                                    case 'jpeg':
                                        mimeType = 'image/jpeg';
                                        break;
                                    case 'png':
                                        mimeType = 'image/png';
                                        break;
                                    case 'gif':
                                        mimeType = 'image/gif';
                                        break;
                                    case 'webp':
                                        mimeType = 'image/webp';
                                        break;
                                    case 'svg':
                                        mimeType = 'image/svg+xml';
                                        break;
                                    case 'bmp':
                                        mimeType = 'image/bmp';
                                        break;
                                }

                                // Create blob with correct type
                                const typedBlob = new Blob([blob], { type: mimeType });
                                const url = URL.createObjectURL(typedBlob);
                                objectUrls.current.push(url);
                                processedCount++;
                                return { path, url };
                            } catch (err) {
                                console.error("🖼️ [Images] Error processing:", path, err);
                                errorCount++;
                                return null;
                            }
                        })
                    );

                    results.forEach(r => {
                        if (r) {
                            imageMap.set(r.path, r.url);
                            // Also add normalized path (without leading slash, with leading slash, etc.)
                            imageMap.set('/' + r.path, r.url);
                            imageMap.set(r.path.replace(/^\//, ''), r.url);
                        }
                    });

                    setProgress(20 + Math.round((i / Math.max(imageFiles.length, 1)) * 30));
                }

                console.log("🖼️ [Images] Processing complete:");
                console.log("   ✅ Processed:", processedCount);
                console.log("   ❌ Errors:", errorCount);
                console.log("   📍 Map size:", imageMap.size);

                // Log a few sample mappings
                const mapEntries = Array.from(imageMap.entries()).slice(0, 5);
                console.log("🖼️ [Images] Sample mappings:");
                mapEntries.forEach(([path, url]) => {
                    console.log("   ", path, "→", url.substring(0, 50) + "...");
                });

                // --- 6. Parse Content Files ---
                console.log("📄 [Content] Parsing", spineIds.length, "content files...");
                const parsedItems: string[] = [];

                for (let i = 0; i < spineIds.length; i++) {
                    if (abortRef.current) return;

                    const id = spineIds[i];
                    const entry = manifest[id];
                    if (!entry) {
                        console.warn("📄 [Content] Missing manifest entry for:", id);
                        continue;
                    }

                    const fullPath = resolvePath(opfPath, entry.href);
                    const fileObj = content.file(fullPath);

                    if (!fileObj) {
                        console.warn("📄 [Content] File not found:", fullPath);
                        continue;
                    }

                    let rawText = await fileObj.async("string");

                    // Parse as XHTML or HTML
                    const isXHTML = fullPath.endsWith('.xhtml') || entry.type.includes('xhtml');
                    let doc: Document;

                    try {
                        doc = parser.parseFromString(
                            rawText,
                            isXHTML ? "application/xhtml+xml" : "text/html"
                        );

                        if (doc.querySelector("parsererror")) {
                            console.warn("📄 [Content] XML parse error for:", fullPath, "- falling back to HTML");
                            doc = parser.parseFromString(rawText, "text/html");
                        }
                    } catch {
                        doc = parser.parseFromString(rawText, "text/html");
                    }

                    // --- IMAGE REPLACEMENT ---
                    const images = doc.querySelectorAll("img, image, svg image");

                    if (images.length > 0) {
                        console.log(`🖼️ [Content] Chapter ${i} (${fullPath}) has ${images.length} images`);
                    }

                    images.forEach((img, imgIndex) => {
                        // Get source attribute
                        const srcAttr = img.getAttribute("src")
                            || img.getAttribute("xlink:href")
                            || img.getAttributeNS("http://www.w3.org/1999/xlink", "href");

                        console.log(`🖼️ [Content] Image ${imgIndex} original src:`, srcAttr);

                        if (srcAttr && !srcAttr.startsWith("http") && !srcAttr.startsWith("data:") && !srcAttr.startsWith("blob:")) {
                            // Resolve the image path relative to the content file
                            const resolvedPath = resolvePath(fullPath, srcAttr);
                            console.log(`🖼️ [Content] Resolved path:`, resolvedPath);

                            // Try multiple path variations
                            let blobUrl = imageMap.get(resolvedPath);

                            if (!blobUrl) {
                                // Try without leading directory
                                const altPath1 = resolvedPath.replace(/^[^/]+\//, '');
                                blobUrl = imageMap.get(altPath1);
                                if (blobUrl) console.log(`🖼️ [Content] Found via altPath1:`, altPath1);
                            }

                            if (!blobUrl) {
                                // Try with OEBPS prefix
                                const altPath2 = 'OEBPS/' + srcAttr.replace(/^\.\.\//, '').replace(/^\//, '');
                                blobUrl = imageMap.get(altPath2);
                                if (blobUrl) console.log(`🖼️ [Content] Found via altPath2:`, altPath2);
                            }

                            if (!blobUrl) {
                                // Try just the filename
                                const filename = srcAttr.split('/').pop() || '';
                                for (const [path, url] of imageMap.entries()) {
                                    if (path.endsWith('/' + filename) || path === filename) {
                                        blobUrl = url;
                                        console.log(`🖼️ [Content] Found via filename match:`, path);
                                        break;
                                    }
                                }
                            }

                            if (blobUrl) {
                                console.log(`✅ [Content] Image ${imgIndex} mapped to blob URL`);
                                img.setAttribute("src", blobUrl);
                                if (img.hasAttribute("xlink:href")) {
                                    img.setAttribute("xlink:href", blobUrl);
                                }
                                if (img.hasAttributeNS("http://www.w3.org/1999/xlink", "href")) {
                                    img.setAttributeNS("http://www.w3.org/1999/xlink", "href", blobUrl);
                                }
                            } else {
                                console.error(`❌ [Content] Image ${imgIndex} NOT FOUND in map!`);
                                console.error(`   Tried paths:`, resolvedPath);
                                console.error(`   Original src:`, srcAttr);
                                console.error(`   Content file:`, fullPath);

                                // Log nearby paths in map that might match
                                const possibleMatches = Array.from(imageMap.keys()).filter(p =>
                                    p.includes(srcAttr.split('/').pop() || 'NOMATCH')
                                );
                                if (possibleMatches.length > 0) {
                                    console.error(`   Possible matches in map:`, possibleMatches);
                                }
                            }
                        }

                        // Remove fixed dimensions
                        img.removeAttribute("width");
                        img.removeAttribute("height");
                    });

                    // Extract body content
                    let bodyHTML = doc.body?.innerHTML || '';

                    if (!bodyHTML.trim()) {
                        const match = rawText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                        bodyHTML = match?.[1] || rawText;
                    }

                    // Sanitize - make sure to allow blob: URLs
                    const cleanHTML = DOMPurify.sanitize(bodyHTML, {
                        ADD_TAGS: ['ruby', 'rt', 'rp', 'svg', 'image'],
                        ADD_ATTR: ['src', 'xlink:href', 'href', 'viewBox', 'xmlns', 'xmlns:xlink'],
                        ALLOW_DATA_ATTR: false,
                        ADD_URI_SAFE_ATTR: ['src', 'xlink:href', 'href'],
                        // Allow blob: URLs
                        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
                    });

                    // Check if blob URLs survived sanitization
                    const blobUrlCount = (cleanHTML.match(/blob:/g) || []).length;
                    const originalBlobCount = (bodyHTML.match(/blob:/g) || []).length;

                    if (originalBlobCount > 0) {
                        console.log(`🧹 [Sanitize] Chapter ${i}: ${originalBlobCount} blob URLs before, ${blobUrlCount} after sanitization`);

                        if (blobUrlCount < originalBlobCount) {
                            console.error(`🧹 [Sanitize] WARNING: DOMPurify removed some blob URLs!`);
                        }
                    }

                    // Only add if has meaningful content
                    const textContent = cleanHTML.replace(/<[^>]*>/g, '').trim();

                    // Check if has meaningful content
                    if (textContent.length > 10 || cleanHTML.includes('<img') || cleanHTML.includes('<image')) {

                        // Check if this is an image-only chapter (minimal text)
                        const isImageOnly = textContent.length < 20 &&
                            (cleanHTML.includes('<img') || cleanHTML.includes('<image') || cleanHTML.includes('<svg'));

                        if (isImageOnly) {
                            // Wrap in centering container
                            parsedItems.push(`<div class="image-only-chapter">${cleanHTML}</div>`);
                        } else {
                            parsedItems.push(cleanHTML);
                        }
                    }

                    setProgress(50 + Math.round((i / spineIds.length) * 50));
                }
                console.log(`✅ [Parse] Complete! ${parsedItems.length} chapters parsed`);

                // Log stats about images in final content
                let totalImagesInContent = 0;
                let blobImagesInContent = 0;
                parsedItems.forEach((html, idx) => {
                    const imgMatches = html.match(/<img[^>]+>/gi) || [];
                    const imageMatches = html.match(/<image[^>]+>/gi) || [];
                    const total = imgMatches.length + imageMatches.length;
                    const blobs = (html.match(/src="blob:/gi) || []).length + (html.match(/href="blob:/gi) || []).length;

                    totalImagesInContent += total;
                    blobImagesInContent += blobs;

                    if (total > 0) {
                        console.log(`📊 [Stats] Chapter ${idx}: ${total} images, ${blobs} with blob URLs`);
                    }
                });

                console.log(`📊 [Stats] Total: ${totalImagesInContent} images, ${blobImagesInContent} with blob URLs`);

                if (abortRef.current) return;

                // Cache the results
                if (cacheKey) {
                    bookCache.set(cacheKey, {
                        items: parsedItems,
                        metadata: bookMetadata,
                        toc: [],
                    });
                }

                setItems(parsedItems);
                setProgress(100);
                setIsReady(true);

            } catch (err: any) {
                console.error("❌ [Parse] Error:", err);
                if (!abortRef.current) {
                    setError(err.message);
                }
            }
        };

        parseBook();

        return () => {
            abortRef.current = true;


            if (!cacheKey) {
                objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
                objectUrls.current = [];
            }
        };
    }, [file, cacheKey]);

    return { items, toc, metadata, isReady, error, progress };
};