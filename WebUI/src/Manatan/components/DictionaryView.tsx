import React, { useState, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@mui/material/styles';
import { useOCR } from '@/Manatan/context/OCRContext';
import { findNotes, addNote, guiBrowse, imageUrlToBase64Webp, logAnkiError } from '@/Manatan/utils/anki';
import { lookupYomitan } from '@/Manatan/utils/api';
import { buildSentenceFuriganaFromLookup } from '@/Manatan/utils/japaneseFurigana';
import {
    getWordAudioFilename,
    getWordAudioSourceLabel,
    getWordAudioSourceOptions,
    playAudioFailClick,
    playWordAudio,
    resolveWordAudioUrl,
} from '@/Manatan/utils/wordAudio';
import { DictionaryResult, WordAudioSource, WordAudioSourceSelection } from '@/Manatan/types';
import { PronunciationSection, extractPronunciationData, getKanaMorae } from './Pronunciation';
import { PopupTheme } from '@/features/ln/reader/utils/themes';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { CropperModal } from '@/Manatan/components/CropperModal';

export const StructuredContent: React.FC<{
    contentString: string;
    dictionaryName?: string;
    onLinkClick?: (href: string, text: string) => void;
    onWordClick?: (text: string, position: number) => void;
    colors?: StructuredContentColors;
}> = ({ contentString, dictionaryName, onLinkClick, onWordClick, colors }) => {
    const parsedData = useMemo(() => {
        if (!contentString) return null;
        try {
            const parsed = JSON.parse(contentString);
            if (typeof parsed === 'string') return parsed;
            return parsed;
        } catch (e) {
            return contentString;
        }
    }, [contentString]);

    if (parsedData === null || parsedData === undefined) return null;
    
    if (typeof parsedData === 'string') {
        const text = parsedData;
        if (onWordClick && text.trim()) {
            return (
                <span 
                    onClick={(e) => {
                        e.stopPropagation();
                        let charOffset = 0;
                        if (document.caretRangeFromPoint) {
                            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                            if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
                                charOffset = range.startOffset;
                            }
                        }
                        onWordClick(text, charOffset);
                    }}
                    style={{ whiteSpace: 'pre-wrap' }}
                >
                    {text}
                </span>
            );
        }
        return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;
    }
    
    return <ContentNode node={parsedData} dictionaryName={dictionaryName} onLinkClick={onLinkClick} onWordClick={onWordClick} colors={colors} />;
};

const getNodeText = (node: any): string => {
    if (node === null || node === undefined) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getNodeText).join('');
    if (node.type === 'structured-content') return getNodeText(node.content);
    if (node && typeof node === 'object') return getNodeText(node.content);
    return '';
};

const ELEMENT_CONFIG: Record<string, {
    void?: boolean;
    wrapper?: 'table-container';
    baseStyle?: React.CSSProperties;
}> = {
    br: { void: true },
    img: { void: true },
    hr: { void: true },
    table: { wrapper: 'table-container' },
    thead: { baseStyle: { border: '1px solid #777', backgroundColor: '#f5f5f5' } },
    tbody: { baseStyle: { border: '1px solid #777' } },
    tfoot: { baseStyle: { border: '1px solid #777', backgroundColor: '#f5f5f5' } },
    ul: { baseStyle: { paddingInlineStart: '20px', margin: '2px 0', listStyleType: 'disc' } },
    ol: { baseStyle: { paddingInlineStart: '20px', margin: '2px 0', listStyleType: 'decimal' } },
    li: { baseStyle: { margin: '2px 0' } },
    th: { baseStyle: { border: '1px solid #777', padding: '2px 8px', textAlign: 'center', fontWeight: 'bold' } },
    td: { baseStyle: { border: '1px solid #777', padding: '2px 8px', textAlign: 'center' } },
    p: { baseStyle: { margin: '0.5em 0' } },
    details: { wrapper: 'table-container' },
    summary: {},
};

const VOID_TAGS = ['br', 'img', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];

const tagStyle: React.CSSProperties = {
    display: 'inline-block', padding: '1px 5px', borderRadius: '3px',
    fontSize: '0.75em', fontWeight: 'bold', marginRight: '6px',
    color: '#fff', verticalAlign: 'middle', lineHeight: '1.2'
};

const getTagStyle = (layout: 'vertical' | 'horizontal', tagBg: string, tagText: string): React.CSSProperties => {
    if (layout === 'horizontal') {
        return {
            display: 'inline-block',
            padding: '2px 4px',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            marginRight: '4px',
            color: tagText,
            backgroundColor: tagBg,
            verticalAlign: 'middle',
            lineHeight: '1.2'
        };
    }
    return {
        ...tagStyle,
        backgroundColor: tagBg,
        color: tagText,
    };
};

type StructuredContentColors = {
    tagBg?: string;
    tagText?: string;
    border?: string;
};

const ContentNode: React.FC<{
    node: any;
    dictionaryName?: string;
    onLinkClick?: (href: string, text: string) => void;
    onWordClick?: (text: string, position: number) => void;
    colors?: StructuredContentColors;
}> = ({ node, dictionaryName, onLinkClick, onWordClick, colors }) => {
    if (node === null || node === undefined) return null;
    if (typeof node === 'string' || typeof node === 'number') {
        const text = String(node);
        if (onWordClick && text.trim()) {
            const handleClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                let charOffset = 0;
                if (document.caretRangeFromPoint) {
                    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                    if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
                        charOffset = range.startOffset;
                        if (charOffset > 0) {
                            const checkRange = document.createRange();
                            checkRange.setStart(range.startContainer, charOffset - 1);
                            checkRange.setEnd(range.startContainer, charOffset);
                            const rect = checkRange.getBoundingClientRect();
                            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                                charOffset -= 1;
                            }
                        }
                    }
                } else if ((document as any).caretPositionFromPoint) {
                    const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
                    if (pos && pos.offsetNode.nodeType === Node.TEXT_NODE) {
                        charOffset = pos.offset;
                        if (charOffset > 0) {
                            const checkRange = document.createRange();
                            checkRange.setStart(pos.offsetNode, charOffset - 1);
                            checkRange.setEnd(pos.offsetNode, charOffset);
                            const rect = checkRange.getBoundingClientRect();
                            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                                charOffset -= 1;
                            }
                        }
                    }
                }
                onWordClick(text, charOffset);
            };
            return <span onClick={handleClick}>{node}</span>;
        }
        return <>{node}</>;
    }
    if (Array.isArray(node)) return <>{node.map((item, i) => <ContentNode key={i} node={item} dictionaryName={dictionaryName} onLinkClick={onLinkClick} onWordClick={onWordClick} colors={colors} />)}</>;
    if (node.type === 'structured-content') return <ContentNode node={node.content} dictionaryName={dictionaryName} onLinkClick={onLinkClick} onWordClick={onWordClick} colors={colors} />;

    if (node?.data?.content === 'attribution') return null;

    const { tag, content, style, href, data, title } = node;
    const dictStyle = style || {};
    const titleAttr = typeof title === 'string' ? title : undefined;

    const config = ELEMENT_CONFIG[tag] || {};
    
    const yomitanClass = `gloss-sc-${tag}`;
    const dictClass = data?.class || '';
    const className = [yomitanClass, dictClass].filter(Boolean).join(' ');
    
    const dataAttrs = data && typeof data === 'object'
        ? Object.entries(data).reduce((acc, [key, value]) => {
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                acc[`data-sc-${key}`] = String(value);
            }
            return acc;
        }, {} as Record<string, string>)
        : {};
    
    const finalStyle = { ...config.baseStyle, ...dictStyle };
    
    const childProps = { dictionaryName, onLinkClick, onWordClick, colors };
    
    if (config.void || VOID_TAGS.includes(tag)) {
        if (tag === 'img') {
            const rawPath = node.path || node.src;
            const imgWidth = node.width;
            const imgHeight = node.height;
            const altText = getNodeText(content) || titleAttr || '';
            const imgStyle: React.CSSProperties = { ...finalStyle };
            if (imgWidth) imgStyle.maxWidth = `${imgWidth}px`;
            if (imgHeight) imgStyle.maxHeight = `${imgHeight}px`;
            if (!imgStyle.maxWidth && !imgStyle.maxHeight) imgStyle.maxWidth = '100%';
            const src = rawPath && dictionaryName 
                ? `/api/yomitan/dict-media/${encodeURIComponent(dictionaryName)}/${rawPath}` 
                : rawPath;
            return <img src={src} alt={altText} style={imgStyle} {...dataAttrs} className={className} />;
        }
        if (tag === 'br') return <br />;
        const Component = tag as keyof JSX.IntrinsicElements;
        return <Component style={finalStyle} {...dataAttrs} className={className} />;
    }
    
    if (tag === 'a' && href) {
        const handleClick = (e: React.MouseEvent) => {
            if (!onLinkClick) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            e.stopPropagation();
            onLinkClick(href || '', getNodeText(content));
        };
        return (
            <a
                href={href}
                style={{ ...finalStyle, color: '#4890ff', textDecoration: 'underline' }}
                target={onLinkClick ? undefined : '_blank'}
                rel={onLinkClick ? undefined : 'noreferrer'}
                onClick={onLinkClick ? handleClick : undefined}
                {...dataAttrs}
                className={className}
                title={titleAttr}
            >
                <ContentNode node={content} {...childProps} />
            </a>
        );
    }
    
    const Component = tag as keyof JSX.IntrinsicElements;
    const element = (
        <Component style={finalStyle} {...dataAttrs} className={className} title={titleAttr}>
            <ContentNode node={content} {...childProps} />
        </Component>
    );
    
    if (config.wrapper === 'table-container') {
        return <div className="gloss-sc-table-container">{element}</div>;
    }
    
    return element;
};

const splitTagString = (tag: string): string[] =>
    tag.split(/\s+/).map((t) => t.trim()).filter(Boolean);

const normalizeTagList = (tags: string[]): string[] =>
    tags.flatMap((tag) => splitTagString(tag));

const AnkiButtons: React.FC<{
    entry: DictionaryResult;
    wordAudioSelection: WordAudioSourceSelection;
    wordAudioSelectionKey: string | null;
}> = ({ entry, wordAudioSelection, wordAudioSelectionKey }) => {
    const { settings, dictPopup, showAlert } = useOCR();
    const [status, setStatus] = useState<'unknown' | 'loading' | 'missing' | 'exists'>('unknown');
    const [existingNoteId, setExistingNoteId] = useState<number | null>(null);
    const [showCropper, setShowCropper] = useState(false);

    const targetField = useMemo(() => {
        return Object.keys(settings.ankiFieldMap || {}).find(key => settings.ankiFieldMap?.[key] === 'Target Word');
    }, [settings.ankiFieldMap]);

    const checkStatus = async () => {
        if (!settings.ankiConnectEnabled || !settings.ankiCheckDuplicates) return;
        try {
            const url = settings.ankiConnectUrl || 'http://127.0.0.1:8765';
            let query = `deck:"${settings.ankiDeck}"`;
            if (targetField) query += ` "${targetField}:${entry.headword}"`;
            else query += ` "${entry.headword}"`; 
            const ids = await findNotes(url, query);
            if (ids.length > 0) {
                setStatus('exists');
                setExistingNoteId(ids[0]);
            } else {
                setStatus('missing');
                setExistingNoteId(null);
            }
        } catch (e) {
            logAnkiError("Anki check failed", e);
            setStatus('unknown'); 
        }
    };

    React.useEffect(() => {
        if (settings.ankiCheckDuplicates) {
            setStatus('loading');
            checkStatus();
        } else {
            setStatus('missing'); 
        }
    }, [entry.headword, settings.ankiCheckDuplicates, targetField]);

    const handleAddClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!settings.ankiDeck || !settings.ankiModel) {
            showAlert("Anki Settings Missing", "Please select a Deck and Model in settings.");
            return;
        }
        const map = settings.ankiFieldMap || {};
        const hasImageField = Object.values(map).includes('Image');
        if (settings.ankiEnableCropper && hasImageField && dictPopup.context?.imgSrc) {
            setShowCropper(true);
        } else {
            addNoteToAnki();
        }
    };

    const addNoteToAnki = async (croppedBase64?: string) => {
        const url = settings.ankiConnectUrl || 'http://127.0.0.1:8765';
        const fields: Record<string, string> = {};
        const map = settings.ankiFieldMap || {};
        const singleGlossaryPrefix = 'Single Glossary ';
        const getSingleGlossaryName = (value: string): string | null => {
            if (value.startsWith(singleGlossaryPrefix)) {
                const name = value.slice(singleGlossaryPrefix.length).trim();
                return name ? name : null;
            }
            if (value.startsWith('Single Glossary:')) {
                const name = value.replace('Single Glossary:', '').trim();
                return name ? name : null;
            }
            return null;
        };
        const styleToString = (style: any) => {
            if (!style) return '';
            return Object.entries(style).map(([k, v]) => {
                const key = k.replace(/([A-Z])/g, '-$1').toLowerCase();
                return `${key}:${v}`;
            }).join(';');
        };

        const HTML_ELEMENT_CONFIG: Record<string, {
            void?: boolean;
            wrapper?: 'table-container';
            baseStyle?: string;
        }> = {
            br: { void: true },
            img: { void: true },
            hr: { void: true },
            table: { wrapper: 'table-container' },
            thead: { baseStyle: 'border: 1px solid #777; background-color: #f5f5f5;' },
            tbody: { baseStyle: 'border: 1px solid #777;' },
            tfoot: { baseStyle: 'border: 1px solid #777; background-color: #f5f5f5;' },
            ul: { baseStyle: 'padding-left: 20px; margin: 2px 0; list-style-type: disc;' },
            ol: { baseStyle: 'padding-left: 20px; margin: 2px 0; list-style-type: decimal;' },
            li: { baseStyle: 'margin: 2px 0;' },
            th: { baseStyle: 'border: 1px solid #777; padding: 2px 8px; text-align: center; font-weight: bold;' },
            td: { baseStyle: 'border: 1px solid #777; padding: 2px 8px; text-align: center;' },
            p: { baseStyle: 'margin: 0.5em 0;' },
            details: { wrapper: 'table-container' },
            summary: {},
        };

        const VOID_TAGS_HTML = ['br', 'img', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];

        const generateElementHTML = (
            node: any,
            dictStyle: string,
            glossaryDictionaryName?: string,
        ): string => {
            const { tag, content, data, href } = node;
            const config = HTML_ELEMENT_CONFIG[tag] || {};

            const yomitanClass = `gloss-sc-${tag}`;
            const dictClass = data?.class || '';
            const classStr = [yomitanClass, dictClass].filter(Boolean).join(' ');
            const classAttr = classStr ? ` class="${classStr}"` : '';

            const classNames = typeof data?.class === 'string' ? data.class.split(/\s+/) : [];
            const isTagClass = classNames.includes('tag');
            const tagClassStyle = isTagClass
                ? 'display: inline-block; padding: 1px 5px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.28); font-size: 0.75em; font-weight: bold; margin-right: 6px; color: #fff; background-color: #666; vertical-align: middle; line-height: 1.2;'
                : '';

            const dataAttrs = data && typeof data === 'object'
                ? Object.entries(data).map(([key, value]) => {
                    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                        return `data-sc-${key}="${String(value).replace(/"/g, '&quot;')}"`;
                    }
                    return '';
                }).filter(Boolean).join(' ')
                : '';

            const finalStyle = `${config.baseStyle || ''}${tagClassStyle}${dictStyle}`;
            const styleAttr = finalStyle ? ` style="${finalStyle}"` : '';

            if (config.void || VOID_TAGS_HTML.includes(tag)) {
                if (tag === 'img') {
                    const rawPath = node.path || node.src || '';
                    const src = rawPath && glossaryDictionaryName
                        ? `/api/yomitan/dict-media/${encodeURIComponent(glossaryDictionaryName)}/${rawPath}`
                        : rawPath;
                    const alt = node.alt || '';
                    return `<img src="${src}" alt="${alt}"${styleAttr} ${dataAttrs}${classAttr} />`;
                }
                if (tag === 'br') return '<br />';
                return `<${tag}${styleAttr} ${dataAttrs}${classAttr} />`;
            }

            if (tag === 'a') {
                return `<a href="${href}" target="_blank" style="text-decoration: underline;${dictStyle}" ${dataAttrs}${classAttr}>${generateHTML(content, glossaryDictionaryName)}</a>`;
            }

            const innerHTML = generateHTML(content, glossaryDictionaryName);
            let element = `<${tag}${styleAttr} ${dataAttrs}${classAttr}>${innerHTML}</${tag}>`;

            if (config.wrapper === 'table-container') {
                element = `<div class="gloss-sc-table-container">${element}</div>`;
            }

            return element;
        };

        const generateHTML = (node: any, glossaryDictionaryName?: string): string => {
            if (node === null || node === undefined) return '';
            if (typeof node === 'string' || typeof node === 'number') return String(node);
            if (Array.isArray(node)) return node.map((part) => generateHTML(part, glossaryDictionaryName)).join('');
            if (node.type === 'structured-content') return generateHTML(node.content, glossaryDictionaryName);
            if (node?.data?.content === 'attribution') return '';
            const { style } = node;
            const customStyle = styleToString(style);
            return generateElementHTML(node, customStyle, glossaryDictionaryName);
        };
        const generateAnkiFurigana = (furiganaData: string[][]): string => {
            if (!furiganaData || furiganaData.length === 0) return entry.headword;
            return furiganaData.map(segment => {
                if (!Array.isArray(segment)) return '';
                const kanji = segment[0] ?? '';
                const kana = segment[1];
                if (kana && kana !== kanji) return `${kanji}[${kana}]`;
                return kanji;
            }).join('');
        };
        const getLowestFrequency = (): string => {
            if (!entry.frequencies || entry.frequencies.length === 0) return '';
            const numbers = entry.frequencies
                .map(f => parseInt(f.value.replace(/[^\d]/g, ''), 10))
                .filter(n => !isNaN(n));
            if (numbers.length === 0) return '';
            return Math.min(...numbers).toString();
        };
        const getHarmonicMeanFrequency = (): string => {
            if (!entry.frequencies || entry.frequencies.length === 0) return '';
            const numbers = entry.frequencies
                .map(f => parseInt(f.value.replace(/[^\d]/g, ''), 10))
                .filter(n => !isNaN(n) && n > 0);
            if (numbers.length === 0) return '';
            const sumOfReciprocals = numbers.reduce((sum, n) => sum + (1 / n), 0);
            return Math.round(numbers.length / sumOfReciprocals).toString();
        };
        const getHarmonicFrequency = (): string => {
            return getHarmonicMeanFrequency();
        };
        const getFrequency = (): string => {
            const mode = settings.ankiFreqMode || 'lowest';
            if (mode === 'lowest') return getLowestFrequency();
            const freqEntry = entry.frequencies?.find(f => f.dictionaryName === mode);
            if (freqEntry) return freqEntry.value;
            return getLowestFrequency();
        };
        const getPitchAccent = (): string => {
            const { pitchAccents } = extractPronunciationData(entry);
            if (!pitchAccents || pitchAccents.length === 0) return '';

            const seenPitches = new Set<string>();

            return pitchAccents.map(pa => {
                const morae = getKanaMorae(pa.reading || entry.reading);
                const reading = morae.join('');

                const pitchHtml = pa.pitches.map(p => {
                    const pos = typeof p.position === 'number' ? p.position : 0;
                    const pattern = p.pattern || '';
                    const nasal = p.nasal || [];
                    const devoice = p.devoice || [];
                    const tags = p.tags || [];

                    const pitchKey = `${reading}:${pos}:${pattern}:${nasal.join(',')}:${devoice.join(',')}`;
                    if (seenPitches.has(pitchKey)) {
                        return '';
                    }
                    seenPitches.add(pitchKey);

                    let textHtml = '';
                    morae.forEach((mora, i) => {
                        const isHigh = pattern ? pattern[i] === 'H' : (pos === 0 ? i > 0 : (pos === 1 ? i < 1 : (i > 0 && i < pos)));
                        const hasNasal = nasal.includes(i + 1);
                        const hasDevoice = devoice.includes(i + 1);
                        const isDownstep = pattern ? (pattern[i] === 'H' && pattern[i + 1] === 'L') : (isHigh && !((pos === 0 ? (i + 1) > 0 : (pos === 1 ? (i + 1) < 1 : ((i + 1) > 0 && (i + 1) < pos)))));

                        textHtml += `<span style="position:relative;display:inline-flex;flex-direction:column;align-items:center;padding:0 1px;${isHigh ? 'padding-top:0' : 'padding-top:8px'};">`;
                        if (hasDevoice) textHtml += `<span style="position:absolute;top:-6px;right:0;font-size:8px;color:#888;">°</span>`;
                        textHtml += `<span style="${hasDevoice ? 'color:#888;' : ''}">${mora}</span>`;
                        if (hasNasal) textHtml += `<span style="position:absolute;bottom:-3px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:#3498db;opacity:0.6;"></span>`;
                        textHtml += `<span style="position:absolute;top:${isHigh ? '-4px' : '8px'};left:0;right:0;height:2px;background:currentColor;"></span>`;
                        if (isDownstep) textHtml += `<span style="position:absolute;top:-4px;right:0;width:2px;height:14px;background:#e74c3c;"></span>`;
                        textHtml += `</span>`;
                    });

                    const notation = `[${pos}]`;

                    const tagsHtml = tags.length > 0
                        ? tags.map(t => `<span style="font-size:0.65em;color:#aaa;background:rgba(255,255,255,0.1);padding:1px 4px;border-radius:2px;margin-left:4px;">${t}</span>`).join('')
                        : '';

                    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><span style="font-family:monospace;font-size:0.85em;color:#e74c3c;font-weight:bold;">${notation}</span><span style="display:inline-flex;align-items:flex-end;">${textHtml}</span>${tagsHtml}</div>`;
                }).join('');

                if (!pitchHtml) return '';

                return `<div style="margin-bottom:8px;"><span style="font-size:0.7em;color:#888;background:rgba(139,92,246,0.2);padding:2px 6px;border-radius:3px;">${pa.dictionaryName}</span><div style="margin-top:4px;padding:4px 8px;background:rgba(0,0,0,0.2);border-radius:4px;">${pitchHtml}</div></div>`;
            }).join('');
        };
        const buildGlossaryHtml = (dictionaryName?: string): string => {
            const glossaryEntries = dictionaryName
                ? entry.glossary.filter((def) => def.dictionaryName === dictionaryName)
                : entry.glossary;
            if (!glossaryEntries.length) return '';
            return glossaryEntries.map((def, idx) => {
                const tagsHTML = normalizeTagList(def.tags).map((t) =>
                    `<span style="display: inline-block; padding: 1px 5px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.28); font-size: 0.75em; font-weight: bold; margin-right: 6px; color: #fff; background-color: #666; vertical-align: middle;">${t}</span>`
                );
                const dictHTML = `<span style="display: inline-block; padding: 1px 5px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.2); font-size: 0.75em; font-weight: bold; margin-right: 6px; color: #fff; background-color: #9b59b6; vertical-align: middle;">${def.dictionaryName}</span>`;
                const headerHTML = [...tagsHTML, dictHTML].join(' ');
                const contentHTML = def.content.map((c) => {
                    try {
                        const parsed = JSON.parse(c);
                        return `<div style="margin-bottom: 2px;">${generateHTML(parsed, def.dictionaryName)}</div>`;
                    } catch {
                        return `<div>${c}</div>`;
                    }
                }).join('');
                return `
                    <div style="margin-bottom: 12px; display: flex;">
                        <div style="flex-shrink: 0; width: 24px; font-weight: bold;">${idx + 1}.</div>
                        <div style="flex-grow: 1;">
                            <div style="margin-bottom: 4px;">${headerHTML}</div>
                            <div>${contentHTML}</div>
                        </div>
                    </div>
                `;
            }).join('');
        };
        const sentence = dictPopup.context?.sentence || '';
        const needsSentenceFurigana = Object.values(map).includes('Sentence Furigana');
        const sentenceFurigana = needsSentenceFurigana
            ? await buildSentenceFuriganaFromLookup(sentence, lookupYomitan, {
                  language: settings.yomitanLanguage,
                  groupingMode: settings.resultGroupingMode,
              })
            : sentence;
        const wordAudioField = Object.keys(map).find((key) => map[key] === 'Word Audio');
        let wordAudioData: { url?: string; data?: string; filename: string; fields: string[] } | undefined;
        if (wordAudioField) {
            const entryKey = `${entry.headword}::${entry.reading}`;
            const audioSelection = wordAudioSelectionKey === entryKey ? wordAudioSelection : 'auto';
            const audioInfo = await resolveWordAudioUrl(entry, settings.yomitanLanguage, audioSelection);
            if (audioInfo?.url) {
                wordAudioData = { url: audioInfo.url, filename: getWordAudioFilename(audioInfo.url), fields: [wordAudioField] };
            }
        }
        for (const [ankiField, mapType] of Object.entries(map)) {
            if (mapType === 'Target Word') fields[ankiField] = entry.headword;
            else if (mapType === 'Word (Again)') fields[ankiField] = entry.headword;
            else if (mapType === 'Reading') fields[ankiField] = entry.reading;
            else if (mapType === 'Furigana') fields[ankiField] = generateAnkiFurigana(entry.furigana || []);
            else if (mapType === 'Definition' || mapType === 'Glossary') fields[ankiField] = buildGlossaryHtml();
            else if (mapType === 'Frequency') fields[ankiField] = getFrequency();
            else if (mapType === 'Harmonic Frequency') fields[ankiField] = getHarmonicFrequency();
            else if (mapType === 'Pitch Accent') fields[ankiField] = getPitchAccent();
            else if (mapType === 'Sentence') fields[ankiField] = sentence;
            else if (mapType === 'Sentence Furigana') fields[ankiField] = sentenceFurigana;
            else if (mapType === 'Word Audio') fields[ankiField] = '';
            else if (mapType === 'x') fields[ankiField] = 'x';
            else if (typeof mapType === 'string') {
                const name = getSingleGlossaryName(mapType);
                if (name) fields[ankiField] = buildGlossaryHtml(name);
            }
        }
        try {
            setStatus('loading');
            let pictureData;
            const imgField = Object.keys(map).find(k => map[k] === 'Image');
            if (imgField && dictPopup.context?.imgSrc) {
                if (croppedBase64) {
                    pictureData = {
                        data: croppedBase64.split(';base64,')[1],
                        filename: `manatan_card_${Date.now()}.webp`,
                        fields: [imgField]
                    };
                } else {
                    const b64 = await imageUrlToBase64Webp(dictPopup.context.imgSrc, settings.ankiImageQuality || 0.92);
                    if (b64) {
                        pictureData = {
                            data: b64.split(';base64,')[1],
                            filename: `manatan_card_${Date.now()}.webp`,
                            fields: [imgField]
                        };
                    }
                }
            }
            const res = await addNote(
                url,
                settings.ankiDeck!,
                settings.ankiModel!,
                fields,
                ['manatan'],
                pictureData,
                wordAudioData,
            );
            if (res) {
                setStatus('exists');
                setExistingNoteId(res);
            } else {
                throw new Error("Anki returned null result");
            }
        } catch (e: any) {
            console.error(e);
            showAlert("Add Failed", String(e));
            setStatus('missing');
        }
    };
    const handleOpen = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const url = settings.ankiConnectUrl || 'http://127.0.0.1:8765';
            let query = '';
            if (existingNoteId) {
                query = `nid:${existingNoteId}`;
            } else if (targetField) {
                query = `deck:"${settings.ankiDeck}" "${targetField}:${entry.headword}"`;
            } else {
                query = `deck:"${settings.ankiDeck}" "${entry.headword}"`;
            }
            await guiBrowse(url, query);
        } catch(e) { console.error(e); }
    };
    if (status === 'unknown') return null;
    return (
        <>
            <button 
                onClick={status === 'exists' ? handleOpen : handleAddClick}
                disabled={status === 'loading'}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, color: '#2ecc71', opacity: status === 'loading' ? 0.5 : 1, marginInlineStart: '10px'
                }}
                title={status === 'exists' ? "Open in Anki" : "Add to Anki"}
            >
                {status === 'exists' ? (
                    <MenuBookIcon sx={{ fontSize: 22, transform: 'translateY(-0.5px)' }} />
                ) : (
                    <AddCircleOutlineIcon sx={{ fontSize: 22, '& path': { transform: 'scale(0.9167)', transformOrigin: 'center', transformBox: 'fill-box' } }} />
                )}
            </button>
            {showCropper && createPortal(
                <CropperModal 
                    imageSrc={dictPopup.context?.imgSrc || ''}
                    spreadData={dictPopup.context?.spreadData}
                    onComplete={(b64) => { setShowCropper(false); addNoteToAnki(b64); }}
                    onCancel={() => setShowCropper(false)}
                    quality={settings.ankiImageQuality || 0.92}
                />,
                document.body
            )}
        </>
    );
};

interface AudioMenuProps {
    x: number;
    y: number;
    entry: DictionaryResult;
    wordAudioOptions: WordAudioSource[];
    wordAudioAvailability: Record<WordAudioSource, boolean> | null;
    wordAudioAutoAvailable: boolean | null;
    activeWordAudioSelection: WordAudioSourceSelection;
    onPlayAudio: (source: WordAudioSourceSelection) => void;
    onSelectSource: (source: WordAudioSourceSelection) => void;
}

const AudioMenu: React.FC<AudioMenuProps> = ({
    x, y, entry, wordAudioOptions, wordAudioAvailability, wordAudioAutoAvailable,
    activeWordAudioSelection, onPlayAudio, onSelectSource,
}) => {
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [menuPosition, setMenuPosition] = useState({ top: y, left: x });

    useLayoutEffect(() => {
        const margin = 8;
        const menuEl = menuRef.current;
        const rect = menuEl?.getBoundingClientRect();
        const width = rect?.width ?? 220;
        const height = rect?.height ?? 180;

        const maxLeft = Math.max(margin, window.innerWidth - width - margin);
        const maxTop = Math.max(margin, window.innerHeight - height - margin);

        setMenuPosition({
            left: Math.min(Math.max(x, margin), maxLeft),
            top: Math.min(Math.max(y, margin), maxTop),
        });
    }, [x, y, wordAudioOptions.length]);

    return createPortal(
        <div
            ref={menuRef}
            data-word-audio-menu="true"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
            style={{
                position: 'fixed', top: menuPosition.top, left: menuPosition.left,
                zIndex: 2147483647, background: popupTheme ? popupTheme.bg : '#1a1d21',
                border: `1px solid ${popupTheme ? popupTheme.border : 'rgba(255,255,255,0.12)'}`, borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.45)',
                padding: '6px', minWidth: '220px',
            }}
        >
            <div style={{ fontSize: '0.75em', color: popupTheme ? popupTheme.secondary : '#aaa', padding: '4px 8px' }}>Word audio sources</div>
            <div
                role="button" tabIndex={0}
                onClick={() => onPlayAudio('auto')}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', color: popupTheme ? popupTheme.fg : '#fff',
                }}
            >
                <span style={{
                    textDecoration: wordAudioAutoAvailable === false ? 'line-through' : 'none',
                    color: wordAudioAutoAvailable === false ? (popupTheme ? popupTheme.secondary : '#777') : (popupTheme ? popupTheme.fg : '#fff'),
                }}>Auto (first available)</span>
                <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); onSelectSource('auto'); }}
                    title="Use this source for cards"
                    style={{
                        background: 'transparent', border: 'none',
                        color: wordAudioAutoAvailable === false ? (popupTheme ? popupTheme.secondary : '#555') : activeWordAudioSelection === 'auto' ? '#f1c40f' : (popupTheme ? popupTheme.secondary : '#777'),
                        cursor: 'pointer', fontSize: '0.9em',
                    }}
                >
                    {activeWordAudioSelection === 'auto' ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                </button>
            </div>
            {wordAudioOptions.map((source) => (
                <div
                    key={source} role="button" tabIndex={0}
                    onClick={() => onPlayAudio(source)}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', color: popupTheme ? popupTheme.fg : '#fff',
                    }}
                >
                    <span style={{
                        textDecoration: wordAudioAvailability?.[source] === false ? 'line-through' : 'none',
                        color: wordAudioAvailability?.[source] === false ? (popupTheme ? popupTheme.secondary : '#777') : (popupTheme ? popupTheme.fg : '#fff'),
                    }}>{getWordAudioSourceLabel(source)}</span>
                    <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); onSelectSource(source); }}
                        title="Use this source for cards"
                        style={{
                            background: 'transparent', border: 'none',
                            color: wordAudioAvailability?.[source] === false ? (popupTheme ? popupTheme.secondary : '#555') : activeWordAudioSelection === source ? '#f1c40f' : (popupTheme ? popupTheme.secondary : '#777'),
                            cursor: 'pointer', fontSize: '0.9em',
                        }}
                    >
                        {activeWordAudioSelection === source ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                    </button>
                </div>
            ))}
        </div>,
        document.body,
    );
};

interface DictionaryViewProps {
    results: DictionaryResult[];
    isLoading: boolean;
    systemLoading: boolean;
    onLinkClick?: (href: string, text: string) => void;
    onWordClick?: (text: string, position: number) => void;
    context?: {
        imgSrc?: string;
        sentence?: string;
        spreadData?: any;
    };
    variant?: 'popup' | 'inline';
    popupTheme?: PopupTheme;
    layout?: 'vertical' | 'horizontal';
    renderAnkiButtons?: (entry: DictionaryResult) => React.ReactNode;
    renderHistoryNav?: () => React.ReactNode;
}

export const DictionaryView: React.FC<DictionaryViewProps> = ({ 
    results, isLoading, systemLoading, onLinkClick, onWordClick, context, variant = 'inline', popupTheme, layout = 'vertical', renderAnkiButtons, renderHistoryNav
}) => {
    const isPopup = variant === 'popup';
    const muiTheme = useTheme();
    const isDark = muiTheme.palette.mode === 'dark';
    const colors = isPopup ? popupTheme ? {
        // Popup colors from theme
        text: popupTheme.fg,
        textSecondary: popupTheme.secondary,
        textMuted: popupTheme.secondary,
        border: popupTheme.border,
        tagBg: popupTheme.secondary,
        tagText: popupTheme.bg,
        freqNameBg: '#2ecc71',
        freqNameText: '#000',
        freqValueBg: popupTheme.hoverBg,
        freqValueText: popupTheme.fg,
        dictTagBg: popupTheme.accent,
        dictTagText: '#fff',
        accent: popupTheme.accent,
        hoverBg: popupTheme.hoverBg,
    } : {
        // Popup colors (dark background - fallback)
        text: '#fff',
        textSecondary: '#aaa',
        textMuted: '#888',
        border: '#333',
        tagBg: '#666',
        tagText: '#fff',
        freqNameBg: '#2ecc71',
        freqNameText: '#000',
        freqValueBg: '#333',
        freqValueText: '#eee',
        dictTagBg: '#9b59b6',
        dictTagText: '#fff',
        accent: '#7cc8ff',
        hoverBg: '#333',
    } : {
        // Inline colors using MUI theme
        text: muiTheme.palette.text.primary,
        textSecondary: muiTheme.palette.text.secondary,
        textMuted: isDark ? '#888' : '#666',
        border: muiTheme.palette.divider,
        tagBg: isDark ? '#666' : '#e0e0e0',
        tagText: isDark ? '#fff' : '#000',
        freqNameBg: '#2ecc71',
        freqNameText: '#000',
        freqValueBg: isDark ? '#333' : '#f5f5f5',
        freqValueText: isDark ? '#eee' : '#000',
        dictTagBg: '#9b59b6',
        dictTagText: '#fff',
        accent: muiTheme.palette.primary.main,
        hoverBg: isDark ? '#333' : '#f5f5f5',
    };
    const { settings } = useOCR();
    const [audioMenu, setAudioMenu] = useState<{
        x: number; y: number; entry: DictionaryResult;
    } | null>(null);
    const [wordAudioSelection, setWordAudioSelection] = useState<WordAudioSourceSelection>('auto');
    const [wordAudioSelectionKey, setWordAudioSelectionKey] = useState<string | null>(null);
    const [wordAudioAvailability, setWordAudioAvailability] = useState<Record<WordAudioSource, boolean> | null>(null);
    const [wordAudioAutoAvailable, setWordAudioAutoAvailable] = useState<boolean | null>(null);
    const wordAudioOptions = React.useMemo(() => getWordAudioSourceOptions(settings.yomitanLanguage), [settings.yomitanLanguage]);
    const calculateHarmonicMean = useCallback((frequencies: any[]): number | null => {
        if (!frequencies || frequencies.length === 0) return null;
        const numbers = frequencies
            .map(f => parseInt(f.value.replace(/[^\d]/g, ''), 10))
            .filter(n => !isNaN(n) && n > 0);
        if (numbers.length === 0) return null;
        const sumOfReciprocals = numbers.reduce((sum, n) => sum + (1 / n), 0);
        return Math.round(numbers.length / sumOfReciprocals);
    }, []);
    const processedEntries = useMemo(() => {
        if (!settings.showHarmonicMeanFreq) return results;
        const firstFrequencies = results
            .filter(entry => entry.frequencies && entry.frequencies.length > 0)
            .map(entry => entry.frequencies![0]);
        if (firstFrequencies.length === 0) return results;
        const harmonicMean = calculateHarmonicMean(firstFrequencies);
        if (harmonicMean === null) return results;
        return results.map(entry => ({
            ...entry,
            frequencies: [{ dictionaryName: 'Harmonic Mean', value: harmonicMean.toString() }]
        }));
    }, [results, settings.showHarmonicMeanFreq, calculateHarmonicMean]);
    const handlePlayWordAudio = useCallback(async (entry: DictionaryResult, selection?: WordAudioSourceSelection, playFailSound = true) => {
        const entryKey = `${entry.headword}::${entry.reading}`;
        const resolvedSelection = selection || (wordAudioSelectionKey === entryKey ? wordAudioSelection : 'auto');
        const playedSource = await playWordAudio(entry, settings.yomitanLanguage, resolvedSelection);
        if (!playedSource && playFailSound) playAudioFailClick();
    }, [settings.yomitanLanguage, wordAudioSelection, wordAudioSelectionKey]);
    const openAudioMenu = useCallback((event: React.MouseEvent, entry: DictionaryResult) => {
        event.preventDefault();
        event.stopPropagation();
        setAudioMenu({ x: event.clientX, y: event.clientY, entry });
    }, []);
    const handleSelectWordAudioSource = useCallback((selection: WordAudioSourceSelection) => {
        setWordAudioSelection(selection);
        if (audioMenu) setWordAudioSelectionKey(`${audioMenu.entry.headword}::${audioMenu.entry.reading}`);
    }, [audioMenu]);
    React.useEffect(() => {
        if (!audioMenu) {
            setWordAudioAvailability(null);
            setWordAudioAutoAvailable(null);
            return;
        }
        let cancelled = false;
        const entry = audioMenu.entry;
        const resolveAvailability = async () => {
            const availability: Record<WordAudioSource, boolean> = {} as Record<WordAudioSource, boolean>;
            for (const source of wordAudioOptions) {
                const info = await resolveWordAudioUrl(entry, settings.yomitanLanguage, source);
                availability[source] = Boolean(info?.url);
            }
            const autoAvailable = wordAudioOptions.length > 0 && wordAudioOptions.some((source) => availability[source]);
            if (!cancelled) {
                setWordAudioAvailability(availability);
                setWordAudioAutoAvailable(autoAvailable);
            }
        };
        resolveAvailability();
        return () => { cancelled = true; };
    }, [audioMenu, settings.yomitanLanguage, wordAudioOptions]);
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            if (target.closest('[data-word-audio-menu="true"]')) return;
            const button = target.closest('button,[role="button"]');
            if (button) setAudioMenu(null);
        };
        if (audioMenu) {
            document.addEventListener('click', handleClickOutside, true);
            return () => document.removeEventListener('click', handleClickOutside, true);
        }
    }, [audioMenu]);
    React.useEffect(() => {
        if (!settings.autoPlayWordAudio) return;
        if (!processedEntries.length) return;
        const entry = processedEntries[0];
        handlePlayWordAudio(entry, undefined, false);
    }, [processedEntries, settings.autoPlayWordAudio, handlePlayWordAudio]);
    const audioMenuEntryKey = audioMenu ? `${audioMenu.entry.headword}::${audioMenu.entry.reading}` : null;
    const activeWordAudioSelection = audioMenuEntryKey && wordAudioSelectionKey === audioMenuEntryKey ? wordAudioSelection : 'auto';
    
    // Collect all styles from results
    const allStyles = useMemo(() => {
        const stylesMap: Record<string, string> = {};
        for (const entry of results) {
            if (entry.styles) {
                for (const [dictName, css] of Object.entries(entry.styles)) {
                    if (css && !stylesMap[dictName]) {
                        stylesMap[dictName] = css;
                    }
                }
            }
        }
        return stylesMap;
    }, [results]);

    const scopedStyles = useMemo(() => {
        const cssParts: string[] = [];
        for (const [dictName, css] of Object.entries(allStyles)) {
            if (!css) continue;
            // Escape quotes in dictionary name for CSS selector
            const escapedName = dictName.replace(/"/g, '\\"');
            const selector = `[data-dictionary="${escapedName}"]`;
            // Use CSS nesting to scope all rules - wrap the entire CSS block
            const scopedCss = `${selector} {\n${css}\n}`;
            cssParts.push(scopedCss);
        }
        return cssParts.join('\n');
    }, [allStyles]);

    return (
        <>
            {scopedStyles && (
                <style>{scopedStyles}</style>
            )}
            {isLoading && <div style={{ textAlign: 'center', padding: '20px', color: colors.textMuted }}>Scanning...</div>}
            {!isLoading && processedEntries.map((entry, i) => (
                <div key={i} class="entry" style={{ marginBottom: layout === 'horizontal' ? '8px' : '16px', paddingBottom: layout === 'horizontal' ? '8px' : '16px', borderBottom: i < processedEntries.length - 1 ? `1px solid ${colors.border}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: layout === 'horizontal' ? '6px' : '0' }}>
                            {i === 0 && layout === 'horizontal' && renderHistoryNav && renderHistoryNav()}
                            <div style={{ fontSize: layout === 'horizontal' ? '1.5rem' : '1.8em', lineHeight: '1', marginRight: layout === 'horizontal' ? '8px' : '10px', color: colors.text }} class="headword">
                                {layout === 'horizontal' ? (
                                    <>
                                        <span class="headword-term">{entry.headword}</span>
                                        {entry.reading && (
                                            <span style={{ fontSize: '0.75rem', color: colors.textSecondary, marginLeft: '4px' }} class="headword-reading">({entry.reading})</span>
                                        )}
                                    </>
                                ) : (
                                    entry.furigana && entry.furigana.length > 0 ? (
                                        <ruby style={{ rubyPosition: 'over' }} class="headword-text-container">
                                            {entry.furigana.map((seg, idx) => (
                                                <React.Fragment key={idx}>
                                                    <span class="headword-term">{seg[0]}</span><rt style={{ fontSize: '0.5em', color: colors.textSecondary }} class="headword-reading">{seg[1]}</rt>
                                                </React.Fragment>
                                            ))}
                                        </ruby>
                                    ) : (
                                        <ruby class="headword-text-container">
                                            <span class="headword-term">{entry.headword}</span>
                                            <rt style={{ fontSize: '0.5em', color: colors.textSecondary }} class="headword-reading">{entry.reading}</rt>
                                        </ruby>
                                    )
                                )}
                            </div>
                            {entry.termTags && entry.termTags.length > 0 && (
                                <div style={{ display: 'flex', gap: '4px' }} class="headword-list-tag-list tag-list">
                                    {entry.termTags.flatMap((tag: any) => {
                                        const label = (typeof tag === 'object' && tag !== null && tag.name) ? tag.name : tag;
                                        if (typeof label !== 'string') return [];
                                        return splitTagString(label);
                                    }).map((label, idx) => (
                                        <span key={idx} class="tag" style={getTagStyle(layout, colors.tagBg, colors.tagText)}><span class="tag-label">{label}</span></span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {renderAnkiButtons ? (
                                renderAnkiButtons(entry)
                            ) : (
                                <>
                                    {settings.ankiConnectEnabled && (
                                        <AnkiButtons
                                            entry={entry}
                                            wordAudioSelection={wordAudioSelection}
                                            wordAudioSelectionKey={wordAudioSelectionKey}
                                            mediaName={mediaName}
                                        />
                                    )}
                                    <button
                                        type="button"
                                        onClick={(event) => { event.stopPropagation(); handlePlayWordAudio(entry); }}
                                        onContextMenu={(event) => openAudioMenu(event, entry)}
                                        title="Play word audio (right-click for sources)"
                                        style={{
                                            background: 'none', border: 'none',
                                            cursor: wordAudioOptions.length ? 'pointer' : 'not-allowed', padding: '2px',
                                            color: wordAudioOptions.length ? (popupTheme ? popupTheme.accent : '#7cc8ff') : (popupTheme ? popupTheme.secondary : '#555'), lineHeight: 1,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}
                                        disabled={!wordAudioOptions.length}
                                        aria-label="Play word audio"
                                    >
                                        <VolumeUpIcon sx={{ fontSize: 22 }} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    {entry.frequencies && entry.frequencies.length > 0 && (
                        <div class="entry-body frequency-group-list" style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {entry.frequencies.map((freq, fIdx) => (
                                <div key={fIdx} class="frequency-item" style={{ display: 'inline-flex', fontSize: '0.75em', borderRadius: '4px', overflow: 'hidden', border: `1px solid ${colors.border}` }}>
                                    <div style={{ backgroundColor: colors.freqNameBg, color: colors.freqNameText, fontWeight: 'bold', padding: '2px 6px' }}>{freq.dictionaryName}</div>
                                    <div style={{ backgroundColor: colors.freqValueBg, color: colors.freqValueText, padding: '2px 6px', fontWeight: 'bold' }}>{freq.value}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {(() => {
                        const { pitchAccents, ipa } = extractPronunciationData(entry);
                        if (pitchAccents.length === 0 && ipa.length === 0) return null;
                        return (
                            <PronunciationSection
                                layout={layout}
                                reading={entry.reading || entry.headword}
                                pitchAccents={pitchAccents}
                                ipa={ipa}
                                showGraph={settings.yomitanShowPitchGraph ?? true}
                                showText={settings.yomitanShowPitchText ?? true}
                                showNotation={settings.yomitanShowPitchNotation ?? true}
                            />
                        );
                    })()}
                    {entry.glossary && (
                        <div class="entry-body gloss-list definition-list">
                            {entry.glossary.map((def, defIdx) => (
                                <div key={defIdx} class="gloss-item definition-item" data-dictionary={def.dictionaryName} style={{ display: 'flex', marginBottom: '12px' }}>
                                    <div style={{ flexShrink: 0, width: '24px', color: colors.textMuted, fontWeight: 'bold' }}><span class="gloss-separator">{defIdx + 1}.</span></div>
                                    <div style={{ flexGrow: 1 }} class="definition-item-inner definition-item-content">
                                        <div style={{ marginBottom: '4px' }} class="definition-tag-list tag-list">
                                            {normalizeTagList(def.tags || []).map((t, ti) => (
                                                <span key={ti} class="tag" style={getTagStyle(layout, colors.tagBg, colors.tagText)}><span class="tag-label">{t}</span></span>
                                            ))}
                                            <span class="tag tag-label" style={getTagStyle(layout, colors.dictTagBg, colors.dictTagText)}>{def.dictionaryName}</span>
                                        </div>
                                        <div style={{ color: colors.text, whiteSpace: 'pre-wrap' }} class="gloss-content">
                                            {def.content.map((jsonString, idx) => (
                                                <div key={idx} style={{ marginBottom: '2px' }}>
                                                    <StructuredContent contentString={jsonString} dictionaryName={def.dictionaryName} onLinkClick={onLinkClick} onWordClick={onWordClick} colors={colors} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            {!isLoading && results.length === 0 && <div style={{ padding: '10px', textAlign: 'center', color: colors.textMuted }}>No results found</div>}
            {audioMenu && (
                <AudioMenu
                    x={audioMenu.x} y={audioMenu.y} entry={audioMenu.entry}
                    wordAudioOptions={wordAudioOptions} wordAudioAvailability={wordAudioAvailability}
                    wordAudioAutoAvailable={wordAudioAutoAvailable} activeWordAudioSelection={activeWordAudioSelection}
                    onPlayAudio={(source) => { handlePlayWordAudio(audioMenu.entry, source); setAudioMenu(null); }}
                    onSelectSource={(source) => { handleSelectWordAudioSource(source); setAudioMenu(null); }}
                />
            )}
        </>
    );
};
