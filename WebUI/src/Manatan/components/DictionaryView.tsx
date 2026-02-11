import React, { useState, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { CropperModal } from '@/Manatan/components/CropperModal';

export const StructuredContent: React.FC<{
    contentString: string;
    onLinkClick?: (href: string, text: string) => void;
}> = ({ contentString, onLinkClick }) => {
    const parsedData = useMemo(() => {
        if (!contentString) return null;
        try {
            return JSON.parse(contentString);
        } catch (e) {
            return contentString;
        }
    }, [contentString]);

    if (parsedData === null || parsedData === undefined) return null;
    return <ContentNode node={parsedData} onLinkClick={onLinkClick} />;
};

const getNodeText = (node: any): string => {
    if (node === null || node === undefined) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getNodeText).join('');
    if (node.type === 'structured-content') return getNodeText(node.content);
    if (node && typeof node === 'object') return getNodeText(node.content);
    return '';
};

const tagStyle: React.CSSProperties = {
    display: 'inline-block', padding: '1px 5px', borderRadius: '3px',
    fontSize: '0.75em', fontWeight: 'bold', marginRight: '6px',
    color: '#fff', verticalAlign: 'middle', lineHeight: '1.2'
};

const ContentNode: React.FC<{ node: any; onLinkClick?: (href: string, text: string) => void }> = ({ node, onLinkClick }) => {
    if (node === null || node === undefined) return null;
    if (typeof node === 'string' || typeof node === 'number') return <>{node}</>;
    if (Array.isArray(node)) return <>{node.map((item, i) => <ContentNode key={i} node={item} onLinkClick={onLinkClick} />)}</>;
    if (node.type === 'structured-content') return <ContentNode node={node.content} onLinkClick={onLinkClick} />;

    if (node?.data?.content === 'attribution') return null;

    const { tag, content, style, href, data, title } = node;
    const s = style || {};
    const titleAttr = typeof title === 'string' ? title : undefined;
    const classNames = typeof data?.class === 'string' ? data.class.split(/\s+/) : [];
    const isTagClass = classNames.includes('tag');
    const spanStyle = isTagClass ? { ...tagStyle, backgroundColor: '#666', ...s } : s;

    const cellStyle: React.CSSProperties = { border: '1px solid #777', padding: '2px 8px', textAlign: 'center' };
    const tableStyle: React.CSSProperties = { 
        borderCollapse: 'collapse', 
        border: '1px solid #555', 
        margin: '4px 0', 
        fontSize: '0.9em', 
        width: '100%' 
    };
    
    const listStyle: React.CSSProperties = { paddingLeft: '20px', margin: '2px 0', listStyleType: 'disc' };

    const handleLinkClick = (event: React.MouseEvent) => {
        if (!onLinkClick) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        event.stopPropagation();
        onLinkClick(href || '', getNodeText(content));
    };

    switch (tag) {
        case 'ul': return <ul style={{ ...s, ...listStyle }}><ContentNode node={content} onLinkClick={onLinkClick} /></ul>;
        case 'ol': return <ol style={{ ...s, ...listStyle, listStyleType: 'decimal' }}><ContentNode node={content} onLinkClick={onLinkClick} /></ol>;
        case 'li': return <li style={{ ...s }}><ContentNode node={content} onLinkClick={onLinkClick} /></li>;
        case 'table': return <table style={{ ...s, ...tableStyle }}><tbody><ContentNode node={content} onLinkClick={onLinkClick} /></tbody></table>;
        case 'tr': return <tr style={s}><ContentNode node={content} onLinkClick={onLinkClick} /></tr>;
        case 'th': return <th style={{ ...s, ...cellStyle, fontWeight: 'bold' }}><ContentNode node={content} onLinkClick={onLinkClick} /></th>;
        case 'td': return <td style={{ ...s, ...cellStyle }}><ContentNode node={content} onLinkClick={onLinkClick} /></td>;
        case 'span': return <span style={spanStyle} title={titleAttr}><ContentNode node={content} onLinkClick={onLinkClick} /></span>;
        case 'div': return <div style={s}><ContentNode node={content} onLinkClick={onLinkClick} /></div>;
        case 'a':
            return (
                <a
                    href={href}
                    style={{ ...s, color: '#4890ff', textDecoration: 'underline' }}
                    target={onLinkClick ? undefined : '_blank'}
                    rel={onLinkClick ? undefined : 'noreferrer'}
                    onClick={onLinkClick ? handleLinkClick : undefined}
                >
                    <ContentNode node={content} onLinkClick={onLinkClick} />
                </a>
            );
        default: return <ContentNode node={content} onLinkClick={onLinkClick} />;
    }
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
        const generateHTML = (node: any): string => {
            if (node === null || node === undefined) return '';
            if (typeof node === 'string' || typeof node === 'number') return String(node);
            if (Array.isArray(node)) return node.map(generateHTML).join('');
            if (node.type === 'structured-content') return generateHTML(node.content);
            if (node?.data?.content === 'attribution') return '';
            const { tag, content, style, href, data } = node;
            const customStyle = styleToString(style);
            const classNames = typeof data?.class === 'string' ? data.class.split(/\s+/) : [];
            const isTagClass = classNames.includes('tag');
            const tagClassStyle = isTagClass
                ? 'display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 0.75em; font-weight: bold; margin-right: 6px; color: #fff; background-color: #666; vertical-align: middle; line-height: 1.2;'
                : '';
            if (tag === 'ul') {
                const baseStyle = 'padding-left: 20px; margin: 2px 0; list-style-type: disc;';
                return `<ul style="${baseStyle}${customStyle}">${generateHTML(content)}</ul>`;
            }
            if (tag === 'ol') {
                const baseStyle = 'padding-left: 20px; margin: 2px 0; list-style-type: decimal;';
                return `<ol style="${baseStyle}${customStyle}">${generateHTML(content)}</ol>`;
            }
            if (tag === 'li') return `<li style="${customStyle}">${generateHTML(content)}</li>`;
            if (tag === 'table') {
                const baseStyle = 'border-collapse: collapse; width: 100%; border: 1px solid #777;';
                return `<table style="${baseStyle}${customStyle}"><tbody>${generateHTML(content)}</tbody></table>`;
            }
            if (tag === 'tr') return `<tr style="${customStyle}">${generateHTML(content)}</tr>`;
            if (tag === 'th') {
                const baseStyle = 'border: 1px solid #777; padding: 2px 8px; text-align: center; font-weight: bold;';
                return `<th style="${baseStyle}${customStyle}">${generateHTML(content)}</th>`;
            }
            if (tag === 'td') {
                const baseStyle = 'border: 1px solid #777; padding: 2px 8px; text-align: center;';
                return `<td style="${baseStyle}${customStyle}">${generateHTML(content)}</td>`;
            }
            if (tag === 'span') return `<span style="${tagClassStyle}${customStyle}">${generateHTML(content)}</span>`;
            if (tag === 'div') return `<div style="${customStyle}">${generateHTML(content)}</div>`;
            if (tag === 'a') {
                const baseStyle = 'text-decoration: underline;'; 
                return `<a href="${href}" target="_blank" style="${baseStyle}${customStyle}">${generateHTML(content)}</a>`;
            }
            return generateHTML(content);
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
        const getFrequency = (): string => {
            const mode = settings.ankiFreqMode || 'lowest';
            if (mode === 'lowest') return getLowestFrequency();
            if (mode === 'harmonic') return getHarmonicMeanFrequency();
            const freqEntry = entry.frequencies?.find(f => f.dictionaryName === mode);
            if (freqEntry) return freqEntry.value;
            return getLowestFrequency();
        };
        const buildGlossaryHtml = (dictionaryName?: string): string => {
            const glossaryEntries = dictionaryName
                ? entry.glossary.filter((def) => def.dictionaryName === dictionaryName)
                : entry.glossary;
            if (!glossaryEntries.length) return '';
            return glossaryEntries.map((def, idx) => {
                const tagsHTML = normalizeTagList(def.tags).map((t) =>
                    `<span style="display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 0.75em; font-weight: bold; margin-right: 6px; color: #fff; background-color: #666; vertical-align: middle;">${t}</span>`
                );
                const dictHTML = `<span style="display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 0.75em; font-weight: bold; margin-right: 6px; color: #fff; background-color: #9b59b6; vertical-align: middle;">${def.dictionaryName}</span>`;
                const headerHTML = [...tagsHTML, dictHTML].join(' ');
                const contentHTML = def.content.map((c) => {
                    try {
                        const parsed = JSON.parse(c);
                        return `<div style="margin-bottom: 2px;">${generateHTML(parsed)}</div>`;
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
                    lineHeight: 1, color: '#2ecc71', opacity: status === 'loading' ? 0.5 : 1, marginLeft: '10px'
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
                zIndex: 2147483647, background: '#1a1d21',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.45)',
                padding: '6px', minWidth: '220px',
            }}
        >
            <div style={{ fontSize: '0.75em', color: '#aaa', padding: '4px 8px' }}>Word audio sources</div>
            <div
                role="button" tabIndex={0}
                onClick={() => onPlayAudio('auto')}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', color: '#fff',
                }}
            >
                <span style={{
                    textDecoration: wordAudioAutoAvailable === false ? 'line-through' : 'none',
                    color: wordAudioAutoAvailable === false ? '#777' : '#fff',
                }}>Auto (first available)</span>
                <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); onSelectSource('auto'); }}
                    title="Use this source for cards"
                    style={{
                        background: 'transparent', border: 'none',
                        color: wordAudioAutoAvailable === false ? '#555' : activeWordAudioSelection === 'auto' ? '#f1c40f' : '#777',
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
                        padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', color: '#fff',
                    }}
                >
                    <span style={{
                        textDecoration: wordAudioAvailability?.[source] === false ? 'line-through' : 'none',
                        color: wordAudioAvailability?.[source] === false ? '#777' : '#fff',
                    }}>{getWordAudioSourceLabel(source)}</span>
                    <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); onSelectSource(source); }}
                        title="Use this source for cards"
                        style={{
                            background: 'transparent', border: 'none',
                            color: wordAudioAvailability?.[source] === false ? '#555' : activeWordAudioSelection === source ? '#f1c40f' : '#777',
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
    context?: {
        imgSrc?: string;
        sentence?: string;
        spreadData?: any;
    };
}

export const DictionaryView: React.FC<DictionaryViewProps> = ({ 
    results, isLoading, systemLoading, onLinkClick, context 
}) => {
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
        return results.map(entry => {
            if (!entry.frequencies || entry.frequencies.length === 0) return entry;
            const harmonicMean = calculateHarmonicMean(entry.frequencies);
            if (harmonicMean === null) return entry;
            return {
                ...entry,
                frequencies: [{ dictionaryName: 'Harmonic Mean', value: harmonicMean.toString() }]
            };
        });
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
    return (
        <>
            {isLoading && <div style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Scanning...</div>}
            {!isLoading && processedEntries.map((entry, i) => (
                <div key={i} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: i < processedEntries.length - 1 ? '1px solid #333' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: '1.8em', lineHeight: '1', marginRight: '10px' }}>
                                {entry.furigana && entry.furigana.length > 0 ? (
                                    <ruby style={{ rubyPosition: 'over' }}>
                                        {entry.furigana.map((seg, idx) => (
                                            <React.Fragment key={idx}>
                                                {seg[0]}<rt style={{ fontSize: '0.5em', color: '#aaa' }}>{seg[1]}</rt>
                                            </React.Fragment>
                                        ))}
                                    </ruby>
                                ) : (
                                    <ruby>
                                        {entry.headword}
                                        <rt style={{ fontSize: '0.5em', color: '#aaa' }}>{entry.reading}</rt>
                                    </ruby>
                                )}
                            </div>
                            {entry.termTags && entry.termTags.length > 0 && (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {entry.termTags.flatMap((tag: any) => {
                                        const label = (typeof tag === 'object' && tag !== null && tag.name) ? tag.name : tag;
                                        if (typeof label !== 'string') return [];
                                        return splitTagString(label);
                                    }).map((label, idx) => (
                                        <span key={idx} style={{ ...tagStyle, backgroundColor: '#666', marginRight: 0 }}>{label}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {settings.ankiConnectEnabled && (
                                <AnkiButtons entry={entry} wordAudioSelection={wordAudioSelection} wordAudioSelectionKey={wordAudioSelectionKey} />
                            )}
                            <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); handlePlayWordAudio(entry); }}
                                onContextMenu={(event) => openAudioMenu(event, entry)}
                                title="Play word audio (right-click for sources)"
                                style={{
                                    background: 'none', border: 'none',
                                    cursor: wordAudioOptions.length ? 'pointer' : 'not-allowed', padding: '2px',
                                    color: wordAudioOptions.length ? '#7cc8ff' : '#555', lineHeight: 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                                disabled={!wordAudioOptions.length}
                                aria-label="Play word audio"
                            >
                                <VolumeUpIcon sx={{ fontSize: 22 }} />
                            </button>
                        </div>
                    </div>
                    {entry.frequencies && entry.frequencies.length > 0 && (
                        <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {entry.frequencies.map((freq, fIdx) => (
                                <div key={fIdx} style={{ display: 'inline-flex', fontSize: '0.75em', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                                    <div style={{ backgroundColor: '#2ecc71', color: '#000', fontWeight: 'bold', padding: '2px 6px' }}>{freq.dictionaryName}</div>
                                    <div style={{ backgroundColor: '#333', color: '#eee', padding: '2px 6px', fontWeight: 'bold' }}>{freq.value}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {entry.glossary && (
                        <div>
                            {entry.glossary.map((def, defIdx) => (
                                <div key={defIdx} style={{ display: 'flex', marginBottom: '12px' }}>
                                    <div style={{ flexShrink: 0, width: '24px', color: '#888', fontWeight: 'bold' }}>{defIdx + 1}.</div>
                                    <div style={{ flexGrow: 1 }}>
                                        <div style={{ marginBottom: '4px' }}>
                                            {normalizeTagList(def.tags || []).map((t, ti) => (
                                                <span key={ti} style={{ ...tagStyle, backgroundColor: '#666' }}>{t}</span>
                                            ))}
                                            <span style={{ ...tagStyle, backgroundColor: '#9b59b6' }}>{def.dictionaryName}</span>
                                        </div>
                                        <div style={{ color: '#ddd' }}>
                                            {def.content.map((jsonString, idx) => (
                                                <div key={idx} style={{ marginBottom: '2px' }}>
                                                    <StructuredContent contentString={jsonString} onLinkClick={onLinkClick} />
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
            {!isLoading && results.length === 0 && <div style={{ padding: '10px', textAlign: 'center', color: '#777' }}>No results found</div>}
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
