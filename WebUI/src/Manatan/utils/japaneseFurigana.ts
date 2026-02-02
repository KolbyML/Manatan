import type { YomitanLanguage } from '@/Manatan/types';

type FuriganaGroup = {
    isKana: boolean;
    text: string;
    textNormalized: string | null;
};

export type FuriganaSegment = {
    text: string;
    reading: string;
};

type FuriganaLookupResult = {
    matchLen?: number;
    headword?: string;
    reading?: string;
};

export type FuriganaLookupOptions = {
    language?: YomitanLanguage;
    groupingMode?: 'grouped' | 'flat';
};

const HIRAGANA_RANGE: [number, number] = [0x3040, 0x309f];
const KATAKANA_RANGE: [number, number] = [0x30a0, 0x30ff];
const KATAKANA_CONVERSION_RANGE: [number, number] = [0x30a1, 0x30f6];
const HIRAGANA_CONVERSION_RANGE: [number, number] = [0x3041, 0x3096];
const KATAKANA_SMALL_KA_CODE_POINT = 0x30f5;
const KATAKANA_SMALL_KE_CODE_POINT = 0x30f6;
const KANA_PROLONGED_SOUND_MARK_CODE_POINT = 0x30fc;

const KANA_RANGES: Array<[number, number]> = [HIRAGANA_RANGE, KATAKANA_RANGE];

const VOWEL_TO_KANA_MAPPING = new Map<string, string>([
    ['a', 'あかがさざただなはばぱまやらわ'],
    ['i', 'いきぎしじちぢにひびぴみり'],
    ['u', 'うくぐすずつづぬふぶぷむゆる'],
    ['e', 'えけげせぜてでねへべぺめれ'],
    ['o', 'おこごそぞとどのほぼぽもよろを'],
]);

const KANA_TO_VOWEL_MAPPING = new Map<string, string>();
for (const [vowel, characters] of VOWEL_TO_KANA_MAPPING) {
    for (const character of characters) {
        KANA_TO_VOWEL_MAPPING.set(character, vowel);
    }
}

const isCodePointInRange = (codePoint: number, [min, max]: [number, number]): boolean =>
    codePoint >= min && codePoint <= max;

const isCodePointInRanges = (codePoint: number, ranges: Array<[number, number]>): boolean =>
    ranges.some((range) => isCodePointInRange(codePoint, range));

const isCodePointKana = (codePoint: number): boolean => isCodePointInRanges(codePoint, KANA_RANGES);

const getProlongedHiragana = (previousCharacter: string): string | null => {
    switch (KANA_TO_VOWEL_MAPPING.get(previousCharacter)) {
        case 'a':
            return 'あ';
        case 'i':
            return 'い';
        case 'u':
            return 'う';
        case 'e':
            return 'え';
        case 'o':
            return 'う';
        default:
            return null;
    }
};

export const convertKatakanaToHiragana = (text: string, keepProlongedSoundMarks = false): string => {
    let result = '';
    const offset = HIRAGANA_CONVERSION_RANGE[0] - KATAKANA_CONVERSION_RANGE[0];
    for (let char of text) {
        const codePoint = char.codePointAt(0) as number;
        switch (codePoint) {
            case KATAKANA_SMALL_KA_CODE_POINT:
            case KATAKANA_SMALL_KE_CODE_POINT:
                break;
            case KANA_PROLONGED_SOUND_MARK_CODE_POINT:
                if (!keepProlongedSoundMarks && result.length > 0) {
                    const char2 = getProlongedHiragana(result[result.length - 1]);
                    if (char2 !== null) {
                        char = char2;
                    }
                }
                break;
            default:
                if (isCodePointInRange(codePoint, KATAKANA_CONVERSION_RANGE)) {
                    char = String.fromCodePoint(codePoint + offset);
                }
                break;
        }
        result += char;
    }
    return result;
};

const createFuriganaSegment = (text: string, reading: string): FuriganaSegment => ({ text, reading });

const getFuriganaKanaSegments = (text: string, reading: string): FuriganaSegment[] => {
    const textLength = text.length;
    const newSegments: FuriganaSegment[] = [];
    let start = 0;
    let state = reading[0] === text[0];
    for (let i = 1; i < textLength; ++i) {
        const newState = reading[i] === text[i];
        if (state === newState) {
            continue;
        }
        newSegments.push(
            createFuriganaSegment(text.substring(start, i), state ? '' : reading.substring(start, i)),
        );
        state = newState;
        start = i;
    }
    newSegments.push(
        createFuriganaSegment(text.substring(start, textLength), state ? '' : reading.substring(start, textLength)),
    );
    return newSegments;
};

const segmentizeFurigana = (
    reading: string,
    readingNormalized: string,
    groups: FuriganaGroup[],
    groupsStart: number,
): FuriganaSegment[] | null => {
    const groupCount = groups.length - groupsStart;
    if (groupCount <= 0) {
        return reading.length === 0 ? [] : null;
    }

    const group = groups[groupsStart];
    const { isKana, text } = group;
    const textLength = text.length;
    if (isKana) {
        const { textNormalized } = group;
        if (textNormalized !== null && readingNormalized.startsWith(textNormalized)) {
            const segments = segmentizeFurigana(
                reading.substring(textLength),
                readingNormalized.substring(textLength),
                groups,
                groupsStart + 1,
            );
            if (segments !== null) {
                if (reading.startsWith(text)) {
                    segments.unshift(createFuriganaSegment(text, ''));
                } else {
                    segments.unshift(...getFuriganaKanaSegments(text, reading));
                }
                return segments;
            }
        }
        return null;
    }

    let result: FuriganaSegment[] | null = null;
    for (let i = reading.length; i >= textLength; --i) {
        const segments = segmentizeFurigana(
            reading.substring(i),
            readingNormalized.substring(i),
            groups,
            groupsStart + 1,
        );
        if (segments !== null) {
            if (result !== null) {
                return null;
            }
            const segmentReading = reading.substring(0, i);
            segments.unshift(createFuriganaSegment(text, segmentReading));
            result = segments;
        }
        if (groupCount === 1) {
            break;
        }
    }
    return result;
};

const distributeFurigana = (term: string, reading: string): FuriganaSegment[] => {
    if (reading === term) {
        return [createFuriganaSegment(term, '')];
    }

    const groups: FuriganaGroup[] = [];
    let groupPre: FuriganaGroup | null = null;
    let isKanaPre: boolean | null = null;
    for (const c of term) {
        const codePoint = c.codePointAt(0) as number;
        const isKana = isCodePointKana(codePoint);
        if (isKana === isKanaPre) {
            (groupPre as FuriganaGroup).text += c;
        } else {
            groupPre = { isKana, text: c, textNormalized: null };
            groups.push(groupPre);
            isKanaPre = isKana;
        }
    }
    for (const group of groups) {
        if (group.isKana) {
            group.textNormalized = convertKatakanaToHiragana(group.text);
        }
    }

    const readingNormalized = convertKatakanaToHiragana(reading);
    const segments = segmentizeFurigana(reading, readingNormalized, groups, 0);
    if (segments !== null) {
        return segments;
    }

    return [createFuriganaSegment(term, reading)];
};

const getStemLength = (text1: string, text2: string): number => {
    const minLength = Math.min(text1.length, text2.length);
    if (minLength === 0) {
        return 0;
    }

    let i = 0;
    while (true) {
        const char1 = text1.codePointAt(i) as number;
        const char2 = text2.codePointAt(i) as number;
        if (char1 !== char2) {
            break;
        }
        const charLength = String.fromCodePoint(char1).length;
        i += charLength;
        if (i >= minLength) {
            if (i > minLength) {
                i -= charLength;
            }
            break;
        }
    }
    return i;
};

export const distributeFuriganaInflected = (
    term: string,
    reading: string,
    source: string,
): FuriganaSegment[] => {
    const termNormalized = convertKatakanaToHiragana(term);
    const readingNormalized = convertKatakanaToHiragana(reading);
    const sourceNormalized = convertKatakanaToHiragana(source);

    let mainText = term;
    let stemLength = getStemLength(termNormalized, sourceNormalized);

    const readingStemLength = getStemLength(readingNormalized, sourceNormalized);
    if (readingStemLength > 0 && readingStemLength >= stemLength) {
        mainText = reading;
        stemLength = readingStemLength;
        reading = `${source.substring(0, stemLength)}${reading.substring(stemLength)}`;
    }

    const segments: FuriganaSegment[] = [];
    if (stemLength > 0) {
        mainText = `${source.substring(0, stemLength)}${mainText.substring(stemLength)}`;
        const segments2 = distributeFurigana(mainText, reading);
        let consumed = 0;
        for (const segment of segments2) {
            const { text } = segment;
            const start = consumed;
            consumed += text.length;
            if (consumed < stemLength) {
                segments.push(segment);
            } else if (consumed === stemLength) {
                segments.push(segment);
                break;
            } else {
                if (start < stemLength) {
                    segments.push(createFuriganaSegment(mainText.substring(start, stemLength), ''));
                }
                break;
            }
        }
    }

    if (stemLength < source.length) {
        const remainder = source.substring(stemLength);
        const segmentCount = segments.length;
        if (segmentCount > 0 && segments[segmentCount - 1].reading.length === 0) {
            segments[segmentCount - 1].text += remainder;
        } else {
            segments.push(createFuriganaSegment(remainder, ''));
        }
    }

    return segments;
};

export const renderRubyFurigana = (segments: FuriganaSegment[]): string =>
    segments
        .map((segment) => {
            if (segment.reading && segment.reading !== segment.text) {
                return `<ruby>${segment.text}<rt>${segment.reading}</rt></ruby>`;
            }
            return segment.text;
        })
        .join('');

export const buildSentenceFuriganaFromLookup = async (
    sentence: string,
    lookup: (
        text: string,
        index: number,
        grouping: 'grouped' | 'flat',
        language?: YomitanLanguage,
    ) => Promise<FuriganaLookupResult[] | 'loading'>,
    options: FuriganaLookupOptions = {},
): Promise<string> => {
    if (!sentence) {
        return sentence;
    }

    const { language, groupingMode = 'grouped' } = options;
    if (language && language !== 'japanese') {
        return sentence;
    }

    const encoder = new TextEncoder();
    let result = '';
    let index = 0;

    while (index < sentence.length) {
        const byteIndex = encoder.encode(sentence.substring(0, index)).length;
        const results = await lookup(sentence, byteIndex, groupingMode, language);
        if (results === 'loading') {
            return sentence;
        }

        const best = Array.isArray(results) && results.length > 0 ? results[0] : null;
        const matchLen = best?.matchLen || 0;
        if (!best || matchLen <= 0) {
            result += sentence[index];
            index += 1;
            continue;
        }

        const end = Math.min(sentence.length, index + matchLen);
        const source = sentence.slice(index, end);

        if (best.reading && best.headword) {
            const segments = distributeFuriganaInflected(best.headword, best.reading, source);
            result += renderRubyFurigana(segments);
        } else {
            result += source;
        }
        index = end;
    }

    return result;
};
