/**
 * Text processing utilities for LN Reader
 */

// Regex to filter out non-Japanese/non-meaningful characters
// Matches anything that IS NOT: Numbers, Latin, Kanji, Kana, Punctuation
const isNotJapaneseRegex =
    /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu;

/**
 * Get valid character count from a text string
 */
export function getCharacterCount(text: string): number {
    if (!text) return 0;
    // Remove HTML tags first
    const plainText = text.replace(/<[^>]*>/g, '');
    // Remove noise
    const cleanText = plainText.replace(isNotJapaneseRegex, '');
    // Count unicode characters properly (handling surrogate pairs)
    return Array.from(cleanText).length;
}

/**
 * Calculate total book length by summing up chapters
 */
export function calculateBookStats(chapters: string[]): number[] {
    return chapters.map(html => getCharacterCount(html));
}

/**
 * Find the nearest sentence end from a specific text offset
 */
export function findSentenceEnd(text: string, offset: number): number {
    const delimiters = ['。', '！', '？', '!', '?', '\n', '」'];

    // Look ahead from offset to find the nearest delimiter
    for (let i = offset; i < text.length; i++) {
        if (delimiters.includes(text[i])) {
            return i + 1; // Include the delimiter
        }
        // Don't look too far (e.g. 200 chars)
        if (i - offset > 200) break;
    }

    return offset;
}