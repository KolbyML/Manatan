import { getDownstepPosition, getKanaMorae } from '@/Manatan/components/Pronunciation';

type PitchInfoLike = {
    position?: number;
    pattern?: string;
    nasal?: number[];
    devoice?: number[];
};

type PitchAccentLike = {
    dictionaryName?: string;
    reading?: string;
    pitches?: PitchInfoLike[];
};

type TermTagLike = string | { name?: string; label?: string; tag?: string; value?: string } | unknown;

const isMoraPitchHigh = (moraIndex: number, position: number | string): boolean => {
    if (typeof position === 'string') {
        return position[moraIndex] === 'H';
    }
    switch (position) {
        case 0:
            return moraIndex > 0;
        case 1:
            return moraIndex < 1;
        default:
            return moraIndex > 0 && moraIndex < position;
    }
};

const escapeHtml = (value: string): string =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const getKanaDiacriticInfo = (char: string): { character: string; type: 'dakuten' | 'handakuten' } | null => {
    if (!char) {
        return null;
    }

    const decomposed = char.normalize('NFD');
    if (decomposed.length < 2) {
        return null;
    }

    const baseChar = decomposed[0];
    const marks = decomposed.slice(1);
    if (marks.includes('\u3099')) {
        return { character: baseChar, type: 'dakuten' };
    }
    if (marks.includes('\u309A')) {
        return { character: baseChar, type: 'handakuten' };
    }
    return null;
};

const renderCharacter = (char: string, originalText?: string): string => {
    const originalAttr = originalText ? ` data-original-text="${escapeHtml(originalText)}"` : '';
    return `<span class="pronunciation-character"${originalAttr}>${escapeHtml(char)}</span>`;
};

const renderMoraContent = (mora: string, nasal: boolean): { html: string; moraOriginalText?: string } => {
    const characters = Array.from(mora);
    if (!nasal || characters.length === 0) {
        return { html: characters.map((char) => renderCharacter(char)).join('') };
    }

    const firstChar = characters[0];
    const diacriticInfo = getKanaDiacriticInfo(firstChar);
    const firstCharHtml = renderCharacter(
        diacriticInfo ? diacriticInfo.character : firstChar,
        diacriticInfo ? firstChar : undefined,
    );

    const groupHtml = [
        '<span class="pronunciation-character-group">',
        firstCharHtml,
        '<span class="pronunciation-nasal-diacritic">\u309a</span>',
        '<span class="pronunciation-nasal-indicator"></span>',
        '</span>',
    ].join('');

    const restHtml = characters
        .slice(1)
        .map((char) => renderCharacter(char))
        .join('');
    return {
        html: `${groupHtml}${restHtml}`,
        moraOriginalText: diacriticInfo ? mora : undefined,
    };
};

const renderPitchTextHtml = (reading: string, pitch: PitchInfoLike): string => {
    const morae = getKanaMorae(reading || '');
    if (morae.length === 0) {
        return '';
    }

    const position = pitch.pattern && pitch.pattern.length > 0 ? pitch.pattern : (pitch.position ?? 0);
    const nasal = pitch.nasal || [];
    const devoice = pitch.devoice || [];

    const moraHtml: string[] = [];
    morae.forEach((mora, index) => {
        const isHigh = isMoraPitchHigh(index, position);
        const hasNasal = nasal.includes(index + 1);
        const hasDevoice = devoice.includes(index + 1);
        const hasHighPitchNext = isMoraPitchHigh(index + 1, position);
        const { html: characterHtml, moraOriginalText } = renderMoraContent(mora, hasNasal);
        const attrs = [
            `data-position="${index}"`,
            `data-pitch="${isHigh ? 'high' : 'low'}"`,
            `data-pitch-next="${hasHighPitchNext ? 'high' : 'low'}"`,
            hasDevoice ? 'data-devoice="true"' : '',
            hasNasal ? 'data-nasal="true"' : '',
            moraOriginalText ? `data-original-text="${escapeHtml(moraOriginalText)}"` : '',
        ]
            .filter(Boolean)
            .join(' ');

        const devoiceHtml = hasDevoice ? '<span class="pronunciation-devoice-indicator"></span>' : '';
        moraHtml.push(
            `<span class="pronunciation-mora" ${attrs}>${characterHtml}${devoiceHtml}<span class="pronunciation-mora-line"></span></span>`,
        );
    });

    return `<span class="pronunciation-text">${moraHtml.join('')}</span>`;
};

const getPitchDownstepPosition = (pitch: PitchInfoLike): number => {
    if (pitch.pattern && pitch.pattern.length > 0) {
        return getDownstepPosition(pitch.pattern);
    }
    return pitch.position ?? 0;
};

const getFlattenedPitchItems = (
    pitchAccents: PitchAccentLike[] | undefined,
    fallbackReading: string,
): Array<{ reading: string; pitch: PitchInfoLike }> => {
    if (!pitchAccents || pitchAccents.length === 0) {
        return [];
    }

    return pitchAccents.flatMap((accent) => {
        const reading = accent.reading || fallbackReading;
        if (!accent.pitches || accent.pitches.length === 0 || !reading) {
            return [];
        }
        return accent.pitches.map((pitch) => ({ reading, pitch }));
    });
};

const renderPitchPositionHtml = (position: number): string => {
    return [
        `<span class="pronunciation-downstep-notation" data-downstep-position="${position}">`,
        '<span class="pronunciation-downstep-notation-prefix">[</span>',
        `<span class="pronunciation-downstep-notation-number">${position}</span>`,
        '<span class="pronunciation-downstep-notation-suffix">]</span>',
        '</span>',
    ].join('');
};

const getTermTagLabel = (tag: TermTagLike): string => {
    if (typeof tag === 'string') {
        return tag;
    }
    if (tag && typeof tag === 'object') {
        const record = tag as { name?: string; label?: string; tag?: string; value?: string };
        return record.name || record.label || record.tag || record.value || '';
    }
    return '';
};

const isNonNounVerbOrAdjective = (termTags: TermTagLike[] | undefined): boolean => {
    if (!termTags || termTags.length === 0) {
        return false;
    }

    let isVerbOrAdjective = false;
    let isSuruVerb = false;
    let isNoun = false;

    for (const tag of termTags) {
        const label = getTermTagLabel(tag).toLowerCase();
        const parts = label
            .split(/[\s,;/|]+/)
            .map((part) => part.trim())
            .filter(Boolean);

        for (const part of parts) {
            switch (part) {
                case 'v1':
                case 'v5':
                case 'vk':
                case 'vz':
                case 'adj-i':
                    isVerbOrAdjective = true;
                    break;
                case 'vs':
                    isVerbOrAdjective = true;
                    isSuruVerb = true;
                    break;
                case 'n':
                    isNoun = true;
                    break;
                default:
                    break;
            }
        }
    }

    return isVerbOrAdjective && !(isSuruVerb && isNoun);
};

const getPitchCategory = (reading: string, pitch: PitchInfoLike, isVerbOrAdjective: boolean): string | null => {
    const downstepPosition = getPitchDownstepPosition(pitch);
    if (downstepPosition === 0) {
        return 'heiban';
    }
    if (isVerbOrAdjective) {
        return downstepPosition > 0 ? 'kifuku' : null;
    }
    if (downstepPosition === 1) {
        return 'atamadaka';
    }
    if (downstepPosition > 1) {
        return downstepPosition >= getKanaMorae(reading).length ? 'odaka' : 'nakadaka';
    }
    return null;
};

export const renderAnkiPitchAccents = (
    pitchAccents: PitchAccentLike[] | undefined,
    fallbackReading: string,
): string => {
    const items = getFlattenedPitchItems(pitchAccents, fallbackReading)
        .map(({ reading, pitch }) => renderPitchTextHtml(reading, pitch))
        .filter((html) => html.length > 0);

    if (items.length === 0) {
        return '';
    }
    if (items.length === 1) {
        return items[0];
    }

    return `<ol>${items.map((item) => `<li>${item}</li>`).join('')}</ol>`;
};

export const renderAnkiPitchAccentPositions = (
    pitchAccents: PitchAccentLike[] | undefined,
    fallbackReading: string,
): string => {
    const items = getFlattenedPitchItems(pitchAccents, fallbackReading).map(({ pitch }) => {
        return renderPitchPositionHtml(getPitchDownstepPosition(pitch));
    });
    if (items.length === 0) {
        return '';
    }
    if (items.length === 1) {
        return items[0];
    }
    return `<ol>${items.map((item) => `<li>${item}</li>`).join('')}</ol>`;
};

export const renderAnkiPitchAccentCategories = (
    pitchAccents: PitchAccentLike[] | undefined,
    fallbackReading: string,
    termTags?: TermTagLike[],
): string => {
    const items = getFlattenedPitchItems(pitchAccents, fallbackReading);
    if (items.length === 0) {
        return '';
    }

    const verbOrAdjective = isNonNounVerbOrAdjective(termTags);
    const categories = new Set<string>();
    for (const { reading, pitch } of items) {
        const category = getPitchCategory(reading, pitch, verbOrAdjective);
        if (category) {
            categories.add(category);
        }
    }
    return [...categories].join(',');
};
