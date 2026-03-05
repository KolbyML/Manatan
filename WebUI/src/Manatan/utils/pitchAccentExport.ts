import { getKanaMorae } from '@/Manatan/components/Pronunciation';

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

export const renderAnkiPitchAccents = (
    pitchAccents: PitchAccentLike[] | undefined,
    fallbackReading: string,
): string => {
    if (!pitchAccents || pitchAccents.length === 0) {
        return '';
    }

    const items = pitchAccents.flatMap((accent) => {
        const reading = accent.reading || fallbackReading;
        if (!accent.pitches || accent.pitches.length === 0 || !reading) {
            return [];
        }
        return accent.pitches.map((pitch) => renderPitchTextHtml(reading, pitch)).filter((html) => html.length > 0);
    });

    if (items.length === 0) {
        return '';
    }
    if (items.length === 1) {
        return items[0];
    }

    return `<ol>${items.map((item) => `<li>${item}</li>`).join('')}</ol>`;
};
