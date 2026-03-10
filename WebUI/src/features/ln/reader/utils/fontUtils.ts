import { AppStorage } from '@/lib/storage/AppStorage';
import { HttpMethod } from '@/lib/requests/client/RestClient';
import { requestManager } from '@/lib/requests/RequestManager';

export interface CustomFont {
    name: string;
    family: string;
    dataUrl: string;
}

type StoredFontEntry = {
    name: string;
    family?: string | null;
    dataUrl: string;
};

const FONT_STORAGE_ENDPOINT = '/api/novel/fonts';

async function loadFontIntoDocument(font: CustomFont): Promise<void> {
    const existing = Array.from(document.fonts).find(
        f => f.family === font.family
    );

    if (existing) {
        return;
    }

    const fontFace = new FontFace(font.family, `url(${font.dataUrl})`);
    await fontFace.load();
    document.fonts.add(fontFace);
}

async function createFileFromDataUrl(filename: string, dataUrl: string): Promise<File> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
}

async function fetchStoredFonts(): Promise<StoredFontEntry[]> {
    const response = await requestManager.getClient().fetcher(FONT_STORAGE_ENDPOINT);
    const payload = await response.json();
    return Array.isArray(payload) ? payload as StoredFontEntry[] : [];
}

async function parseStoredFonts(storedFonts: StoredFontEntry[]): Promise<CustomFont[]> {
    const fonts: CustomFont[] = [];
    for (const storedFont of storedFonts) {
        try {
            const family = storedFont.family?.trim()
                ? storedFont.family
                : await getFontName(await createFileFromDataUrl(storedFont.name, storedFont.dataUrl));
            fonts.push({
                name: storedFont.name,
                family,
                dataUrl: storedFont.dataUrl,
            });
        } catch (e) {
            console.warn('[FontUtils] Failed to load stored font:', storedFont.name, e);
        }
    }

    return fonts;
}

async function getLegacyCustomFonts(): Promise<CustomFont[]> {
    const fonts: CustomFont[] = [];
    await AppStorage.customFonts.iterate<CustomFont, void>((font) => {
        fonts.push(font);
    });
    return fonts;
}

async function saveStoredFont(font: CustomFont): Promise<void> {
    await requestManager.getClient().fetcher(FONT_STORAGE_ENDPOINT, {
        httpMethod: HttpMethod.POST,
        data: {
            name: font.name,
            family: font.family,
            dataUrl: font.dataUrl,
        },
    });
}

async function migrateLegacyFonts(serverFonts: CustomFont[]): Promise<CustomFont[]> {
    const legacyFonts = await getLegacyCustomFonts();
    if (legacyFonts.length === 0) {
        return serverFonts;
    }

    const knownFamilies = new Set(serverFonts.map(font => font.family));
    for (const legacyFont of legacyFonts) {
        if (!knownFamilies.has(legacyFont.family)) {
            try {
                await saveStoredFont(legacyFont);
                serverFonts.push(legacyFont);
                knownFamilies.add(legacyFont.family);
            } catch (e) {
                console.warn('[FontUtils] Failed to migrate legacy font:', legacyFont.name, e);
                continue;
            }
        }

        try {
            await AppStorage.customFonts.removeItem(legacyFont.family);
        } catch (e) {
            console.warn('[FontUtils] Failed to clear migrated legacy font:', legacyFont.name, e);
        }
    }

    return serverFonts;
}

/**
 * Try to read font name from font file metadata
 * Falls back to filename without extension
 */
export async function getFontName(file: File): Promise<string> {
    try {
        // Try to read OpenType/TrueType name table
        const buffer = await file.arrayBuffer();
        const view = new DataView(buffer);
        
        // Check for TrueType/OpenType signature
        const signature = view.getUint32(0, false);
        
        // TrueType (0x00010000 or 'true') or OpenType (0x4F54544F 'OTTO')
        if (signature === 0x00010000 || signature === 0x74727565 || signature === 0x4F54544F) {
            // Parse font tables to find name table
            const numTables = view.getUint16(4, false);
            
            // Table directory starts at offset 12
            for (let i = 0; i < numTables; i++) {
                const tableOffset = 12 + (i * 16);
                const tableTag = String.fromCharCode(
                    view.getUint8(tableOffset),
                    view.getUint8(tableOffset + 1),
                    view.getUint8(tableOffset + 2),
                    view.getUint8(tableOffset + 3)
                );
                
                if (tableTag === 'name') {
                    const nameTableOffset = view.getUint32(tableOffset + 8, false);
                    const name = parseNameTable(view, nameTableOffset);
                    if (name) return name;
                }
            }
        }
    } catch (e) {
        console.warn('[FontUtils] Could not read font metadata:', e);
    }
    
    // Fallback to filename without extension
    const nameWithoutExt = file.name.replace(/\.(ttf|otf|woff|woff2)$/i, '');
    return nameWithoutExt;
}

/**
 * Parse the 'name' table to find the font family name
 */
function parseNameTable(view: DataView, offset: number): string | null {
    try {
        const format = view.getUint16(offset, false);
        const count = view.getUint16(offset + 2, false);
        const stringOffset = view.getUint16(offset + 4, false);
        
        // Look for name ID 4 (Full font name) or 1 (Font family)
        for (let i = 0; i < count; i++) {
            const recordOffset = offset + 6 + (i * 12);
            const platformID = view.getUint16(recordOffset, false);
            const encodingID = view.getUint16(recordOffset + 2, false);
            const languageID = view.getUint16(recordOffset + 4, false);
            const nameID = view.getUint16(recordOffset + 6, false);
            const length = view.getUint16(recordOffset + 8, false);
            const stringOffsetRel = view.getUint16(recordOffset + 10, false);
            
            // Prefer English names (platform 3, encoding 1 = Windows Unicode)
            // or (platform 1, encoding 0 = Mac Roman)
            if ((nameID === 1 || nameID === 4) && 
                ((platformID === 3 && languageID === 0x0409) || // Windows English
                 (platformID === 1 && languageID === 0))) {    // Mac English
                const stringStart = offset + stringOffset + stringOffsetRel;
                return decodeString(view, stringStart, length, platformID);
            }
        }
    } catch (e) {
        console.warn('[FontUtils] Error parsing name table:', e);
    }
    
    return null;
}

/**
 * Decode string based on platform
 */
function decodeString(view: DataView, offset: number, length: number, platformID: number): string {
    const bytes: number[] = [];
    
    if (platformID === 3) {
        // Windows Unicode (UTF-16BE)
        for (let i = 0; i < length; i += 2) {
            const char = view.getUint16(offset + i, false);
            bytes.push(char);
        }
        return String.fromCharCode(...bytes);
    } else {
        // Mac Roman or other
        for (let i = 0; i < length; i++) {
            bytes.push(view.getUint8(offset + i));
        }
        return String.fromCharCode(...bytes);
    }
}

/**
 * Import a font file and load it into the document
 */
export async function importFontFile(file: File): Promise<CustomFont> {
    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
        throw new Error('Font file too large (max 50MB)');
    }
    
    // Validate file type
    const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!hasValidExt) {
        throw new Error('Invalid font file type. Supported: TTF, OTF, WOFF, WOFF2');
    }
    
    // Get font name
    const family = await getFontName(file);
    
    if (!family) {
        throw new Error('Could not extract font name');
    }
    
    // Convert to data URL
    const arrayBuffer = await file.arrayBuffer();
    
    // Determine MIME type
    let mimeType = file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
        const ext = file.name.toLowerCase().split('.').pop();
        switch (ext) {
            case 'ttf': mimeType = 'font/ttf'; break;
            case 'otf': mimeType = 'font/otf'; break;
            case 'woff': mimeType = 'font/woff'; break;
            case 'woff2': mimeType = 'font/woff2'; break;
            default: mimeType = 'application/octet-stream';
        }
    }
    
    const blob = new Blob([arrayBuffer], { type: mimeType });
    const dataUrl = await blobToDataUrl(blob);
    
    // Load font into document
    const fontFace = new FontFace(family, `url(${dataUrl})`);
    await fontFace.load();
    document.fonts.add(fontFace);
    
    return {
        name: file.name,
        family,
        dataUrl
    };
}

/**
 * Convert Blob to Data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Load all custom fonts from storage
 */
export async function loadCustomFonts(): Promise<CustomFont[]> {
    const fonts = await getAllCustomFonts();
    const loadPromises = fonts.map(async (font) => {
        try {
            await loadFontIntoDocument(font);
        } catch (e) {
            // Silent fail
        }
    });

    if (loadPromises.length > 0) {
        await Promise.all(loadPromises);
    }

    return fonts;
}

/**
 * Save a custom font to storage
 */
export async function saveCustomFont(font: CustomFont): Promise<void> {
    await saveStoredFont(font);
}

/**
 * Delete a custom font from storage
 */
export async function deleteCustomFont(font: Pick<CustomFont, 'family' | 'name'>): Promise<void> {
    await requestManager.getClient().fetcher(
        `${FONT_STORAGE_ENDPOINT}/${encodeURIComponent(font.name)}`,
        { httpMethod: HttpMethod.DELETE }
    );
    try {
        await AppStorage.customFonts.removeItem(font.family);
    } catch {
        // Ignore legacy cleanup failures.
    }

    // Remove from document fonts
    const fontFace = Array.from(document.fonts).find(f => f.family === font.family);
    if (fontFace) {
        document.fonts.delete(fontFace);
    }
}

/**
 * Get all custom fonts
 */
export async function getAllCustomFonts(): Promise<CustomFont[]> {
    try {
        const storedFonts = await fetchStoredFonts();
        const fonts = await parseStoredFonts(storedFonts);
        return await migrateLegacyFonts(fonts);
    } catch (e) {
        console.warn('[FontUtils] Failed to load server-backed fonts:', e);
        return await getLegacyCustomFonts();
    }
}
