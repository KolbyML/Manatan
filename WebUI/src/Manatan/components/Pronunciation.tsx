import React from 'react';
import type { DictionaryResult, DictionaryDefinition } from '@/Manatan/types';

export interface PitchInfo {
    position: number;
    pattern?: string;
    nasal?: number[];
    devoice?: number[];
    tags?: string[];
}

export interface PitchAccent {
    dictionaryName: string;
    reading: string;
    pitches: PitchInfo[];
}

export interface IpaData {
    dictionaryName: string;
    reading: string;
    transcriptions: { ipa: string; tags?: string[] }[];
}

export function extractPronunciationData(entry: DictionaryResult): {
    pitchAccents: PitchAccent[];
    ipa: IpaData[];
} {
    const pitchAccents: PitchAccent[] = [];
    const ipa: IpaData[] = [];

    if (!entry.glossary) {
        return { pitchAccents, ipa };
    }

    // First check if pitchAccents/ipa are already populated from new format
    if (entry.pitchAccents && entry.pitchAccents.length > 0) {
        pitchAccents.push(...entry.pitchAccents);
    }
    if (entry.ipa && entry.ipa.length > 0) {
        ipa.push(...entry.ipa);
    }

    // Parse from old format: pitch accent data embedded in glossary content strings
    // Pattern: "［0］", "［1］", "［2］" or "[0]", "[1]" etc.
    // Also look for patterns like "○○○テキ" (heiban) or "○ Tex" format
    const pitchPattern = /[［\[](\d+)[］\]]/;
    const pitchHLPattern = /([HL]{2,})/;
    
    for (const def of entry.glossary) {
        if (!def.content || def.content.length === 0) continue;

        for (const contentItem of def.content) {
            const content = typeof contentItem === 'string' ? contentItem : '';
            if (!content) continue;

            // Check for pitch notation like "［0］" or "［1］"
            const pitchMatch = content.match(pitchPattern);
            // Check for H/L pattern like "LHLL"
            const hlMatch = content.match(pitchHLPattern);

            if (pitchMatch || hlMatch) {
                let position: number | string;
                if (hlMatch) {
                    position = hlMatch[1]; // Use H/L pattern as string
                } else if (pitchMatch) {
                    position = parseInt(pitchMatch[1], 10);
                } else {
                    continue;
                }

                // Extract reading from content if possible
                // Format often like "〜てき【的】" or "ねこ【猫】"
                const readingMatch = content.match(/^(.+?)【/);
                const reading = readingMatch ? readingMatch[1] : entry.reading;

                // Only add if we have a valid position and from a pitch accent dictionary
                if (!isNaN(Number(position)) || typeof position === 'string') {
                    // Check if this dictionary is known for pitch accents
                    const dictName = def.dictionaryName;
                    const isPitchDict = dictName.includes('アクセント') || 
                                       dictName.includes('Pitch') ||
                                       dictName.includes('Accent');

                    if (isPitchDict || pitchMatch || hlMatch) {
                        pitchAccents.push({
                            dictionaryName: dictName,
                            reading: reading,
                            pitches: [{
                                position: typeof position === 'string' ? 0 : position,
                                pattern: typeof position === 'string' ? position : undefined,
                                nasal: [],
                                devoice: [],
                                tags: def.tags || []
                            }]
                        });
                    }
                }
            }
        }
    }

    return { pitchAccents, ipa };
}

const SMALL_KANA = new Set('ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ');

export function getKanaMorae(text: string): string[] {
    const morae: string[] = [];
    for (const char of text) {
        if (SMALL_KANA.has(char) && morae.length > 0) {
            morae[morae.length - 1] += char;
        } else {
            morae.push(char);
        }
    }
    return morae;
}

export function isMoraPitchHigh(moraIndex: number, position: number | string): boolean {
    if (typeof position === 'string') {
        return position[moraIndex] === 'H';
    }
    switch (position) {
        case 0: return moraIndex > 0;
        case 1: return moraIndex < 1;
        default: return moraIndex > 0 && moraIndex < position;
    }
}

export function getDownstepPosition(pattern: string): number {
    for (let i = 1; i < pattern.length; i++) {
        if (pattern[i - 1] === 'H' && pattern[i] === 'L') return i;
    }
    return pattern.startsWith('L') ? 0 : -1;
}

const DIACRITIC_MAP: Record<string, { character: string; type: 'dakuten' | 'handakuten' }> = {
    'が': { character: 'か', type: 'dakuten' },
    'ぎ': { character: 'き', type: 'dakuten' },
    'ぐ': { character: 'く', type: 'dakuten' },
    'げ': { character: 'け', type: 'dakuten' },
    'ご': { character: 'こ', type: 'dakuten' },
    'ざ': { character: 'さ', type: 'dakuten' },
    'じ': { character: 'し', type: 'dakuten' },
    'ず': { character: 'す', type: 'dakuten' },
    'ぜ': { character: 'せ', type: 'dakuten' },
    'ぞ': { character: 'そ', type: 'dakuten' },
    'だ': { character: 'た', type: 'dakuten' },
    'ぢ': { character: 'ち', type: 'dakuten' },
    'づ': { character: 'つ', type: 'dakuten' },
    'で': { character: 'て', type: 'dakuten' },
    'ど': { character: 'と', type: 'dakuten' },
    'ば': { character: 'は', type: 'dakuten' },
    'び': { character: 'ひ', type: 'dakuten' },
    'ぶ': { character: 'ふ', type: 'dakuten' },
    'べ': { character: 'へ', type: 'dakuten' },
    'ぼ': { character: 'ほ', type: 'dakuten' },
    'ぱ': { character: 'は', type: 'handakuten' },
    'ぴ': { character: 'ひ', type: 'handakuten' },
    'ぷ': { character: 'ふ', type: 'handakuten' },
    'ぺ': { character: 'へ', type: 'handakuten' },
    'ぽ': { character: 'ほ', type: 'handakuten' },
    'ガ': { character: 'カ', type: 'dakuten' },
    'ギ': { character: 'キ', type: 'dakuten' },
    'グ': { character: 'ク', type: 'dakuten' },
    'ゲ': { character: 'ケ', type: 'dakuten' },
    'ゴ': { character: 'コ', type: 'dakuten' },
    'ザ': { character: 'サ', type: 'dakuten' },
    'ジ': { character: 'シ', type: 'dakuten' },
    'ズ': { character: 'ス', type: 'dakuten' },
    'ゼ': { character: 'セ', type: 'dakuten' },
    'ゾ': { character: 'ソ', type: 'dakuten' },
    'ダ': { character: 'タ', type: 'dakuten' },
    'ヂ': { character: 'チ', type: 'dakuten' },
    'ヅ': { character: 'ツ', type: 'dakuten' },
    'デ': { character: 'テ', type: 'dakuten' },
    'ド': { character: 'ト', type: 'dakuten' },
    'バ': { character: 'ハ', type: 'dakuten' },
    'ビ': { character: 'ヒ', type: 'dakuten' },
    'ブ': { character: 'フ', type: 'dakuten' },
    'ベ': { character: 'ヘ', type: 'dakuten' },
    'ボ': { character: 'ホ', type: 'dakuten' },
    'パ': { character: 'ハ', type: 'handakuten' },
    'ピ': { character: 'ヒ', type: 'handakuten' },
    'プ': { character: 'フ', type: 'handakuten' },
    'ペ': { character: 'ヘ', type: 'handakuten' },
    'ポ': { character: 'ホ', type: 'handakuten' },
};

function getKanaDiacriticInfo(char: string) {
    return DIACRITIC_MAP[char] || null;
}

const CSS = `
.pronunciation-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 6px;
}
.pronunciation-group-tag {
    font-size: 0.7em;
    color: #888;
    background: rgba(139, 92, 246, 0.2);
    padding: 2px 6px;
    border-radius: 3px;
    flex-shrink: 0;
}
.pronunciation-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.pronunciation {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
}
.pronunciation-text {
    display: inline-flex;
    align-items: flex-end;
}
.pronunciation-mora {
    display: inline-block;
    position: relative;
    text-align: center;
    padding: 0.15em 0;
}
.pronunciation-mora[data-pitch="high"] {
    padding-top: 0;
}
.pronunciation-mora[data-pitch="low"] {
    padding-top: 0.5em;
}
.pronunciation-mora-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 0.125em;
    background-color: currentColor;
}
.pronunciation-mora[data-pitch="high"] .pronunciation-mora-line {
    top: 0;
}
.pronunciation-mora[data-pitch="low"] .pronunciation-mora-line {
    top: 0.375em;
}
.pronunciation-mora[data-pitch="high"][data-pitch-next="low"] .pronunciation-mora-line {
    right: 0;
    border-right: 0.125em solid var(--pitch-downstep-color, #e74c3c);
    height: 0.5em;
}
.pronunciation-character {
    display: inline;
}
.pronunciation-mora[data-devoice="true"] {
    color: #888;
}
.pronunciation-devoice-indicator {
    position: absolute;
    top: -0.25em;
    right: 0;
    font-size: 0.5em;
}
.pronunciation-devoice-indicator::before {
    content: "°";
}
.pronunciation-mora[data-nasal="true"] .pronunciation-character-group {
    position: relative;
}
.pronunciation-nasal-diacritic {
    position: absolute;
    top: -0.3em;
    left: 0.5em;
    font-size: 0.8em;
    color: var(--pitch-nasal-color, #3498db);
}
.pronunciation-nasal-indicator {
    position: absolute;
    bottom: -0.2em;
    left: 50%;
    transform: translateX(-50%);
    width: 0.3em;
    height: 0.3em;
    border-radius: 50%;
    background: var(--pitch-nasal-color, #3498db);
    opacity: 0.6;
}
.pronunciation-downstep-notation {
    font-family: monospace;
    font-size: 0.85em;
    color: #888;
    margin-left: 0.25em;
}
.pronunciation-downstep-notation-number {
    color: var(--pitch-downstep-color, #e74c3c);
    font-weight: bold;
}
.pronunciation-graph {
    display: block;
}
.pronunciation-graph-line {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
}
.pronunciation-graph-line-tail {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-dasharray: 2 2;
}
.pronunciation-graph-dot {
    fill: currentColor;
    stroke: currentColor;
    stroke-width: 1.5;
}
.pronunciation-graph-dot-downstep1 {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
}
.pronunciation-graph-dot-downstep2 {
    fill: currentColor;
}
.pronunciation-graph-triangle {
    fill: currentColor;
}
.pronunciation-tag-list {
    display: flex;
    gap: 4px;
    margin-left: 4px;
}
.pronunciation-tag {
    font-size: 0.65em;
    color: #aaa;
    background: rgba(255, 255, 255, 0.1);
    padding: 1px 4px;
    border-radius: 2px;
}
.pronunciation-ipa {
    font-family: 'Noto Sans', 'Doulos SIL', sans-serif;
    font-size: 1.05em;
    color: #9ecfff;
}
.pronunciation-section {
    margin: 8px 0;
    padding: 8px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}
`;

let cssInjected = false;
function injectCSS() {
    if (cssInjected || typeof document === 'undefined') return;
    const styleId = 'pronunciation-styles';
    if (document.getElementById(styleId)) {
        cssInjected = true;
        return;
    }
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = CSS;
    document.head.appendChild(style);
    cssInjected = true;
}

interface PitchTextProps {
    morae: string[];
    position: number | string;
    nasalPositions: number[];
    devoicePositions: number[];
}

const PitchText: React.FC<PitchTextProps> = ({ morae, position, nasalPositions, devoicePositions }) => {
    const nasalSet = new Set(nasalPositions);
    const devoiceSet = new Set(devoicePositions);

    return (
        <span className="pronunciation-text">
            {morae.map((mora, i) => {
                const i1 = i + 1;
                const highPitch = isMoraPitchHigh(i, position);
                const highPitchNext = isMoraPitchHigh(i + 1, position);
                const nasal = nasalSet.has(i1);
                const devoice = devoiceSet.has(i1);

                const characters = [...mora];
                let characterContent: React.ReactNode;

                if (nasal && characters.length > 0) {
                    const firstChar = characters[0];
                    const diacriticInfo = getKanaDiacriticInfo(firstChar);

                    if (diacriticInfo) {
                        characterContent = (
                            <span className="pronunciation-character-group">
                                <span className="pronunciation-character" data-original-text={firstChar}>
                                    {diacriticInfo.character}
                                </span>
                                <span className="pronunciation-nasal-diacritic">{'\u309a'}</span>
                                <span className="pronunciation-nasal-indicator" />
                                {characters.slice(1).map((c, ci) => (
                                    <span key={ci} className="pronunciation-character">{c}</span>
                                ))}
                            </span>
                        );
                    } else {
                        characterContent = (
                            <span className="pronunciation-character-group">
                                {characters.map((c, ci) => (
                                    <span key={ci} className="pronunciation-character">{c}</span>
                                ))}
                                <span className="pronunciation-nasal-indicator" />
                            </span>
                        );
                    }
                } else {
                    characterContent = characters.map((c, ci) => (
                        <span key={ci} className="pronunciation-character">{c}</span>
                    ));
                }

                return (
                    <span
                        key={i}
                        className="pronunciation-mora"
                        data-position={i}
                        data-pitch={highPitch ? 'high' : 'low'}
                        data-pitch-next={highPitchNext ? 'high' : 'low'}
                        data-devoice={devoice ? 'true' : undefined}
                        data-nasal={nasal ? 'true' : undefined}
                    >
                        {characterContent}
                        {devoice && <span className="pronunciation-devoice-indicator" />}
                        <span className="pronunciation-mora-line" />
                    </span>
                );
            })}
        </span>
    );
};

interface PitchGraphProps {
    morae: string[];
    position: number | string;
}

const PitchGraph: React.FC<PitchGraphProps> = ({ morae, position }) => {
    const ii = morae.length;
    if (ii <= 0) return null;

    const spacing = 20;
    const viewBoxWidth = spacing * (ii + 1);
    const pathPoints: string[] = [];
    const dots: React.ReactNode[] = [];

    for (let i = 0; i < ii; i++) {
        const highPitch = isMoraPitchHigh(i, position);
        const highPitchNext = isMoraPitchHigh(i + 1, position);
        const x = i * spacing + spacing / 2;
        const y = highPitch ? 10 : 30;

        if (highPitch && !highPitchNext) {
            dots.push(
                <React.Fragment key={i}>
                    <circle className="pronunciation-graph-dot-downstep1" cx={x} cy={y} r={3.5} />
                    <circle className="pronunciation-graph-dot-downstep2" cx={x} cy={y} r={1.5} />
                </React.Fragment>
            );
        } else {
            dots.push(
                <circle key={i} className="pronunciation-graph-dot" cx={x} cy={y} r={3} />
            );
        }

        pathPoints.push(`${x} ${y}`);
    }

    const tailPoints = [pathPoints[pathPoints.length - 1]];
    const highPitchTail = isMoraPitchHigh(ii, position);
    const tailX = ii * spacing + spacing / 2;
    const tailY = highPitchTail ? 10 : 30;
    tailPoints.push(`${tailX} ${tailY}`);

    return (
        <svg
            className="pronunciation-graph"
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${viewBoxWidth} 40`}
            style={{ width: `${viewBoxWidth * 0.8}px`, height: '32px' }}
        >
            <path className="pronunciation-graph-line" d={`M${pathPoints.join(' L')}`} />
            <path className="pronunciation-graph-line-tail" d={`M${tailPoints.join(' L')}`} />
            {dots}
            <path className="pronunciation-graph-triangle" d="M0 4 L5 -4 L-5 -4 Z" transform={`translate(${tailX},${tailY})`} />
        </svg>
    );
};

interface DownstepNotationProps {
    position: number | string;
}

const DownstepNotation: React.FC<DownstepNotationProps> = ({ position }) => {
    const downstep = typeof position === 'string' ? getDownstepPosition(position) : position;

    return (
        <span className="pronunciation-downstep-notation" data-downstep-position={downstep}>
            <span className="pronunciation-downstep-notation-prefix">[</span>
            <span className="pronunciation-downstep-notation-number">{downstep}</span>
            <span className="pronunciation-downstep-notation-suffix">]</span>
        </span>
    );
};

export interface PronunciationSectionProps {
    reading: string;
    pitchAccents?: PitchAccent[];
    ipa?: IpaData[];
    showGraph?: boolean;
    showText?: boolean;
    showNotation?: boolean;
}

export const PronunciationSection: React.FC<PronunciationSectionProps> = ({
    reading,
    pitchAccents = [],
    ipa = [],
    showGraph = true,
    showText = true,
    showNotation = true,
}) => {
    React.useEffect(() => {
        injectCSS();
    }, []);

    const hasPitch = pitchAccents.length > 0;
    const hasIpa = ipa.length > 0;

    if (!hasPitch && !hasIpa) return null;

    return (
        <div className="pronunciation-section">
            {pitchAccents.map((pa, i) => {
                const effectiveReading = pa.reading || reading;
                const morae = getKanaMorae(effectiveReading);

                return (
                    <div key={i} className="pronunciation-group" data-dictionary={pa.dictionaryName}>
                        <span className="pronunciation-group-tag">{pa.dictionaryName}</span>
                        <div className="pronunciation-list">
                            {pa.pitches.map((pitch, j) => {
                                const pos = pitch.pattern && pitch.pattern.length > 0
                                    ? pitch.pattern
                                    : pitch.position;
                                const nasalPositions = pitch.nasal || [];
                                const devoicePositions = pitch.devoice || [];

                                return (
                                    <div key={j} className="pronunciation">
                                        {showNotation && <DownstepNotation position={pos} />}
                                        {showText && (
                                            <PitchText
                                                morae={morae}
                                                position={pos}
                                                nasalPositions={nasalPositions}
                                                devoicePositions={devoicePositions}
                                            />
                                        )}
                                        {showGraph && <PitchGraph morae={morae} position={pos} />}
                                        {pitch.tags && pitch.tags.length > 0 && (
                                            <div className="pronunciation-tag-list">
                                                {pitch.tags.map((tag, k) => (
                                                    <span key={k} className="pronunciation-tag">{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {ipa.map((ipaData, i) => (
                <div key={i} className="pronunciation-group" data-dictionary={ipaData.dictionaryName}>
                    <span className="pronunciation-group-tag">{ipaData.dictionaryName}</span>
                    <div className="pronunciation-list">
                        {ipaData.transcriptions.map((t, j) => (
                            <div key={j} className="pronunciation">
                                <span className="pronunciation-ipa">{t.ipa}</span>
                                {t.tags && t.tags.length > 0 && (
                                    <div className="pronunciation-tag-list">
                                        {t.tags.map((tag, k) => (
                                            <span key={k} className="pronunciation-tag">{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PronunciationSection;
