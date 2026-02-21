import React from 'react';
import type { DictionaryResult } from '@/Manatan/types';

export interface KanjiInfo {
    character: string;
    onyomi: string[];
    kunyomi: string[];
    tags: string[];
    meanings: string[];
    stats: Record<string, string>;
    frequencies: { dictionaryName: string; value: string }[];
}

export function extractKanjiData(entry: DictionaryResult): KanjiInfo[] {
    if (!entry.kanji || entry.kanji.length === 0) {
        return [];
    }
    return entry.kanji;
}

const CSS = `
.kanji-section {
    margin: 8px 0;
    padding: 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
}
.kanji-entry {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.kanji-character {
    font-size: 4em;
    font-weight: bold;
    text-align: center;
    line-height: 1.2;
}
.kanji-readings {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
}
.kanji-reading-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.kanji-reading-label {
    font-size: 0.7em;
    color: #888;
    text-transform: uppercase;
}
.kanji-reading-values {
    font-size: 0.9em;
}
.kanji-reading-value {
    margin-right: 8px;
}
.kanji-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
}
.kanji-tag {
    font-size: 0.7em;
    padding: 2px 6px;
    background: rgba(139, 92, 246, 0.2);
    border-radius: 3px;
    color: #a78bfa;
}
.kanji-meanings {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.kanji-meaning {
    font-size: 0.95em;
}
.kanji-stats {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 0.8em;
    color: #888;
}
.kanji-stat {
    display: flex;
    gap: 4px;
}
.kanji-stat-label {
    color: #666;
}
.kanji-frequencies {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.75em;
}
.kanji-freq {
    display: flex;
    gap: 4px;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 3px;
}
.kanji-freq-dict {
    color: #888;
}
.kanji-freq-value {
    color: #4ade80;
    font-weight: bold;
}
`;

let cssInjected = false;
function injectCSS() {
    if (cssInjected || typeof document === 'undefined') return;
    const styleId = 'kanji-styles';
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

interface KanjiEntryProps {
    kanji: KanjiInfo;
}

const KanjiEntry: React.FC<KanjiEntryProps> = ({ kanji }) => {
    return (
        <div className="kanji-entry">
            <div className="kanji-character">{kanji.character}</div>
            
            {kanji.tags.length > 0 && (
                <div className="kanji-tags">
                    {kanji.tags.map((tag, i) => (
                        <span key={i} className="kanji-tag">{tag}</span>
                    ))}
                </div>
            )}
            
            <div className="kanji-readings">
                {kanji.onyomi.length > 0 && (
                    <div className="kanji-reading-group">
                        <span className="kanji-reading-label">On'yomi</span>
                        <span className="kanji-reading-values">
                            {kanji.onyomi.map((r, i) => (
                                <span key={i} className="kanji-reading-value">{r}</span>
                            ))}
                        </span>
                    </div>
                )}
                {kanji.kunyomi.length > 0 && (
                    <div className="kanji-reading-group">
                        <span className="kanji-reading-label">Kun'yomi</span>
                        <span className="kanji-reading-values">
                            {kanji.kunyomi.map((r, i) => (
                                <span key={i} className="kanji-reading-value">{r}</span>
                            ))}
                        </span>
                    </div>
                )}
            </div>
            
            {kanji.meanings.length > 0 && (
                <div className="kanji-meanings">
                    {kanji.meanings.map((meaning, i) => (
                        <span key={i} className="kanji-meaning">{meaning}</span>
                    ))}
                </div>
            )}
            
            {Object.keys(kanji.stats).length > 0 && (
                <div className="kanji-stats">
                    {Object.entries(kanji.stats).map(([key, value], i) => (
                        <span key={i} className="kanji-stat">
                            <span className="kanji-stat-label">{key}:</span>
                            <span>{value}</span>
                        </span>
                    ))}
                </div>
            )}
            
            {kanji.frequencies.length > 0 && (
                <div className="kanji-frequencies">
                    {kanji.frequencies.map((freq, i) => (
                        <span key={i} className="kanji-freq">
                            <span className="kanji-freq-dict">{freq.dictionaryName}:</span>
                            <span className="kanji-freq-value">{freq.value}</span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export interface KanjiSectionProps {
    kanji: KanjiInfo[];
}

export const KanjiSection: React.FC<KanjiSectionProps> = ({ kanji }) => {
    React.useEffect(() => {
        injectCSS();
    }, []);

    if (!kanji || kanji.length === 0) return null;

    return (
        <div className="kanji-section">
            {kanji.map((k, i) => (
                <KanjiEntry key={i} kanji={k} />
            ))}
        </div>
    );
};

export default KanjiSection;
