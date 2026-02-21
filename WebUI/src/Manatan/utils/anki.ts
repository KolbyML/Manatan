/**
 * Updated AnkiConnect API call with automatic permission handshake
 */
import { getDownscaledSize } from './image';

const ANKI_LOG_COOLDOWN_MS = 60000;
let lastAnkiLogAt = 0;

const isConnectionError = (error: any): boolean => {
    if (!error) return false;
    const message = String(error?.message ?? error);
    if (error instanceof TypeError && message.includes('Failed to fetch')) {
        return true;
    }
    return (
        message.includes('ERR_CONNECTION_REFUSED') ||
        message.includes('Connection refused') ||
        message.includes('NetworkError')
    );
};

export const logAnkiError = (message: string, error: any) => {
    if (isConnectionError(error)) {
        return;
    }
    const now = Date.now();
    if (now - lastAnkiLogAt < ANKI_LOG_COOLDOWN_MS) {
        return;
    }
    lastAnkiLogAt = now;
    console.warn(message, error);
};

async function ankiConnect(
    action: string,
    params: Record<string, any>,
    url: string,
) {
    const timeoutMs = 20000;
    const fetchWithTimeout = async (body: Record<string, any>) => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                method: "POST",
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            return json.result;
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                throw new Error('AnkiConnect request timed out. Make sure AnkiDroid is running and permission is granted.');
            }
            throw error;
        } finally {
            window.clearTimeout(timeout);
        }
    };

    const execute = async () => fetchWithTimeout({ action, params, version: 6 });

    try {
        return await execute();
    } catch (e: any) {
        // If fetch fails, it is likely a CORS block. Attempt handshake.
        try {
            const permResult = await fetchWithTimeout({ action: "requestPermission", version: 6 });
            if (permResult && permResult.permission === 'granted') {
                return await execute();
            }
        } catch (handshakeError) {
            logAnkiError("Anki handshake failed", handshakeError);
        }

        // Standard error handling if handshake doesn't resolve the issue
        const errorMessage = e?.message ?? String(e);
        if (e instanceof TypeError && errorMessage.includes("Failed to fetch")) {
            throw new Error("Connection blocked. Please click 'Yes' on the Anki permission popup.");
        }
        throw new Error(errorMessage);
    }
}
/**
 * Check connection and get version
 */
export async function getAnkiVersion(url: string) {
    try {
        const ver = await ankiConnect("version", {}, url);
        return { ok: true, version: ver };
    } catch (e) {
        return { ok: false, error: e };
    }
}

/**
 * Get all deck names
 */
export async function getDeckNames(url: string): Promise<string[]> {
    return await ankiConnect("deckNames", {}, url);
}

/**
 * Get all model names (Card Types)
 */
export async function getModelNames(url: string): Promise<string[]> {
    return await ankiConnect("modelNames", {}, url);
}

/**
 * Get fields for a specific model
 */
export async function getModelFields(url: string, modelName: string): Promise<string[]> {
    return await ankiConnect("modelFieldNames", { modelName }, url);
}

/**
 * Find notes based on a query
 */
export async function findNotes(url: string, query: string): Promise<number[]> {
    const res = await ankiConnect("findNotes", { query }, url);
    return res || [];
}

/**
 * Open the Anki Browser to a specific query
 */
export async function guiBrowse(url: string, query: string) {
    return await ankiConnect("guiBrowse", { query }, url);
}

/**
 * Add a new note
 */
export async function addNote(
    url: string, 
    deckName: string, 
    modelName: string, 
    fields: Record<string, string>, 
    tags: string[] = [],
    picture?: { url?: string; data?: string; filename: string; fields: string[] },
    audio?: { url?: string; data?: string; filename: string; fields: string[] } | Array<{ url?: string; data?: string; filename: string; fields: string[] }>
) {
    const params: any = {
        note: {
            deckName,
            modelName,
            fields,
            tags,
            options: {
                allowDuplicate: false,
                duplicateScope: 'deck'
            }
        }
    };

    if (picture) {
        params.note.picture = [picture];
    }

    if (audio) {
        params.note.audio = Array.isArray(audio) ? audio : [audio];
    }

    return await ankiConnect("addNote", params, url);
}

/**
 * Get the most recent card ID created today
 */
async function getLastCardId(url: string) {
    const notesToday = await ankiConnect(
        "findNotes",
        { query: "added:1" },
        url,
    );
    if (!notesToday || !Array.isArray(notesToday)) {
        return undefined;
    }
    const id = notesToday.sort().at(-1);
    return id;
}

/**
 * Calculate card age in minutes
 */
function getCardAgeInMin(id: number) {
    return Math.floor((Date.now() - id) / 60000);
}

/**
 * Fetch image, downscale it if it exceeds max dimensions (keeping aspect ratio), 
 * and convert to base64 webp using Image element (better CORS handling)
 */
export async function imageUrlToBase64Webp(
    imageUrl: string,
    quality: number = 0.92,
    maxWidth?: number,
    maxHeight?: number
): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image();
        // Use anonymous to attempt to get CORS headers, but handle failure
        img.crossOrigin = "anonymous";
        
        img.onload = () => {
            try {
                const { width, height } = getDownscaledSize(img.width, img.height, maxWidth, maxHeight);

                const canvas = new OffscreenCanvas(width, height);
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('No context');

                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.convertToBlob({ type: 'image/webp', quality })
                    .then(blob => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = () => resolve(null);
                        reader.readAsDataURL(blob);
                    })
                    .catch(err => {
                        console.error("Blob conversion failed", err);
                        resolve(null);
                    });
            } catch (e) {
                console.error("Canvas operation failed (likely tainted)", e);
                resolve(null);
            }
        };

        img.onerror = () => {
            console.error("Failed to load image for Anki conversion");
            resolve(null);
        };

        img.src = imageUrl;
    });
}

/**
 * HTML inheritance logic adapted from asbplayer
 * Original Author: killergerbah
 * License: MIT
 * Source: https://github.com/killergerbah/asbplayer
 */


const htmlTagRegexString = '<([^/ >])*[^>]*>(.*?)</\\1>';

// Given <a><b>content</b></a> return ['<a><b>content</b></a>', '<b>content</b>', 'content']
const tagContent = (html: string) => {
    const htmlTagRegex = new RegExp(htmlTagRegexString);
    let content = html;
    let contents = [html];

    while (true) {
        const match = htmlTagRegex.exec(content);

        if (match === null || match.length < 3) {
            break;
        }

        content = match[2];
        contents.push(content);
    }

    return contents;
};

export const inheritHtmlMarkup = (original: string, markedUp: string) => {
    // If there is no markup to inherit, just return the original plain text
    if (!markedUp) return original;
    
    const htmlTagRegex = new RegExp(htmlTagRegexString, 'ig');
    const markedUpWithoutBreaklines = markedUp.replaceAll('<br>', '');
    let inherited = original;

    // Safety brake to prevent infinite loops if regex fails to advance
    let safetyCounter = 0; 

    while (safetyCounter++ < 100) {
        const match = htmlTagRegex.exec(markedUpWithoutBreaklines);

        if (match === null || match.length < 3) {
            break;
        }

        let newInherited = inherited;

        // Only try to apply the tag if the new string doesn't already have this exact tag+content
        if (!inherited.includes(match[0])) {
            const candidateTargets = tagContent(match[2]);

            // Try to find the inner text in the new string and wrap it
            for (const target of candidateTargets) {
                // Skip very short targets to avoid accidentally bolding single letters like "a" or "I"
                if (target.trim().length < 2 && !target.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/)) {
                     continue; 
                }
                
                // If we find the text content in our new string, apply the tag from the match
                if (inherited.includes(target)) {
                    newInherited = inherited.replace(target, match[0]); 
                }

                if (newInherited !== inherited) {
                    break;
                }
            }
        }

        inherited = newInherited;
    }

    return inherited;
};


/**
 * Update the last created Anki card with image and/or sentence
 */
export async function updateLastCard(
    ankiConnectUrl: string,
    imageUrl: string | undefined, 
    sentence: string,
    pictureField: string,
    sentenceField: string,
    quality: number,
    preEncodedBase64?: string,
    audioField?: string,
    audioBase64?: string,
    downscaleMaxWidth?: number,
    downscaleMaxHeight?: number
) {
    // Find the last card
    const id = await getLastCardId(ankiConnectUrl);

    if (!id) {
        throw new Error("Could not find recent card (no cards created today)");
    }

    if (getCardAgeInMin(id) >= 5) {
        throw new Error("Card created over 5 minutes ago");
    }

    const fields: Record<string, any> = {};
    
    // Handle sentence field (if specified)
    if (sentenceField && sentenceField.trim() && sentence) {
        try {
            const noteInfo = await ankiConnect('notesInfo', { notes: [id] }, ankiConnectUrl);
            
            let finalSentence = sentence;

            // If the field exists in Anki, try to merge its HTML tags
            if (noteInfo && noteInfo[0] && noteInfo[0].fields && noteInfo[0].fields[sentenceField]) {
                const currentAnkiText = noteInfo[0].fields[sentenceField].value;
                finalSentence = inheritHtmlMarkup(sentence, currentAnkiText);
            }

            fields[sentenceField] = finalSentence;

        } catch (e) {
            console.warn("Failed to fetch existing note info, overwriting sentence without preserving HTML.", e);
            fields[sentenceField] = sentence;
        }
    }
    
    const updatePayload: any = {
        note: {
            id,
            fields,
        },
    };

    // Handle picture field (if specified)
    if (pictureField && pictureField.trim()) {
        let rawData: string | null = null;

        if (preEncodedBase64) {
            rawData = preEncodedBase64.includes('base64,') 
                ? preEncodedBase64.split(';base64,')[1] 
                : preEncodedBase64;
        } else if (imageUrl) {
            const fullBase64 = await imageUrlToBase64Webp(imageUrl, quality, downscaleMaxWidth, downscaleMaxHeight);
            if (!fullBase64) throw new Error("Failed to process image (CORS or Load Error)");
            rawData = fullBase64.split(';base64,')[1];
        }

        if (rawData) {
            // Clear existing image first
            fields[pictureField] = ""; 
            updatePayload.note.picture = {
                filename: `manatan_${id}.webp`,
                data: rawData,
                fields: [pictureField],
            };
        }
    }

    // Handle audio field (if specified)
    if (audioField && audioField.trim() && audioBase64) {
        const rawAudio = audioBase64.includes('base64,')
            ? audioBase64.split(';base64,')[1]
            : audioBase64;

        if (rawAudio) {
            fields[audioField] = '';
            const extension = audioBase64.startsWith('data:audio/mp4')
                ? 'm4a'
                : audioBase64.startsWith('data:audio/ogg')
                    ? 'ogg'
                    : audioBase64.startsWith('data:audio/wav')
                        ? 'wav'
                        : 'webm';
            updatePayload.note.audio = {
                filename: `manatan_audio_${id}.${extension}`,
                data: rawAudio,
                fields: [audioField],
            };
        }
    }

    await ankiConnect("updateNoteFields", updatePayload, ankiConnectUrl);
}
