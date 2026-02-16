/*
 * Copyright (C) Contributors to the Manatan project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Slider from '@mui/material/Slider';
import Menu from '@mui/material/Menu';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import VideoSettingsIcon from '@mui/icons-material/OndemandVideo';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import SpeedIcon from '@mui/icons-material/Speed';
import CheckIcon from '@mui/icons-material/Check';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useHotkeys as useHotkeysHook, useHotkeysContext } from 'react-hotkeys-hook';
import Hls from 'hls.js';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { Hotkey } from '@/features/reader/hotkeys/settings/components/Hotkey.tsx';
import { HOTKEY_SCOPES } from '@/features/hotkeys/Hotkeys.constants.ts';
import { HotkeyScope } from '@/features/hotkeys/Hotkeys.types.ts';
import { useOCR } from '@/Manatan/context/OCRContext.tsx';
import ManatanLogo from '@/Manatan/assets/manatan_logo.png';
import { lookupYomitan } from '@/Manatan/utils/api.ts';
import { buildSentenceFuriganaFromLookup } from '@/Manatan/utils/japaneseFurigana';
import {
    getWordAudioFilename,
    getWordAudioSourceLabel,
    getWordAudioSourceOptions,
    playAudioFailClick,
    playWordAudio,
    resolveWordAudioUrl,
} from '@/Manatan/utils/wordAudio';
import { DictionaryResult, WordAudioSource, WordAudioSourceSelection } from '@/Manatan/types.ts';
import { StructuredContent } from '@/Manatan/components/DictionaryView.tsx';
import { PronunciationSection, extractPronunciationData } from '@/Manatan/components/Pronunciation.tsx';
import { makeToast } from '@/base/utils/Toast.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { addNote, findNotes, guiBrowse, updateLastCard } from '@/Manatan/utils/anki.ts';
import {
    AnimeHotkey,
    ANIME_HOTKEYS,
    ANIME_HOTKEY_DESCRIPTIONS,
    ANIME_HOTKEY_LABELS,
    DEFAULT_ANIME_HOTKEYS,
} from '@/Manatan/hotkeys/AnimeHotkeys.ts';

type SubtitleTrack = {
    url: string;
    lang: string;
    label?: string;
    source?: 'video' | 'jimaku' | 'local';
};

type VideoOption = {
    label: string;
    index: number;
};

type EpisodeOption = {
    label: string;
    index: number;
};

type SubtitleCue = {
    id: string;
    start: number;
    end: number;
    text: string;
};

type SwipeState = {
    startX: number;
    startY: number;
    startTime: number;
    moved: boolean;
};

type Props = {
    videoSrc: string;
    enableBraveAudioFix?: boolean;
    braveAudioFixMode?: 'auto' | 'on' | 'off';
    onBraveAudioFixModeChange?: (mode: 'auto' | 'on' | 'off') => void;
    episodeOptions?: EpisodeOption[];
    currentEpisodeIndex?: number | null;
    onEpisodeSelect?: (index: number) => void;
    isHlsSource: boolean;
    videoOptions: VideoOption[];
    selectedVideoIndex: number;
    onVideoChange: (index: number) => void;
    subtitleTracks: SubtitleTrack[];
    subtitleTracksReady: boolean;
    jimakuTitleOverride?: string | null;
    onRequestJimakuTitleOverride?: () => void;
    onExit: () => void;
    title: string;
    animeId: string | number;
    fillHeight?: boolean;
    showFullscreenButton?: boolean;
    statusMessage?: string | null;
};

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SUBTITLE_TIME_EPSILON = 0.05;
const SUBTITLE_LATIN_WORD_REGEX = /[\p{L}\p{N}'’_-]/u;
const SUBTITLE_CJK_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

const getSubtitleHighlightRange = (
    text: string,
    caretOffset: number,
): { start: number; end: number } | null => {
    if (!text.length) {
        return null;
    }

    const length = text.length;
    let index = Math.min(Math.max(caretOffset, 0), length - 1);
    const isWordChar = (char: string) => SUBTITLE_LATIN_WORD_REGEX.test(char);
    const isCjkChar = (char: string) => SUBTITLE_CJK_REGEX.test(char);

    const pickNearestWordChar = () => {
        let left = index - 1;
        let right = index + 1;
        while (left >= 0 || right < length) {
            if (left >= 0) {
                const char = text[left];
                if (isWordChar(char) || isCjkChar(char)) {
                    index = left;
                    return char;
                }
                left -= 1;
            }
            if (right < length) {
                const char = text[right];
                if (isWordChar(char) || isCjkChar(char)) {
                    index = right;
                    return char;
                }
                right += 1;
            }
        }
        return null;
    };

    let char = text[index];
    if (/\s/.test(char)) {
        let left = index - 1;
        while (left >= 0 && /\s/.test(text[left])) {
            left -= 1;
        }
        if (left >= 0) {
            index = left;
            char = text[index];
        } else {
            let right = index + 1;
            while (right < length && /\s/.test(text[right])) {
                right += 1;
            }
            if (right < length) {
                index = right;
                char = text[index];
            } else {
                return null;
            }
        }
    }

    if (!isWordChar(char) && !isCjkChar(char)) {
        const nearest = pickNearestWordChar();
        if (!nearest) {
            return null;
        }
        char = nearest;
    }

    const expandWhile = (predicate: (value: string) => boolean) => {
        let start = index;
        let end = index + 1;
        while (start - 1 >= 0 && predicate(text[start - 1])) {
            start -= 1;
        }
        while (end < length && predicate(text[end])) {
            end += 1;
        }
        return { start, end };
    };

    if (isCjkChar(char)) {
        return expandWhile(isCjkChar);
    }

    return expandWhile(isWordChar);
};

const normalizeSubtitleLabel = (label: string) =>
    label
        .replace(/^jimaku\s*-\s*/i, '')
        .replace(/\.(srt|vtt|ass|ssa)$/i, '')
        .replace(/第\s*\d+\s*話/gi, '')
        .replace(/s\d{1,2}e\d{1,3}/gi, '')
        .replace(/[\[(]\s*\d{1,3}(?:v\d+)?\s*[\])]/gi, '')
        .replace(/-\s*\d{1,3}(?:v\d+)?\b/gi, '')
        .replace(/[^a-z0-9]+/gi, '')
        .toLowerCase();

const buildSubtitleKey = (label: string, source?: SubtitleTrack['source']) => {
    const normalized = normalizeSubtitleLabel(label);
    if (!normalized) {
        return null;
    }
    const resolvedSource = source ?? (label.toLowerCase().startsWith('jimaku -') ? 'jimaku' : 'video');
    return `${resolvedSource}:${normalized}`;
};

const parseTimestamp = (value: string): number => {
    const parts = value.trim().replace(',', '.').split(':');
    const [hours, minutes, seconds] = parts.length === 3 ? parts : ['0', parts[0], parts[1]];
    const [sec, ms = '0'] = seconds.split('.');
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(sec) + Number(ms.padEnd(3, '0')) / 1000;
};

const parseVttOrSrt = (input: string): SubtitleCue[] => {
    const lines = input.replace(/\r/g, '').split('\n');
    const cues: SubtitleCue[] = [];
    let index = 0;
    let cueIndex = 0;

    while (index < lines.length) {
        const line = lines[index].trim();
        if (!line) {
            index += 1;
            continue;
        }

        if (/^\d+$/.test(line)) {
            index += 1;
        }

        const timeLine = lines[index] ?? '';
        if (!timeLine.includes('-->')) {
            index += 1;
            continue;
        }

        const [startRaw, endRaw] = timeLine.split('-->').map((part) => part.trim().split(' ')[0]);
        const start = parseTimestamp(startRaw);
        const end = parseTimestamp(endRaw);
        index += 1;
        const textLines: string[] = [];
        while (index < lines.length && lines[index].trim() !== '') {
            textLines.push(lines[index]);
            index += 1;
        }

        const text = textLines.join('\n').replace(/<[^>]+>/g, '');
        const id = `${start}-${end}-${cueIndex}`;
        cues.push({ id, start, end, text });
        cueIndex += 1;
    }

    return cues;
};

const parseAss = (input: string): SubtitleCue[] => {
    const lines = input.replace(/\r/g, '').split('\n');
    const cues: SubtitleCue[] = [];
    let cueIndex = 0;
    let inEvents = false;
    let format: string[] = [];

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('[Events]')) {
            inEvents = true;
            return;
        }
        if (!inEvents) {
            return;
        }
        if (trimmed.startsWith('Format:')) {
            format = trimmed
                .replace('Format:', '')
                .split(',')
                .map((part) => part.trim());
            return;
        }
        if (!trimmed.startsWith('Dialogue:') || !format.length) {
            return;
        }

        const payload = trimmed.replace('Dialogue:', '').trim();
        const parts = payload.split(',');
        const textIndex = format.indexOf('Text');
        const startIndex = format.indexOf('Start');
        const endIndex = format.indexOf('End');
        if (textIndex < 0 || startIndex < 0 || endIndex < 0) {
            return;
        }

        const textParts = parts.slice(textIndex).join(',');
        const rawText = textParts
            .replace(/\{[^}]+\}/g, '')
            .replace(/\\N/g, '\n')
            .replace(/\\n/g, '\n');

        const text = rawText.replace(/<[^>]+>/g, '').trim();
        if (!text) {
            return;
        }

        const start = parseTimestamp(parts[startIndex]);
        const end = parseTimestamp(parts[endIndex]);
        const id = `${start}-${end}-${cueIndex}`;
        cues.push({ id, start, end, text });
        cueIndex += 1;
    });

    return cues;
};

const parseSubtitles = (input: string, url: string): SubtitleCue[] => {
    const trimmed = input.trim();
    const lowerUrl = url.toLowerCase();
    if (trimmed.startsWith('WEBVTT') || lowerUrl.endsWith('.vtt')) {
        return parseVttOrSrt(trimmed);
    }
    if (lowerUrl.endsWith('.srt')) {
        return parseVttOrSrt(trimmed);
    }
    if (lowerUrl.endsWith('.ass') || lowerUrl.endsWith('.ssa') || trimmed.includes('[Events]')) {
        return parseAss(trimmed);
    }

    return parseVttOrSrt(trimmed);
};

const splitTagString = (tag: string): string[] =>
    tag
        .split(/\s+/)
        .map((part) => part.trim())
        .filter(Boolean);

const normalizeTagList = (tags: string[]): string[] =>
    tags.flatMap((tag) => splitTagString(tag));

const generateAnkiFurigana = (entry: DictionaryResult): string => {
    if (!entry.furigana || entry.furigana.length === 0) {
        return entry.headword;
    }
    return entry.furigana
        .map((segment) => {
            if (!Array.isArray(segment)) {
                return '';
            }
            const kanji = segment[0] ?? '';
            const kana = segment[1];
            if (kana && kana !== kanji) {
                return `${kanji}[${kana}]`;
            }
            return kanji;
        })
        .join('');
};


const getLowestFrequency = (entry: DictionaryResult): string => {
    if (!entry.frequencies || entry.frequencies.length === 0) {
        return '';
    }
    const numbers = entry.frequencies
        .map((frequency) => {
            const cleaned = frequency.value?.replace?.(/[^\d]/g, '') ?? '';
            return parseInt(cleaned, 10);
        })
        .filter((value) => Number.isFinite(value));
    if (!numbers.length) {
        return '';
    }
    return Math.min(...numbers).toString();
};

const generateAnkiPitchAccent = (entry: DictionaryResult): string => {
    const { pitchAccents } = extractPronunciationData(entry);
    if (!pitchAccents || pitchAccents.length === 0) return '';

    const seenPitches = new Set<string>();

    return pitchAccents.map(pa => {
        const morae = pa.reading ? pa.reading.split('').filter(c => c !== ' ') : (entry.reading || entry.headword).split('').filter(c => c !== ' ');
        const reading = morae.join('');

        const pitchHtml = pa.pitches.map(p => {
            const pos = typeof p.position === 'number' ? p.position : 0;
            const pattern = p.pattern || '';
            const nasal = p.nasal || [];
            const devoice = p.devoice || [];

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

                const style = `display:inline-flex;flex-direction:column;align-items:center;padding:0 1px;${isHigh ? 'padding-top:0' : 'padding-top:8px'};`;
                const lineStyle = `position:absolute;left:0;right:0;height:0.125em;background-color:currentColor;${isHigh ? 'top:0' : 'top:0.375em'};`;
                const nasalStyle = 'position:absolute;top:-0.3em;left:50%;transform:translateX(-50%);width:0.3em;height:0.3em;border-radius:50%;background:#3498db;opacity:0.6;';

                let extra = '';
                if (hasNasal) extra += `<span style="${nasalStyle}"></span>`;
                if (hasDevoice) extra += `<span style="position:absolute;top:-0.25em;right:0;font-size:0.5em;">°</span>`;

                textHtml += `<span style="position:relative;${style}">${mora}<span style="${lineStyle}"></span>${extra}</span>`;
            });

            return textHtml;
        }).filter(Boolean).join('');

        if (!pitchHtml) return '';

        const dictLabel = pa.dictionaryName ? `<span style="font-size:0.7em;color:#888;background:rgba(139,92,246,0.2);padding:2px 6px;border-radius:3px;margin-right:4px;">${pa.dictionaryName}</span>` : '';
        return `<div style="margin-bottom:4px;">${dictLabel}<span style="display:inline-flex;align-items:flex-end;">${pitchHtml}</span></div>`;
    }).filter(Boolean).join('');
};

const getTermTagLabel = (tag: unknown): string => {
    if (typeof tag === 'string') {
        return tag;
    }
    if (tag && typeof tag === 'object') {
        const record = tag as { name?: string; label?: string; tag?: string; value?: string };
        return record.name || record.label || record.tag || record.value || '';
    }
    return '';
};

const buildDefinitionHtml = (entry: DictionaryResult, dictionaryName?: string): string => {
    const styleToString = (style: Record<string, any>): string => {
        if (!style) {
            return '';
        }
        return Object.entries(style)
            .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}:${value}`)
            .join(';');
    };

    const generateHTML = (node: any): string => {
        if (node === null || node === undefined) {
            return '';
        }
        if (typeof node === 'string' || typeof node === 'number') {
            return String(node);
        }
        if (Array.isArray(node)) {
            return node.map(generateHTML).join('');
        }
        if (node.type === 'structured-content') {
            return generateHTML(node.content);
        }
        if (node?.data?.content === 'attribution') {
            return '';
        }

        const { tag, content, style, href, data } = node;
        const customStyle = styleToString(style);
        const classNames = typeof data?.class === 'string' ? data.class.split(/\s+/) : [];
        const isTagClass = classNames.includes('tag');
        const tagClassStyle = isTagClass
            ? 'display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 0.75em; font-weight: bold; margin-right: 6px; color: #fff; background-color: #666; vertical-align: middle; line-height: 1.2;'
            : '';

        if (tag === 'ul') {
            return `<ul style="padding-left: 20px; margin: 2px 0; list-style-type: disc;${customStyle}">${generateHTML(content)}</ul>`;
        }
        if (tag === 'ol') {
            return `<ol style="padding-left: 20px; margin: 2px 0; list-style-type: decimal;${customStyle}">${generateHTML(content)}</ol>`;
        }
        if (tag === 'li') {
            return `<li style="${customStyle}">${generateHTML(content)}</li>`;
        }
        if (tag === 'table') {
            return `<table style="border-collapse: collapse; width: 100%; border: 1px solid #777;${customStyle}"><tbody>${generateHTML(content)}</tbody></table>`;
        }
        if (tag === 'tr') {
            return `<tr style="${customStyle}">${generateHTML(content)}</tr>`;
        }
        if (tag === 'th') {
            return `<th style="border: 1px solid #777; padding: 2px 8px; text-align: center; font-weight: bold;${customStyle}">${generateHTML(content)}</th>`;
        }
        if (tag === 'td') {
            return `<td style="border: 1px solid #777; padding: 2px 8px; text-align: center;${customStyle}">${generateHTML(content)}</td>`;
        }
        if (tag === 'span') {
            return `<span style="${tagClassStyle}${customStyle}">${generateHTML(content)}</span>`;
        }
        if (tag === 'div') {
            return `<div style="${customStyle}">${generateHTML(content)}</div>`;
        }
        if (tag === 'a') {
            return `<a href="${href}" target="_blank" style="text-decoration: underline;${customStyle}">${generateHTML(content)}</a>`;
        }

        return generateHTML(content);
    };

    const glossaryEntries = dictionaryName
        ? entry.glossary.filter((def) => def.dictionaryName === dictionaryName)
        : entry.glossary;
    if (!glossaryEntries.length) {
        return '';
    }
    return glossaryEntries
        .map((def, idx) => {
            const tagsHTML = normalizeTagList(def.tags ?? []).map(
                (tag) =>
                    `<span style="display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 0.75em; font-weight: bold; margin-right: 6px; color: #fff; background-color: #666; vertical-align: middle;">${tag}</span>`,
            );
            const dictHTML = `<span style="display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 0.75em; font-weight: bold; margin-right: 6px; color: #fff; background-color: #9b59b6; vertical-align: middle;">${def.dictionaryName}</span>`;
            const headerHTML = [...tagsHTML, dictHTML].join(' ');
            const contentHTML = def.content
                .map((content) => {
                    try {
                        const parsed = JSON.parse(content);
                        return `<div style="margin-bottom: 2px;">${generateHTML(parsed)}</div>`;
                    } catch {
                        return `<div>${content}</div>`;
                    }
                })
                .join('');
            return `
                <div style="margin-bottom: 12px; display: flex;">
                    <div style="flex-shrink: 0; width: 24px; font-weight: bold;">${idx + 1}.</div>
                    <div style="flex-grow: 1;">
                        <div style="margin-bottom: 4px;">${headerHTML}</div>
                        <div>${contentHTML}</div>
                    </div>
                </div>
            `;
        })
        .join('');
};

const getDictionaryEntryKey = (entry: DictionaryResult) => `${entry.headword}::${entry.reading}`;

export const AnimeVideoPlayer = ({
    videoSrc,
    enableBraveAudioFix = false,
    braveAudioFixMode = 'auto',
    onBraveAudioFixModeChange,
    episodeOptions = [],
    currentEpisodeIndex = null,
    onEpisodeSelect,
    isHlsSource,
    videoOptions,
    selectedVideoIndex,
    onVideoChange,
    subtitleTracks,
    subtitleTracksReady,
    jimakuTitleOverride,
    onRequestJimakuTitleOverride,
    onExit,
    title,
    animeId,
    fillHeight = false,
    showFullscreenButton,
    statusMessage,
}: Props) => {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    const isTouchDevice = MediaQuery.useIsTouchDevice();
    const isNarrowScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const isMobile = isTouchDevice || isNarrowScreen;
    const { isAndroid, isDesktopPlatform } = useMemo(() => {
        const ua = navigator.userAgent;
        const android = /android/i.test(ua);
        const ios = /iphone|ipad|ipod/i.test(ua);
        return { isAndroid: android, isDesktopPlatform: !android && !ios };
    }, []);
    const isLandscape = useMediaQuery('(orientation: landscape)');
    const shouldShowFullscreen = showFullscreenButton ?? isDesktop;
    const shouldShowVolume = isDesktopPlatform;
    const infoButtonLabel = isDesktopPlatform ? 'Show keyboard shortcuts' : 'Show tap zone';
    const { wasPopupClosedRecently, settings, openSettings, showAlert } = useOCR();
    const { enableScope, disableScope } = useHotkeysContext();
    const animeHotkeys = useMemo(() => ({
        ...DEFAULT_ANIME_HOTKEYS,
        ...(settings.animeHotkeys ?? {}),
    }), [settings.animeHotkeys]);
    const hotkeyScopeOptions = useMemo(() => ({
        preventDefault: true,
        ...HOTKEY_SCOPES[HotkeyScope.ANIME],
    }), []);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const swipeStateRef = useRef<SwipeState | null>(null);
    const swipeConsumedRef = useRef(false);
    const [isPaused, setIsPaused] = useState(true);
    const [isVideoLoading, setIsVideoLoading] = useState(true);
    const [isOverlayVisible, setIsOverlayVisible] = useState(true);
    const [autoOverlayDisabled, setAutoOverlayDisabled] = useState(false);
    const [activeCues, setActiveCues] = useState<SubtitleCue[]>([]);
    const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | null>(null);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [volume, setVolume] = useLocalStorage<number>('anime-player-volume', 1);
    const safeVolume = Number.isFinite(volume) ? Math.min(Math.max(volume, 0), 1) : 1;
    const volumePercent = Math.round(safeVolume * 100);
    const [videoMenuAnchor, setVideoMenuAnchor] = useState<null | HTMLElement>(null);
    const [subtitleMenuAnchor, setSubtitleMenuAnchor] = useState<null | HTMLElement>(null);
    const [speedMenuAnchor, setSpeedMenuAnchor] = useState<null | HTMLElement>(null);
    const [episodeMenuAnchor, setEpisodeMenuAnchor] = useState<null | HTMLElement>(null);
    const [subtitleOffsetMs, setSubtitleOffsetMs] = useLocalStorage<number>(
        `anime-${animeId}-subtitle-offset-ms`,
        0,
    );
    const safeSubtitleOffsetMs = Number.isFinite(subtitleOffsetMs) ? subtitleOffsetMs : 0;
    const [subtitleOffsetDialogOpen, setSubtitleOffsetDialogOpen] = useState(false);
    const [subtitleOffsetInput, setSubtitleOffsetInput] = useState(`${safeSubtitleOffsetMs}`);
    const [highlightedSubtitle, setHighlightedSubtitle] = useState<{
        key: string;
        start: number;
        end: number;
    } | null>(null);
    const [savedSubtitleLabel, setSavedSubtitleLabel] = useLocalStorage<string | null>(
        `anime-${animeId}-subtitle-label`,
        null,
    );
    const [savedSubtitleKey, setSavedSubtitleKey] = useLocalStorage<string | null>(
        `anime-${animeId}-subtitle-key`,
        null,
    );
    const [autoPlayNextEpisode, setAutoPlayNextEpisode] = useLocalStorage<boolean>(
        'anime-auto-play-next-episode',
        true,
    );
    const [savedPlaybackRate, setSavedPlaybackRate] = useLocalStorage<number | null>(
        `anime-${animeId}-playback-rate`,
        null,
    );
    const episodeKey = useMemo(() => {
        if (currentEpisodeIndex !== null && currentEpisodeIndex !== undefined) {
            return `ep-${currentEpisodeIndex}`;
        }
        return 'single';
    }, [currentEpisodeIndex]);
    const [savedPlaybackPosition, setSavedPlaybackPosition] = useLocalStorage<number | null>(
        `anime-${animeId}-${episodeKey}-playback-position`,
        null,
    );
    const [braveBufferSeconds, setBraveBufferSeconds] = useLocalStorage<number>(
        'anime-brave-buffer-seconds',
        20,
    );
    const [braveWarmupSeconds, setBraveWarmupSeconds] = useLocalStorage<number>(
        'anime-brave-warmup-seconds',
        7,
    );
    const [dictionaryVisible, setDictionaryVisible] = useState(false);
    const [dictionaryResults, setDictionaryResults] = useState<DictionaryResult[]>([]);
    const [dictionaryLoading, setDictionaryLoading] = useState(false);
    const [, setDictionarySystemLoading] = useState(false);
    const [, setDictionaryQuery] = useState('');
    const [wordAudioMenuAnchor, setWordAudioMenuAnchor] = useState<{ top: number; left: number } | null>(null);
    const [wordAudioMenuEntry, setWordAudioMenuEntry] = useState<DictionaryResult | null>(null);
    const [wordAudioSelection, setWordAudioSelection] = useState<WordAudioSourceSelection>('auto');
    const [wordAudioSelectionKey, setWordAudioSelectionKey] = useState<string | null>(null);
    const [wordAudioAvailability, setWordAudioAvailability] = useState<Record<WordAudioSource, boolean> | null>(null);
    const [wordAudioAutoAvailable, setWordAudioAutoAvailable] = useState<boolean | null>(null);
    const [isCaptureMode, setIsCaptureMode] = useState(false);
    const [dictionaryContext, setDictionaryContext] = useState<{
        sentence: string;
        audioStart: number;
        audioEnd: number;
    } | null>(null);
    const [ankiActionPending, setAnkiActionPending] = useState<Record<string, boolean>>({});
    const [showTapZoneHint, setShowTapZoneHint] = useState(false);
    const [showShortcutHint, setShowShortcutHint] = useState(false);
    const [isBrave, setIsBrave] = useState(false);
    const [isBraveLinux, setIsBraveLinux] = useState(false);
    const [showBraveProxyToggle, setShowBraveProxyToggle] = useState(false);
    const [autoBraveFixDetected, setAutoBraveFixDetected] = useState(false);
    const [isSubtitleDisabled, setIsSubtitleDisabled] = useLocalStorage<boolean>(
        `anime-${animeId}-subtitle-disabled`,
        false,
    );
    const [localSubtitleTracks, setLocalSubtitleTracks] = useState<SubtitleTrack[]>([]);
    const lastSubtitleWarningRef = useRef<string | null>(null);
    const lastPlaybackWarningRef = useRef<number | null>(null);
    const subtitleRequestRef = useRef(0);
    const dictionaryRequestRef = useRef(0);
    const dictionaryVisibleRef = useRef(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) {
            return;
        }
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
    }, []);
    const menuInteractionRef = useRef(0);
    const resumePlaybackRef = useRef(false);
    const resumePositionAppliedRef = useRef(false);
    const lastSavedPositionRef = useRef<number | null>(null);
    const lastSavedAtRef = useRef(0);
    const overlayVisibilityRef = useRef(false);
    const dictionaryOpenedByHoverRef = useRef(false);
    const autoPlayWordAudioKeyRef = useRef<string | null>(null);
    const hoverLookupRef = useRef<{ cueKey: string; charOffset: number } | null>(null);
    const hoverLookupTimerRef = useRef<number | null>(null);
    const braveMutedRef = useRef(false);
    const braveVolumeRef = useRef<number | null>(null);
    const braveResetPendingRef = useRef(false);
    const userPausedRef = useRef(false);
    const hlsRef = useRef<Hls | null>(null);
    const hlsManifestReadyRef = useRef(false);
    const braveResetScheduledRef = useRef(false);
    const braveScheduleRef = useRef<((instance: Hls) => void) | null>(null);
    const shouldApplyBraveFix =
        isBraveLinux &&
        enableBraveAudioFix &&
        (braveAudioFixMode === 'on' || (braveAudioFixMode === 'auto' && autoBraveFixDetected));
    const [isPageFullscreen, setIsPageFullscreen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const isAnyMenuOpen = Boolean(
        videoMenuAnchor || subtitleMenuAnchor || speedMenuAnchor || episodeMenuAnchor || wordAudioMenuAnchor,
    );
    const isFullscreenOverlay = isPageFullscreen || (fillHeight && isMobile);
    const menuContainer = isFullscreenOverlay ? wrapperRef.current ?? undefined : undefined;
    const wordAudioOptions = useMemo(
        () => getWordAudioSourceOptions(settings.yomitanLanguage),
        [settings.yomitanLanguage],
    );
    const activeWordAudioSelection = useMemo(() => {
        if (!wordAudioMenuEntry) {
            return 'auto' as WordAudioSourceSelection;
        }
        const entryKey = getDictionaryEntryKey(wordAudioMenuEntry);
        return wordAudioSelectionKey === entryKey ? wordAudioSelection : 'auto';
    }, [getDictionaryEntryKey, wordAudioMenuEntry, wordAudioSelection, wordAudioSelectionKey]);
    const braveSegmentDurationRef = useRef<number | null>(null);
    const localSubtitleCuesRef = useRef<Map<string, SubtitleCue[]>>(new Map());
    const subtitleFileInputRef = useRef<HTMLInputElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const audioGainRef = useRef<GainNode | null>(null);
    const audioCaptureLockRef = useRef(false);
    const [ankiStatusByEntry, setAnkiStatusByEntry] = useState<
        Record<string, { status: 'unknown' | 'loading' | 'missing' | 'exists'; noteId?: number | null }>
    >({});
    const ankiActionPendingRef = useRef<Record<string, boolean>>({});
    const shouldRenderSubtitles = !isSubtitleDisabled && selectedSubtitleIndex !== null;

    const resetSubtitleDisplay = useCallback(() => {
        if (subtitleRenderResetRef.current !== null) {
            window.cancelAnimationFrame(subtitleRenderResetRef.current);
            subtitleRenderResetRef.current = null;
        }
        activeCueKeyRef.current = '';
        setActiveCues([]);
        setSubtitleCues([]);
        setHighlightedSubtitle(null);
    }, []);

    const openSubtitleOffsetDialog = useCallback(() => {
        const currentValue = Number.isFinite(safeSubtitleOffsetMs) ? safeSubtitleOffsetMs : 0;
        setSubtitleOffsetInput(`${currentValue}`);
        setSubtitleOffsetDialogOpen(true);
    }, [safeSubtitleOffsetMs]);

    const closeSubtitleOffsetDialog = useCallback(() => {
        setSubtitleOffsetDialogOpen(false);
    }, []);

    const applySubtitleOffsetInput = useCallback(() => {
        const nextValue = Number(subtitleOffsetInput.trim());
        if (!Number.isFinite(nextValue)) {
            makeToast('Enter a valid number of milliseconds.', 'warning');
            return;
        }
        setSubtitleOffsetMs(Math.round(nextValue));
        setSubtitleOffsetDialogOpen(false);
    }, [setSubtitleOffsetMs, subtitleOffsetInput]);

    const resetSubtitleOffset = useCallback(() => {
        setSubtitleOffsetMs(0);
        setSubtitleOffsetInput('0');
        setSubtitleOffsetDialogOpen(false);
    }, [setSubtitleOffsetMs]);

    useEffect(() => {
        if (shouldRenderSubtitles) {
            return;
        }
        resetSubtitleDisplay();
    }, [resetSubtitleDisplay, shouldRenderSubtitles]);
    const subtitleRenderResetRef = useRef<number | null>(null);
    const activeCueKeyRef = useRef<string>('');

    useEffect(() => {
        dictionaryVisibleRef.current = dictionaryVisible;
    }, [dictionaryVisible]);

    useEffect(() => {
        if (isPaused && !dictionaryVisible && !autoOverlayDisabled) {
            setIsOverlayVisible(true);
        }
    }, [autoOverlayDisabled, isPaused, dictionaryVisible]);

    useEffect(() => {
        if (!isOverlayVisible || isPaused || dictionaryVisible || isAnyMenuOpen) {
            return;
        }
        const timeout = window.setTimeout(() => {
            if (!isPaused && !dictionaryVisible && !isAnyMenuOpen) {
                setIsOverlayVisible(false);
            }
        }, 4000);
        return () => {
            window.clearTimeout(timeout);
        };
    }, [dictionaryVisible, isAnyMenuOpen, isOverlayVisible, isPaused]);

    const availableSubtitleTracks = useMemo(
        () => [...subtitleTracks, ...localSubtitleTracks],
        [subtitleTracks, localSubtitleTracks],
    );

    const subtitleOptions = useMemo(
        () =>
            availableSubtitleTracks.map((track, index) => ({
                index,
                label: track.label || track.lang || `Subtitle ${index + 1}`,
            })),
        [availableSubtitleTracks],
    );
    const hasSubtitleTracks = subtitleOptions.length > 0;
    const shouldShowAutoPlayToggle = Boolean(onEpisodeSelect && episodeOptions.length > 1);

    const { previousEpisodeOption, nextEpisodeOption, shouldShowEpisodeNavigation } = useMemo(() => {
        if (!onEpisodeSelect || episodeOptions.length <= 1) {
            return {
                previousEpisodeOption: null,
                nextEpisodeOption: null,
                shouldShowEpisodeNavigation: false,
            };
        }
        if (currentEpisodeIndex === null || currentEpisodeIndex === undefined) {
            return {
                previousEpisodeOption: null,
                nextEpisodeOption: null,
                shouldShowEpisodeNavigation: true,
            };
        }
        const currentPosition = episodeOptions.findIndex((option) => option.index === currentEpisodeIndex);
        if (currentPosition < 0) {
            return {
                previousEpisodeOption: null,
                nextEpisodeOption: null,
                shouldShowEpisodeNavigation: true,
            };
        }
        return {
            previousEpisodeOption: currentPosition > 0 ? episodeOptions[currentPosition - 1] : null,
            nextEpisodeOption: currentPosition < episodeOptions.length - 1
                ? episodeOptions[currentPosition + 1]
                : null,
            shouldShowEpisodeNavigation: true,
        };
    }, [currentEpisodeIndex, episodeOptions, onEpisodeSelect]);

    useEffect(() => {
        if (!isPageFullscreen) {
            document.body.style.overflow = '';
            return;
        }

        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, [isPageFullscreen]);

    const isNativeFullscreenActive = useCallback(() => {
        if (typeof document === 'undefined') {
            return false;
        }
        const wrapper = wrapperRef.current;
        const fullscreenElement = document.fullscreenElement;
        if (!wrapper || !fullscreenElement) {
            return false;
        }
        return fullscreenElement.contains(wrapper) || wrapper.contains(fullscreenElement);
    }, []);

    const toggleFullscreen = useCallback(async () => {
        if (typeof document === 'undefined') {
            setIsPageFullscreen((prev) => !prev);
            return;
        }

        if (isNativeFullscreenActive()) {
            try {
                await document.exitFullscreen();
            } catch (err) {
                setIsPageFullscreen(false);
            }
            return;
        }

        const fullscreenTarget = document.documentElement;
        if (fullscreenTarget?.requestFullscreen) {
            try {
                await fullscreenTarget.requestFullscreen();
                setIsPageFullscreen(true);
            } catch (err) {
                setIsPageFullscreen(true);
            }
            return;
        }

        setIsPageFullscreen((prev) => !prev);
    }, [isNativeFullscreenActive]);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }
        const handleChange = () => {
            if (!wrapperRef.current) {
                return;
            }
            setIsPageFullscreen(isNativeFullscreenActive());
        };
        document.addEventListener('fullscreenchange', handleChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleChange);
        };
    }, [isNativeFullscreenActive]);

    useEffect(() => {
        if (!isMobile || !fillHeight) {
            return;
        }
        const orientation =
            (screen as typeof screen & {
                orientation?: { lock?: (orientation: string) => Promise<void>; unlock?: () => void };
            }).orientation ?? undefined;
        orientation?.lock?.('landscape').catch(() => {});
        return () => {
            orientation?.unlock?.();
        };
    }, [fillHeight, isMobile]);

    useEffect(() => {
        if (selectedSubtitleIndex !== null && availableSubtitleTracks[selectedSubtitleIndex]?.source === 'local') {
            return;
        }
        const storedLabel = savedSubtitleLabel ?? undefined;
        if (isSubtitleDisabled) {
            setSelectedSubtitleIndex(null);
            return;
        }
        if (!storedLabel && !savedSubtitleKey) {
            setSelectedSubtitleIndex(null);
            return;
        }

        const shouldWaitForJimaku =
            (storedLabel?.toLowerCase().startsWith('jimaku -') ?? false) ||
            (savedSubtitleKey?.startsWith('jimaku:') ?? false);
        if (!subtitleTracksReady && shouldWaitForJimaku) {
            setSelectedSubtitleIndex(null);
            return;
        }

        const desiredSource = savedSubtitleKey?.split(':')[0];
        let matchIndex = storedLabel
            ? subtitleOptions.findIndex((option) => option.label === storedLabel)
            : -1;
        if (matchIndex >= 0) {
            const matchedTrack = availableSubtitleTracks[matchIndex];
            if (desiredSource && desiredSource === 'jimaku' && matchedTrack?.source !== 'jimaku') {
                setSelectedSubtitleIndex(null);
            } else {
                setSelectedSubtitleIndex(matchIndex);
                if (matchedTrack?.source !== 'local') {
                    const matchedKey = buildSubtitleKey(subtitleOptions[matchIndex].label, matchedTrack?.source);
                    if (matchedKey && matchedKey !== savedSubtitleKey) {
                        setSavedSubtitleKey(matchedKey);
                    }
                }
                return;
            }
        }

        const fallbackKey = storedLabel ? buildSubtitleKey(storedLabel) : null;
        const effectiveKey = savedSubtitleKey ?? fallbackKey;
        if (effectiveKey) {
            const [desiredSource, desiredNormalized] = effectiveKey.split(':');
            const candidates = subtitleOptions
                .map((option) => ({
                    option,
                    normalized: normalizeSubtitleLabel(option.label),
                }))
                .filter((entry) => entry.normalized === desiredNormalized);
            if (candidates.length) {
                const withSource = candidates.find(
                    (entry) => availableSubtitleTracks[entry.option.index]?.source === desiredSource,
                );
                const chosen = withSource ?? (desiredSource === 'jimaku' ? null : candidates[0]);
                if (!chosen) {
                    // Wait for Jimaku-specific match.
                    return;
                }
                setSelectedSubtitleIndex(chosen.option.index);
                if (chosen.option.label !== storedLabel) {
                    setSavedSubtitleLabel(chosen.option.label);
                }
                if (savedSubtitleKey !== effectiveKey && availableSubtitleTracks[chosen.option.index]?.source !== 'local') {
                    setSavedSubtitleKey(effectiveKey);
                }
                return;
            }
        }

        if (subtitleOptions.length && lastSubtitleWarningRef.current !== storedLabel) {
            makeToast(`Subtitle preset "${storedLabel}" is not available for this episode.`, 'warning');
            lastSubtitleWarningRef.current = storedLabel ?? null;
        }
        setSelectedSubtitleIndex(null);
    }, [
        isSubtitleDisabled,
        savedSubtitleKey,
        savedSubtitleLabel,
        setSavedSubtitleKey,
        setSavedSubtitleLabel,
        selectedSubtitleIndex,
        subtitleOptions,
        availableSubtitleTracks,
        subtitleTracksReady,
    ]);

    useEffect(() => {
        if (savedPlaybackRate === null || savedPlaybackRate === undefined) {
            return;
        }
        if (!playbackRates.includes(savedPlaybackRate)) {
            if (lastPlaybackWarningRef.current !== savedPlaybackRate) {
                makeToast(`Playback speed preset ${savedPlaybackRate}x is unavailable.`, 'warning');
                lastPlaybackWarningRef.current = savedPlaybackRate;
            }
            setSavedPlaybackRate(null);
            applyPlaybackRate(1);
            return;
        }
        applyPlaybackRate(savedPlaybackRate);
    }, [savedPlaybackRate]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) {
            return;
        }
        if (Math.abs(video.volume - safeVolume) > 0.01) {
            video.volume = safeVolume;
        }
    }, [safeVolume, videoSrc]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) {
            return () => {};
        }
        const onVolumeChange = () => {
            const nextVolume = Math.min(Math.max(video.volume, 0), 1);
            setVolume((prev) => (Math.abs(prev - nextVolume) < 0.01 ? prev : nextVolume));
        };
        video.addEventListener('volumechange', onVolumeChange);
        return () => {
            video.removeEventListener('volumechange', onVolumeChange);
        };
    }, [setVolume, videoSrc]);

    const markMenuInteraction = useCallback(() => {
        menuInteractionRef.current = Date.now();
    }, []);

    const stopMenuEvent = useCallback((event?: unknown) => {
        (event as { stopPropagation?: () => void })?.stopPropagation?.();
    }, []);

    const stopMenuClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
        event.stopPropagation();
    }, []);

    const shouldIgnoreOverlayToggle = () => Date.now() - menuInteractionRef.current < 250;

    const braveAudioFixLabel = useMemo(() => {
        switch (braveAudioFixMode) {
            case 'on':
                return 'On';
            case 'off':
                return 'Off';
            default:
                return 'Auto';
        }
    }, [braveAudioFixMode]);

    const handleBraveAudioFixToggle = () => {
        if (!onBraveAudioFixModeChange) {
            return;
        }
        const nextMode =
            braveAudioFixMode === 'auto'
                ? 'on'
                : braveAudioFixMode === 'on'
                    ? 'off'
                    : 'auto';
        onBraveAudioFixModeChange(nextMode);
    };

    useEffect(() => {
        if (!episodeMenuAnchor || currentEpisodeIndex === null) {
            return;
        }
        const timeout = window.setTimeout(() => {
            const target = document.getElementById(`episode-option-${currentEpisodeIndex}`);
            target?.scrollIntoView({ block: 'center' });
        }, 50);
        return () => window.clearTimeout(timeout);
    }, [episodeMenuAnchor, currentEpisodeIndex, episodeOptions]);

    useEffect(() => {
        let isMounted = true;
        const nav = navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } };
        const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } })
            .userAgentData?.brands;
        const hasBraveBrand = brands?.some((entry) => entry.brand.toLowerCase().includes('brave')) ?? false;
        const hasBraveObject = Boolean(nav.brave);
        const uaLower = navigator.userAgent.toLowerCase();
        const uaHasBrave = uaLower.includes('brave');
        const platformLower = (navigator.platform || '').toLowerCase();
        const isLinux = uaLower.includes('linux') || platformLower.includes('linux');
        if (hasBraveBrand || hasBraveObject || uaHasBrave) {
            setShowBraveProxyToggle(true);
            setIsBraveLinux(isLinux);
        }
        if (nav.brave?.isBrave) {
            nav.brave
                .isBrave()
                .then((result) => {
                    if (isMounted) {
                        setIsBrave(Boolean(result));
                        if (result) {
                            setShowBraveProxyToggle(true);
                            setIsBraveLinux(isLinux);
                        }
                    }
                })
                .catch(() => {});
        } else if (navigator.userAgent.includes('Brave')) {
            setIsBrave(true);
            setShowBraveProxyToggle(true);
            setIsBraveLinux(isLinux);
        }
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!isBraveLinux || !enableBraveAudioFix || braveAudioFixMode !== 'auto' || !isHlsSource || !videoSrc) {
            setAutoBraveFixDetected(false);
            return () => {};
        }
        const controller = new AbortController();
        fetch(videoSrc, { credentials: 'include', signal: controller.signal })
            .then((response) => response.text())
            .then((text) => {
                const lower = text.toLowerCase();
                const hasAudioFixTag = lower.includes('#x-mangatan-audiofix');
                setAutoBraveFixDetected(hasAudioFixTag);
            })
            .catch(() => {
                setAutoBraveFixDetected(false);
            });
        return () => controller.abort();
    }, [videoSrc, isHlsSource, isBraveLinux, enableBraveAudioFix, braveAudioFixMode]);

    useEffect(() => {
        if (!shouldApplyBraveFix || braveResetScheduledRef.current) {
            return;
        }
        if (!hlsRef.current || !hlsManifestReadyRef.current || !braveScheduleRef.current) {
            return;
        }
        braveScheduleRef.current(hlsRef.current);
    }, [shouldApplyBraveFix]);

    useEffect(() => {
        if (selectedSubtitleIndex === null) {
            return;
        }
        if (selectedSubtitleIndex >= availableSubtitleTracks.length) {
            setSelectedSubtitleIndex(null);
        }
    }, [selectedSubtitleIndex, availableSubtitleTracks.length]);

    useEffect(() => {
        const video = videoRef.current;
        const shouldUseHls = isHlsSource;
        if (!video || !videoSrc) {
            return () => {};
        }

        let playTimeout: number | null = null;
        const braveResetTimeouts: number[] = [];
        userPausedRef.current = false;
        let bravePlayHandler: (() => void) | null = null;
        const playWhenBuffered = (minBufferSeconds: number, onReady?: () => void) => {
            if (!video) {
                return;
            }
            if (playTimeout !== null) {
                window.clearTimeout(playTimeout);
            }
            const buffered = video.buffered;
            if (buffered.length) {
                const end = buffered.end(buffered.length - 1);
                if (end - video.currentTime >= minBufferSeconds) {
                    if (onReady) {
                        onReady();
                    } else {
                        if (dictionaryVisibleRef.current) {
                            return;
                        }
                        video.play().catch(() => {});
                    }
                    return;
                }
            }
            playTimeout = window.setTimeout(() => playWhenBuffered(minBufferSeconds, onReady), 500);
        };
        const restoreBraveAudio = () => {
            if (!video) {
                return;
            }
            video.muted = braveMutedRef.current;
            if (braveVolumeRef.current !== null) {
                video.volume = braveVolumeRef.current;
            }
        };
        const clearBraveResets = () => {
            braveResetTimeouts.forEach((timeout) => window.clearTimeout(timeout));
            braveResetTimeouts.length = 0;
            braveResetPendingRef.current = false;
            if (bravePlayHandler) {
                video.removeEventListener('play', bravePlayHandler as EventListener);
                bravePlayHandler = null;
            }
            braveResetScheduledRef.current = false;
        };
        const scheduleBraveAudioResets = (hlsInstance: Hls) => {
            if (!shouldApplyBraveFix) {
                return;
            }
            clearBraveResets();
            const baseDelayMs = Math.max(1, braveWarmupSeconds) * 1000;
            const delayMs = Math.min(2000, baseDelayMs);
            const maxAttempts = 8;
            const attemptReset = (attempt: number) => {
                if (video.paused) {
                    braveResetPendingRef.current = true;
                    return;
                }
                const current = Math.max(video.currentTime, 0.1);
                const segmentDuration = braveSegmentDurationRef.current ?? 6;
                const segmentIndex = Math.floor(current / segmentDuration);
                const boundaryTarget = (segmentIndex + 2) * segmentDuration;
                const boundedTarget = Math.min(boundaryTarget, video.duration || boundaryTarget);
                const segmentJump = boundedTarget > current + 0.5
                    ? boundedTarget
                    : current + segmentDuration;
                const buffered = video.buffered;
                const bufferEnd = buffered.length ? buffered.end(buffered.length - 1) : 0;
                if (bufferEnd < segmentJump - 0.25 && attempt < maxAttempts) {
                    const retryTimeout = window.setTimeout(() => attemptReset(attempt + 1), 400);
                    braveResetTimeouts.push(retryTimeout);
                    return;
                }
                braveMutedRef.current = video.muted;
                braveVolumeRef.current = video.volume;
                video.muted = true;
                video.volume = 0;
                hlsInstance.stopLoad();
                if (typeof hlsInstance.swapAudioCodec === 'function') {
                    hlsInstance.swapAudioCodec();
                }
                hlsInstance.recoverMediaError();
                hlsInstance.startLoad(segmentJump);
                video.currentTime = segmentJump;
                setTimeout(() => {
                    video.currentTime = current;
                }, 250);
                video.muted = braveMutedRef.current;
                if (braveVolumeRef.current !== null) {
                    video.volume = braveVolumeRef.current;
                }
                if (dictionaryVisibleRef.current) {
                    return;
                }
                video.play().catch(() => {});
            };
            if (video.paused) {
                braveResetPendingRef.current = true;
                if (!bravePlayHandler) {
                    bravePlayHandler = () => {
                        braveResetPendingRef.current = false;
                        scheduleBraveAudioResets(hlsInstance);
                    };
                    video.addEventListener('play', bravePlayHandler as EventListener, { once: true });
                }
                return;
            }
            const timeout = window.setTimeout(() => attemptReset(0), delayMs);
            braveResetTimeouts.push(timeout);
            braveResetScheduledRef.current = true;
        };
        braveScheduleRef.current = scheduleBraveAudioResets;
        const attemptPlay = (force = false) => {
            if (!force && userPausedRef.current) {
                return;
            }
            if (dictionaryVisibleRef.current) {
                return;
            }
            if (isBrave && shouldUseHls) {
                playWhenBuffered(Math.max(1, Math.min(3, braveBufferSeconds)));
                return;
            }
            if (isBrave) {
                playWhenBuffered(Math.max(1, Math.min(3, braveBufferSeconds)));
                return;
            }
            video.play().catch(() => {});
        };

        if (!shouldUseHls) {
            video.src = videoSrc;
            video.load();
            userPausedRef.current = false;
            attemptPlay(true);
            return () => {
                if (playTimeout !== null) {
                    window.clearTimeout(playTimeout);
                }
                clearBraveResets();
                restoreBraveAudio();
            };
        }

        if (!isBrave && video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = videoSrc;
            video.load();
            userPausedRef.current = false;
            attemptPlay(true);
            return () => {
                if (playTimeout !== null) {
                    window.clearTimeout(playTimeout);
                }
                clearBraveResets();
                restoreBraveAudio();
            };
        }

        if (!Hls.isSupported()) {
            video.src = videoSrc;
            video.load();
            userPausedRef.current = false;
            attemptPlay(true);
            return () => {
                if (playTimeout !== null) {
                    window.clearTimeout(playTimeout);
                }
                clearBraveResets();
                restoreBraveAudio();
            };
        }

        const hls = new Hls(
            isBrave
                ? {
                    enableWorker: false,
                    lowLatencyMode: false,
                    maxBufferLength: 120,
                    maxBufferSize: 120 * 1000 * 1000,
                    backBufferLength: 30,
                }
                : { enableWorker: true, lowLatencyMode: true },
        );
        hlsRef.current = hls;
        hlsManifestReadyRef.current = false;
        hls.loadSource(videoSrc);
        hls.attachMedia(video);
        hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
            const targetDuration = data?.details?.targetduration;
            if (targetDuration && targetDuration > 0) {
                braveSegmentDurationRef.current = targetDuration;
            }
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            hlsManifestReadyRef.current = true;
            attemptPlay(true);
            if (shouldApplyBraveFix) {
                scheduleBraveAudioResets(hls);
            }
        });
        hls.on(Hls.Events.BUFFER_APPENDED, () => {
            if (isBrave) {
                attemptPlay();
            }
        });
        return () => {
            if (playTimeout !== null) {
                window.clearTimeout(playTimeout);
            }
            clearBraveResets();
            restoreBraveAudio();
            hlsRef.current = null;
            hlsManifestReadyRef.current = false;
            hls.destroy();
        };
    }, [
        videoSrc,
        isHlsSource,
        isBrave,
        isBraveLinux,
        braveBufferSeconds,
        braveWarmupSeconds,
        enableBraveAudioFix,
        shouldApplyBraveFix,
        braveAudioFixMode,
        autoBraveFixDetected,
    ]);

    const tapZoneHintTimeoutRef = useRef<number | null>(null);
    const shortcutHintTimeoutRef = useRef<number | null>(null);
    const showTapZoneHintFor = useCallback(
        (durationMs: number = 3000) => {
            if (!isMobile) {
                setShowTapZoneHint(false);
                return;
            }
            setShowTapZoneHint(true);
            if (tapZoneHintTimeoutRef.current !== null) {
                window.clearTimeout(tapZoneHintTimeoutRef.current);
            }
            tapZoneHintTimeoutRef.current = window.setTimeout(() => {
                setShowTapZoneHint(false);
                tapZoneHintTimeoutRef.current = null;
            }, durationMs);
        },
        [isMobile],
    );

    const showShortcutHintFor = useCallback(
        (durationMs: number = 6000) => {
            if (!isDesktopPlatform) {
                setShowShortcutHint(false);
                return;
            }
            setShowShortcutHint(true);
            if (shortcutHintTimeoutRef.current !== null) {
                window.clearTimeout(shortcutHintTimeoutRef.current);
            }
            shortcutHintTimeoutRef.current = window.setTimeout(() => {
                setShowShortcutHint(false);
                shortcutHintTimeoutRef.current = null;
            }, durationMs);
        },
        [isDesktopPlatform],
    );

    useEffect(() => () => {
        if (tapZoneHintTimeoutRef.current !== null) {
            window.clearTimeout(tapZoneHintTimeoutRef.current);
        }
        if (shortcutHintTimeoutRef.current !== null) {
            window.clearTimeout(shortcutHintTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        showTapZoneHintFor(3000);
    }, [showTapZoneHintFor, videoSrc]);

    useEffect(() => {
        setIsVideoLoading(true);
    }, [videoSrc]);

    useEffect(() => {
        setLocalSubtitleTracks([]);
        localSubtitleCuesRef.current.clear();
    }, [videoSrc]);

    useEffect(() => {
        resumePositionAppliedRef.current = false;
        lastSavedPositionRef.current = null;
        lastSavedAtRef.current = 0;
    }, [episodeKey, animeId, videoSrc]);

    const persistPlaybackPosition = useCallback((time: number, force = false) => {
        if (!resumePositionAppliedRef.current) {
            return;
        }
        if (!Number.isFinite(time) || time < 0) {
            return;
        }
        if (time <= 0.5) {
            if (force) {
                setSavedPlaybackPosition(null);
                lastSavedPositionRef.current = null;
                lastSavedAtRef.current = 0;
            }
            return;
        }
        const video = videoRef.current;
        const resolvedDuration = Number.isFinite(duration) && duration > 0
            ? duration
            : Number(video?.duration) || 0;
        if (resolvedDuration > 0 && time >= resolvedDuration - 3) {
            setSavedPlaybackPosition(null);
            lastSavedPositionRef.current = null;
            lastSavedAtRef.current = 0;
            return;
        }
        const now = Date.now();
        const lastTime = lastSavedPositionRef.current ?? 0;
        if (!force && Math.abs(time - lastTime) < 5 && now - lastSavedAtRef.current < 4000) {
            return;
        }
        lastSavedPositionRef.current = time;
        lastSavedAtRef.current = now;
        setSavedPlaybackPosition(Number(time.toFixed(3)));
    }, [duration, setSavedPlaybackPosition]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return () => {};

        const markLoading = () => setIsVideoLoading(true);
        const clearLoading = () => setIsVideoLoading(false);
        const onPlay = () => {
            userPausedRef.current = false;
            setIsPaused(false);
        };
        const onPause = () => {
            setIsPaused(true);
        };
        const onTimeUpdate = () => setCurrentTime(video.currentTime);
        const onDurationChange = () => setDuration(video.duration || 0);
        const onProgress = () => {
            if (!video.duration || !video.buffered.length) {
                setBuffered(0);
                return;
            }
            const end = video.buffered.end(video.buffered.length - 1);
            setBuffered(Math.min(end / video.duration, 1));
        };

        video.addEventListener('loadstart', markLoading);
        video.addEventListener('waiting', markLoading);
        video.addEventListener('stalled', markLoading);
        video.addEventListener('seeking', markLoading);
        video.addEventListener('canplay', clearLoading);
        video.addEventListener('playing', clearLoading);
        video.addEventListener('seeked', clearLoading);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('progress', onProgress);
        return () => {
            video.removeEventListener('loadstart', markLoading);
            video.removeEventListener('waiting', markLoading);
            video.removeEventListener('stalled', markLoading);
            video.removeEventListener('seeking', markLoading);
            video.removeEventListener('canplay', clearLoading);
            video.removeEventListener('playing', clearLoading);
            video.removeEventListener('seeked', clearLoading);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('progress', onProgress);
        };
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) {
            return;
        }
        if (resumePositionAppliedRef.current) {
            return;
        }
        const storedPosition = Number(savedPlaybackPosition);
        if (!Number.isFinite(storedPosition) || storedPosition <= 0.5) {
            resumePositionAppliedRef.current = true;
            return;
        }

        const applyPosition = () => {
            if (resumePositionAppliedRef.current) {
                return;
            }
            const resolvedDuration = Number.isFinite(video.duration) && video.duration > 0
                ? video.duration
                : 0;
            const maxPosition = resolvedDuration > 0 ? Math.max(0, resolvedDuration - 1) : storedPosition;
            const targetPosition = Math.min(storedPosition, maxPosition);
            if (targetPosition <= 0.5) {
                resumePositionAppliedRef.current = true;
                return;
            }
            if (Math.abs(video.currentTime - targetPosition) > 0.5) {
                video.currentTime = targetPosition;
            }
            resumePositionAppliedRef.current = true;
        };

        if (video.readyState >= 1) {
            applyPosition();
            return;
        }

        const onReady = () => applyPosition();
        video.addEventListener('loadedmetadata', onReady, { once: true });
        video.addEventListener('loadeddata', onReady, { once: true });
        return () => {
            video.removeEventListener('loadedmetadata', onReady);
            video.removeEventListener('loadeddata', onReady);
        };
    }, [episodeKey, savedPlaybackPosition, videoSrc]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) {
            return () => {};
        }

        const handleTimeUpdate = () => persistPlaybackPosition(video.currentTime);
        const handlePause = () => persistPlaybackPosition(video.currentTime, true);
        const handleEnded = () => {
            setSavedPlaybackPosition(null);
            lastSavedPositionRef.current = null;
            lastSavedAtRef.current = 0;
            if (autoPlayNextEpisode && nextEpisodeOption && onEpisodeSelect) {
                onEpisodeSelect(nextEpisodeOption.index);
            }
        };
        const handlePageHide = () => persistPlaybackPosition(video.currentTime, true);

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [
        autoPlayNextEpisode,
        nextEpisodeOption,
        onEpisodeSelect,
        persistPlaybackPosition,
        setSavedPlaybackPosition,
    ]);

    useEffect(() => {
        subtitleRequestRef.current += 1;
        const requestId = subtitleRequestRef.current;
        if (selectedSubtitleIndex === null) {
            resetSubtitleDisplay();
            return;
        }

        const track = availableSubtitleTracks[selectedSubtitleIndex];
        if (!track) {
            setSubtitleCues([]);
            return;
        }

        if (track.source === 'local') {
            setSubtitleCues(localSubtitleCuesRef.current.get(track.url) ?? []);
            return;
        }

        const isJimakuTrack = track.source === 'jimaku';
        const jimakuApiKey = settings.jimakuApiKey?.trim();
        if (isJimakuTrack && !jimakuApiKey) {
            setSubtitleCues([]);
            return;
        }

        const resolvedUrl = track.url.startsWith('http')
            ? track.url
            : track.url.startsWith('/api')
                ? `${requestManager.getBaseUrl()}${track.url}`
                : `${requestManager.getBaseUrl()}/${track.url}`

        const abortController = new AbortController();
        const requestInit: RequestInit = isJimakuTrack
            ? {
                headers: {
                    Authorization: jimakuApiKey ?? '',
                },
                signal: abortController.signal,
            }
            : { credentials: 'include', signal: abortController.signal };

        console.debug('[AnimeVideoPlayer] Loading subtitles', {
            index: selectedSubtitleIndex,
            lang: track.lang,
            url: resolvedUrl,
        });

        fetch(resolvedUrl, requestInit)
            .then((response) => response.text())
            .then((text) => {
                if (subtitleRequestRef.current !== requestId) {
                    return;
                }
                const cues = parseSubtitles(text, resolvedUrl);
                console.debug('[AnimeVideoPlayer] Subtitle cues parsed', { count: cues.length });
                setSubtitleCues(cues);
            })
            .catch((error) => {
                if (abortController.signal.aborted) {
                    return;
                }
                console.error('[AnimeVideoPlayer] Subtitle load failed', error);
                if (subtitleRequestRef.current === requestId) {
                    setSubtitleCues([]);
                }
            });
        return () => {
            abortController.abort();
        };
    }, [selectedSubtitleIndex, settings.jimakuApiKey, availableSubtitleTracks, resetSubtitleDisplay]);

    useEffect(() => {
        if (subtitleRenderResetRef.current !== null) {
            window.cancelAnimationFrame(subtitleRenderResetRef.current);
            subtitleRenderResetRef.current = null;
        }

        if (!subtitleCues.length) {
            activeCueKeyRef.current = '';
            setActiveCues([]);
            setHighlightedSubtitle(null);
            return;
        }

        const offsetSeconds = safeSubtitleOffsetMs / 1000;
        const baseTime = videoRef.current?.currentTime ?? currentTime;
        const effectiveTime = baseTime + offsetSeconds;
        const nextCues = subtitleCues.filter(
            (cue) =>
                effectiveTime + SUBTITLE_TIME_EPSILON >= cue.start &&
                effectiveTime - SUBTITLE_TIME_EPSILON <= cue.end,
        );
        const nextKey = nextCues.map((cue) => cue.id).join('|');

        if (nextKey === activeCueKeyRef.current) {
            setActiveCues(nextCues);
            return;
        }

        activeCueKeyRef.current = nextKey;
        setActiveCues([]);
        setHighlightedSubtitle(null);
        if (!nextCues.length) {
            return;
        }

        subtitleRenderResetRef.current = window.requestAnimationFrame(() => {
            subtitleRenderResetRef.current = null;
            setActiveCues(nextCues);
        });
    }, [currentTime, subtitleCues, safeSubtitleOffsetMs]);

    const sortedSubtitleCues = useMemo(
        () => [...subtitleCues].sort((a, b) => a.start - b.start),
        [subtitleCues],
    );

    const getCurrentSubtitleCue = useCallback(() => {
        if (!sortedSubtitleCues.length) {
            return null;
        }
        const offsetSeconds = safeSubtitleOffsetMs / 1000;
        const baseTime = videoRef.current?.currentTime ?? currentTime;
        const effectiveTime = baseTime + offsetSeconds;
        const epsilon = SUBTITLE_TIME_EPSILON;
        return (
            sortedSubtitleCues.find(
                (cue) => effectiveTime + epsilon >= cue.start && effectiveTime - epsilon <= cue.end,
            ) ?? null
        );
    }, [sortedSubtitleCues, safeSubtitleOffsetMs, currentTime]);

    const getSubtitleSyncTarget = useCallback(
        (direction: 'previous' | 'next') => {
            if (!sortedSubtitleCues.length) {
                return null;
            }

            const offsetSeconds = safeSubtitleOffsetMs / 1000;
            const baseTime = videoRef.current?.currentTime ?? currentTime;
            const effectiveTime = baseTime + offsetSeconds;
            const epsilon = SUBTITLE_TIME_EPSILON;

            if (direction === 'previous') {
                for (let i = sortedSubtitleCues.length - 1; i >= 0; i -= 1) {
                    const cue = sortedSubtitleCues[i];
                    if (cue.start < effectiveTime - epsilon) {
                        return cue;
                    }
                }
                return sortedSubtitleCues[0];
            }

            for (let i = 0; i < sortedSubtitleCues.length; i += 1) {
                const cue = sortedSubtitleCues[i];
                if (cue.start > effectiveTime + epsilon) {
                    return cue;
                }
            }

            return sortedSubtitleCues[sortedSubtitleCues.length - 1];
        },
        [sortedSubtitleCues, currentTime, safeSubtitleOffsetMs],
    );

    const syncSubtitleOffsetToCue = useCallback(
        (cue: SubtitleCue | null) => {
            if (!cue) {
                return;
            }
            const baseTime = videoRef.current?.currentTime ?? currentTime;
            if (!Number.isFinite(baseTime)) {
                return;
            }
            setSubtitleOffsetMs(Math.round((cue.start - baseTime) * 1000));
        },
        [currentTime, setSubtitleOffsetMs],
    );

    const ensureAudioNodes = useCallback(() => {
        const video = videoRef.current;
        if (!video) {
            return null;
        }
        if (audioContextRef.current && audioSourceRef.current && audioDestinationRef.current && audioGainRef.current) {
            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().catch(() => {});
            }
            return {
                context: audioContextRef.current,
                destination: audioDestinationRef.current,
                gain: audioGainRef.current,
            };
        }
        const AudioContextCtor =
            window.AudioContext ||
            (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) {
            return null;
        }
        try {
            const context = new AudioContextCtor();
            const source = context.createMediaElementSource(video);
            const gain = context.createGain();
            const destination = context.createMediaStreamDestination();
            gain.gain.value = 1;
            source.connect(gain);
            gain.connect(context.destination);
            source.connect(destination);
            context.resume().catch(() => {});
            audioContextRef.current = context;
            audioSourceRef.current = source;
            audioGainRef.current = gain;
            audioDestinationRef.current = destination;
            return { context, destination, gain };
        } catch (error) {
            console.error('[AnimeVideoPlayer] Audio setup failed', error);
            return null;
        }
    }, []);

    const seekVideoTo = useCallback((targetTime: number) => {
        const video = videoRef.current;
        if (!video) {
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            let resolved = false;
            const onSeeked = () => {
                if (resolved) {
                    return;
                }
                resolved = true;
                window.clearTimeout(timeout);
                video.removeEventListener('seeked', onSeeked);
                resolve();
            };
            const timeout = window.setTimeout(() => {
                if (resolved) {
                    return;
                }
                resolved = true;
                video.removeEventListener('seeked', onSeeked);
                resolve();
            }, 1000);
            video.addEventListener('seeked', onSeeked, { once: true });
            video.currentTime = targetTime;
        });
    }, []);

    const blobToBase64 = useCallback((blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read audio data.'));
        reader.readAsDataURL(blob);
    }), []);

    const captureVideoFrame = useCallback(async () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth || !video.videoHeight) {
            if (!video) {
                return null;
            }
        }

        const waitForFrame = async () => {
            if (!video) {
                return;
            }
            if (video.videoWidth && video.videoHeight) {
                return;
            }
            await new Promise<void>((resolve) => {
                let settled = false;
                const onReady = () => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    window.clearTimeout(timeout);
                    video.removeEventListener('loadeddata', onReady);
                    video.removeEventListener('loadedmetadata', onReady);
                    resolve();
                };
                const timeout = window.setTimeout(() => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    video.removeEventListener('loadeddata', onReady);
                    video.removeEventListener('loadedmetadata', onReady);
                    resolve();
                }, 800);
                video.addEventListener('loadeddata', onReady, { once: true });
                video.addEventListener('loadedmetadata', onReady, { once: true });
                const videoWithFrameCallback = video as HTMLVideoElement & {
                    requestVideoFrameCallback?: (callback: () => void) => number;
                };
                if (typeof videoWithFrameCallback.requestVideoFrameCallback === 'function') {
                    videoWithFrameCallback.requestVideoFrameCallback(() => {
                        if (settled) {
                            return;
                        }
                        settled = true;
                        window.clearTimeout(timeout);
                        video.removeEventListener('loadeddata', onReady);
                        video.removeEventListener('loadedmetadata', onReady);
                        resolve();
                    });
                }
            });
        }
        const wasPaused = video?.paused ?? true;
        if (video && (video.readyState < 2 || !video.videoWidth || !video.videoHeight)) {
            await video.play().catch(() => {});
            await waitForFrame();
            if (wasPaused) {
                video.pause();
            }
        }
        if (!video || !video.videoWidth || !video.videoHeight) {
            return null;
        }

        let captureModeApplied = false;
        const applyCaptureMode = async () => {
            if (captureModeApplied) {
                return;
            }
            captureModeApplied = true;
            setIsCaptureMode(true);
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        };

        const isNativeApp = /MangatanNative|ManatanNative/i.test(navigator.userAgent);
        const getVideoContentRect = () => {
            const rect = video.getBoundingClientRect();
            const videoWidth = video.videoWidth || 1;
            const videoHeight = video.videoHeight || 1;
            if (!rect.width || !rect.height) {
                return rect;
            }
            const videoRatio = videoWidth / videoHeight;
            const elementRatio = rect.width / rect.height;
            let width = rect.width;
            let height = rect.height;
            let offsetX = 0;
            let offsetY = 0;
            if (videoRatio > elementRatio) {
                height = rect.width / videoRatio;
                offsetY = (rect.height - height) / 2;
            } else {
                width = rect.height * videoRatio;
                offsetX = (rect.width - width) / 2;
            }
            return {
                x: rect.left + offsetX,
                y: rect.top + offsetY,
                width,
                height,
            };
        };

        const captureNativeFrame = async () => {
            const native =
                (window as typeof window & {
                    ManatanNative?: { captureFrame?: (callbackId: string, payload: string) => void };
                }).ManatanNative ?? undefined;
            const capture = native?.captureFrame;
            if (!capture) {
                return null;
            }
            const rect = getVideoContentRect();
            if (!rect.width || !rect.height) {
                return null;
            }
            const callbacks = window as typeof window & {
                __manatanNativeCaptureCallbacks?: Record<string, (data?: string | null) => void>;
                __manatanNativeCaptureCallback?: (id: string, data?: string | null) => void;
            };
            const callbackMap =
                callbacks.__manatanNativeCaptureCallbacks ??
                (callbacks.__manatanNativeCaptureCallbacks = {});
            if (!callbacks.__manatanNativeCaptureCallback) {
                callbacks.__manatanNativeCaptureCallback = (id: string, data?: string | null) => {
                    const cb = callbackMap[id];
                    if (cb) {
                        cb(data ?? null);
                        delete callbackMap[id];
                    }
                };
            }

            const payload = {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                dpr: window.devicePixelRatio || 1,
                quality: Number.isFinite(settings.ankiImageQuality) ? settings.ankiImageQuality : 0.92,
            };

            return new Promise<string | null>((resolve) => {
                const callbackId = `native_capture_${Date.now()}_${Math.random().toString(16).slice(2)}`;
                const timeout = window.setTimeout(() => {
                    delete callbacks.__manatanNativeCaptureCallbacks?.[callbackId];
                    resolve(null);
                }, 2000);
                callbackMap[callbackId] = (data) => {
                    window.clearTimeout(timeout);
                    if (!data) {
                        resolve(null);
                        return;
                    }
                    const normalized = data.startsWith('data:') ? data : `data:image/jpeg;base64,${data}`;
                    resolve(normalized);
                };
                try {
                    capture(callbackId, JSON.stringify(payload));
                } catch (error) {
                    window.clearTimeout(timeout);
                    delete callbackMap[callbackId];
                    console.error('[AnimeVideoPlayer] Native screenshot failed', error);
                    resolve(null);
                }
            });
        };

        try {
            await applyCaptureMode();
            const quality = Number.isFinite(settings.ankiImageQuality) ? settings.ankiImageQuality : 0.92;
            const primaryType = isNativeApp ? 'image/jpeg' : 'image/webp';
            const encodeCanvas = async (canvas: HTMLCanvasElement, type: string) => {
                if (canvas.toBlob) {
                    try {
                        const blob = await new Promise<Blob | null>((resolve) =>
                            canvas.toBlob(resolve, type, quality),
                        );
                        if (blob && blob.size > 0) {
                            return blobToBase64(blob);
                        }
                    } catch (error) {
                        console.error('[AnimeVideoPlayer] Screenshot encode failed', error);
                    }
                }
                try {
                    return canvas.toDataURL(type, quality);
                } catch (error) {
                    console.error('[AnimeVideoPlayer] Screenshot export failed', error);
                    return null;
                }
            };
            const encodeWithFallback = async (canvas: HTMLCanvasElement) => {
                const primaryImage = await encodeCanvas(canvas, primaryType);
                if (primaryImage) {
                    return primaryImage;
                }
                if (primaryType !== 'image/jpeg') {
                    const jpegImage = await encodeCanvas(canvas, 'image/jpeg');
                    if (jpegImage) {
                        return jpegImage;
                    }
                }
                return null;
            };
            const captureStreamFrame = async () => {
                const videoCapture = video as HTMLVideoElement & {
                    captureStream?: () => MediaStream;
                    mozCaptureStream?: () => MediaStream;
                };
                const captureStream =
                    videoCapture.captureStream?.bind(videoCapture) ??
                    videoCapture.mozCaptureStream?.bind(videoCapture);
                const ImageCaptureCtor =
                    ((window as any).ImageCapture as
                        | (new (track: MediaStreamTrack) => { grabFrame: () => Promise<ImageBitmap> })
                        | undefined) ?? undefined;
                if (!captureStream || !ImageCaptureCtor) {
                    return null;
                }
                let track: MediaStreamTrack | undefined;
                try {
                    const stream = captureStream();
                    [track] = stream.getVideoTracks();
                    if (!track) {
                        return null;
                    }
                    const imageCapture = new ImageCaptureCtor(track);
                    const frame = await imageCapture.grabFrame();
                    const canvas = document.createElement('canvas');
                    canvas.width = frame.width;
                    canvas.height = frame.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        return null;
                    }
                    ctx.drawImage(frame, 0, 0);
                    return await encodeWithFallback(canvas);
                } catch (error) {
                    console.error('[AnimeVideoPlayer] Screenshot stream capture failed', error);
                    return null;
                } finally {
                    try {
                        track?.stop();
                    } catch {
                        // ignore
                    }
                }
            };
            const captureCanvasFrame = async () => {
                const maxSourceDim = Math.max(video.videoWidth, video.videoHeight);
                const maxDimension = isNativeApp ? Math.min(1280, maxSourceDim) : maxSourceDim;
                const scale = maxSourceDim ? Math.min(1, maxDimension / maxSourceDim) : 1;
                const width = Math.max(1, Math.round(video.videoWidth * scale));
                const height = Math.max(1, Math.round(video.videoHeight * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return null;
                }

                let drawn = false;
                try {
                    ctx.drawImage(video, 0, 0, width, height);
                    drawn = true;
                } catch (error) {
                    if (typeof window.createImageBitmap === 'function') {
                        try {
                            const bitmap = await window.createImageBitmap(video);
                            ctx.drawImage(bitmap, 0, 0, width, height);
                            if (typeof bitmap.close === 'function') {
                                bitmap.close();
                            }
                            drawn = true;
                        } catch (bitmapError) {
                            console.error('[AnimeVideoPlayer] Screenshot draw failed', bitmapError);
                        }
                    } else {
                        console.error('[AnimeVideoPlayer] Screenshot draw failed', error);
                    }
                }

                if (!drawn) {
                    return null;
                }

                return await encodeWithFallback(canvas);
            };

            if (isNativeApp) {
                const nativeImage = await captureNativeFrame();
                if (nativeImage) {
                    return nativeImage;
                }
            }

            const streamImage = await captureStreamFrame();
            if (streamImage) {
                return streamImage;
            }

            const canvasImage = await captureCanvasFrame();
            if (canvasImage) {
                return canvasImage;
            }

            return null;
        } finally {
            if (captureModeApplied) {
                setIsCaptureMode(false);
            }
        }
    }, [blobToBase64, settings.ankiImageQuality]);

    const getAudioCaptureSource = useCallback(() => {
        const video = videoRef.current;
        if (!video) {
            return null;
        }
        const videoCapture = video as HTMLVideoElement & {
            captureStream?: () => MediaStream;
            mozCaptureStream?: () => MediaStream;
        };
        const captureStream =
            videoCapture.captureStream?.bind(videoCapture) ??
            videoCapture.mozCaptureStream?.bind(videoCapture);
        if (!captureStream) {
            const audioNodes = ensureAudioNodes();
            if (audioNodes?.destination?.stream) {
                const { gain, destination, context } = audioNodes;
                return {
                    stream: destination.stream,
                    mute: () => {
                        const previousGain = gain.gain.value;
                        gain.gain.value = 0;
                        return () => {
                            gain.gain.value = previousGain;
                            if (context.state === 'suspended') {
                                context.resume().catch(() => {});
                            }
                        };
                    },
                };
            }
            return null;
        }
        const stream = captureStream();
        const audioTracks = stream.getAudioTracks();
        if (!audioTracks.length) {
            const audioNodes = ensureAudioNodes();
            if (audioNodes?.destination?.stream) {
                const { gain, destination, context } = audioNodes;
                return {
                    stream: destination.stream,
                    mute: () => {
                        const previousGain = gain.gain.value;
                        gain.gain.value = 0;
                        return () => {
                            gain.gain.value = previousGain;
                            if (context.state === 'suspended') {
                                context.resume().catch(() => {});
                            }
                        };
                    },
                };
            }
            return null;
        }
        return { stream: new MediaStream(audioTracks), mute: () => () => {} };
    }, [ensureAudioNodes]);

    const captureSentenceAudio = useCallback(async (start: number, end: number) => {
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            return null;
        }
        const duration = Math.max(0, end - start);
        if (duration <= 0) {
            return null;
        }
        if (audioCaptureLockRef.current) {
            return null;
        }

        const video = videoRef.current;
        if (!video) {
            return null;
        }

        audioCaptureLockRef.current = true;
        const previousTime = video.currentTime;
        const previousPaused = video.paused;
        let audioSource: { stream: MediaStream; mute: () => () => void } | null = null;
        let activeAudioSource: { stream: MediaStream; mute: () => () => void } | null = null;
        let restoreMute: (() => void) | null = null;
        let scriptProcessor: ScriptProcessorNode | null = null;
        let processorGain: GainNode | null = null;
        let shouldRestorePlayback = false;
        const fetchServerAudioClip = async () => {
            if (currentEpisodeIndex == null) {
                return null;
            }
            const params = new URLSearchParams({
                animeId: String(animeId),
                episodeIndex: String(currentEpisodeIndex),
                videoIndex: String(selectedVideoIndex),
                start: String(start),
                end: String(end),
            });
            try {
                const response = await fetch(
                    `/api/audio/clip?${params.toString()}`,
                    { method: 'POST', credentials: 'include' },
                );
                if (!response.ok) {
                    console.warn('[AnimeVideoPlayer] Server audio capture failed', response.status);
                    return null;
                }
                const blob = await response.blob();
                if (!blob.size) {
                    return null;
                }
                return await blobToBase64(blob);
            } catch (error) {
                console.error('[AnimeVideoPlayer] Server audio capture failed', error);
                return null;
            }
        };

        try {
            const isNativeApp = /MangatanNative|ManatanNative/i.test(navigator.userAgent);
            const shouldForceServerAudio = isDesktopPlatform || isAndroid || isNativeApp;
            if (shouldForceServerAudio || isHlsSource) {
                const serverAudio = await fetchServerAudioClip();
                if (serverAudio) {
                    return serverAudio;
                }
                if (shouldForceServerAudio) {
                    return null;
                }
            }

            await seekVideoTo(start);
            shouldRestorePlayback = true;
            await video.play().catch(() => {});
            // Add slight delay for Android audio decoders to spin up
            await new Promise((resolve) => setTimeout(resolve, 150));

            audioSource = getAudioCaptureSource();
            if (!audioSource) {
                return null;
            }
            activeAudioSource = audioSource;
            restoreMute = activeAudioSource.mute();

            const captureWithMediaRecorder = async () => {
                const source = activeAudioSource;
                if (!source || typeof MediaRecorder === 'undefined') {
                    return null;
                }
                
                // Prioritize webm/ogg on Android/WebViews as mp4 MediaRecorder support is flaky
                const preferredMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4'];
                const selectedMimeType =
                    preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';
                let recorder: MediaRecorder;
                try {
                    recorder = selectedMimeType
                        ? new MediaRecorder(source.stream, { mimeType: selectedMimeType })
                        : new MediaRecorder(source.stream);
                } catch (error) {
                    try {
                        recorder = new MediaRecorder(source.stream);
                    } catch {
                        console.error('[AnimeVideoPlayer] MediaRecorder init failed', error);
                        return null;
                    }
                }
                const chunks: BlobPart[] = [];
                recorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        chunks.push(event.data);
                    }
                };
                const blobPromise = new Promise<Blob>((resolve, reject) => {
                    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
                    recorder.onerror = (event) => reject(event);
                });

                const stopAfterMs = Math.max(200, duration * 1000);
                const safetyTimeoutMs = stopAfterMs + 1500;

                try {
                    recorder.start();
                } catch (error) {
                    console.error('[AnimeVideoPlayer] MediaRecorder start failed', error);
                    return null;
                }
                const stopTimer = window.setTimeout(() => {
                    try {
                        if (recorder.state !== 'inactive') {
                            recorder.stop();
                        }
                    } catch {
                        // ignore
                    }
                }, stopAfterMs);

                const audioBlob = await Promise.race([
                    blobPromise,
                    new Promise<Blob | null>((resolve) => window.setTimeout(() => resolve(null), safetyTimeoutMs)),
                ]);
                window.clearTimeout(stopTimer);
                if (!audioBlob || !audioBlob.size) {
                    return null;
                }
                return await blobToBase64(audioBlob);
            };

            const encodeWav = (samples: Float32Array, sampleRate: number) => {
                const buffer = new ArrayBuffer(44 + samples.length * 2);
                const view = new DataView(buffer);
                const writeString = (offset: number, value: string) => {
                    for (let i = 0; i < value.length; i += 1) {
                        view.setUint8(offset + i, value.charCodeAt(i));
                    }
                };
                const floatTo16BitPCM = (offset: number) => {
                    let outOffset = offset;
                    for (let i = 0; i < samples.length; i += 1) {
                        let sample = Math.max(-1, Math.min(1, samples[i]));
                        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
                        view.setInt16(outOffset, sample, true);
                        outOffset += 2;
                    }
                };

                const dataLength = samples.length * 2;
                writeString(0, 'RIFF');
                view.setUint32(4, 36 + dataLength, true);
                writeString(8, 'WAVE');
                writeString(12, 'fmt ');
                view.setUint32(16, 16, true);
                view.setUint16(20, 1, true);
                view.setUint16(22, 1, true);
                view.setUint32(24, sampleRate, true);
                view.setUint32(28, sampleRate * 2, true);
                view.setUint16(32, 2, true);
                view.setUint16(34, 16, true);
                writeString(36, 'data');
                view.setUint32(40, dataLength, true);
                floatTo16BitPCM(44);
                return buffer;
            };

            const captureWithWebAudio = async () => {
                const nodes = ensureAudioNodes();
                const context = nodes?.context ?? audioContextRef.current;
                const source = audioSourceRef.current;
                if (!context || !source || typeof context.createScriptProcessor !== 'function') {
                    return null;
                }
                if (context.state === 'suspended') {
                    await context.resume().catch(() => {});
                }

                const bufferSize = 4096;
                scriptProcessor = context.createScriptProcessor(bufferSize, 2, 2);
                processorGain = context.createGain();
                processorGain.gain.value = 0;

                const recorded: Float32Array[] = [];
                let totalLength = 0;
                scriptProcessor.onaudioprocess = (event) => {
                    const input = event.inputBuffer;
                    const channelCount = input.numberOfChannels;
                    if (!channelCount) {
                        return;
                    }
                    const length = input.length;
                    const mono = new Float32Array(length);
                    for (let channel = 0; channel < channelCount; channel += 1) {
                        const data = input.getChannelData(channel);
                        for (let i = 0; i < length; i += 1) {
                            mono[i] += data[i];
                        }
                    }
                    if (channelCount > 1) {
                        for (let i = 0; i < length; i += 1) {
                            mono[i] /= channelCount;
                        }
                    }
                    recorded.push(mono);
                    totalLength += length;
                };

                try {
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(processorGain);
                    processorGain.connect(context.destination);
                } catch (error) {
                    console.error('[AnimeVideoPlayer] WebAudio capture connect failed', error);
                    return null;
                }

                await new Promise((resolve) => window.setTimeout(resolve, duration * 1000));

                try {
                    source.disconnect(scriptProcessor);
                } catch {
                    // ignore
                }
                try {
                    scriptProcessor.disconnect();
                } catch {
                    // ignore
                }
                try {
                    processorGain.disconnect();
                } catch {
                    // ignore
                }

                if (!totalLength) {
                    return null;
                }
                const samples = new Float32Array(totalLength);
                let offset = 0;
                recorded.forEach((chunk) => {
                    samples.set(chunk, offset);
                    offset += chunk.length;
                });
                const wavBuffer = encodeWav(samples, context.sampleRate);
                const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
                return await blobToBase64(wavBlob);
            };

            const recorderBase64 = await captureWithMediaRecorder();
            if (recorderBase64) {
                return recorderBase64;
            }

            const wavBase64 = await captureWithWebAudio();
            if (wavBase64) {
                return wavBase64;
            }

            return null;
        } catch (error) {
            console.error('[AnimeVideoPlayer] Audio capture failed', error);
            return null;
        } finally {
            try {
                if (activeAudioSource?.stream) {
                    activeAudioSource.stream.getTracks().forEach((track) => track.stop());
                }
            } catch {
                // ignore
            }
            try {
                (scriptProcessor as AudioNode | null)?.disconnect?.();
                (processorGain as AudioNode | null)?.disconnect?.();
            } catch {
                // ignore
            }
            restoreMute?.();
            if (shouldRestorePlayback) {
                video.pause();
                await seekVideoTo(previousTime);
                if (!previousPaused) {
                    video.play().catch(() => {});
                }
            }
            audioCaptureLockRef.current = false;
        }
    }, [animeId, blobToBase64, currentEpisodeIndex, getAudioCaptureSource, isHlsSource, seekVideoTo, selectedVideoIndex]);


    const addNoteToAnki = useCallback(
        async (entry: DictionaryResult, overrideImage?: string) => {
            if (!settings.ankiDeck || !settings.ankiModel) {
                showAlert('Anki Settings Missing', 'Please select a Deck and Model in settings.');
                return null;
            }
            if (!dictionaryContext?.sentence) {
                showAlert('Sentence Missing', 'Select a subtitle to set the sentence context first.');
                return null;
            }
            const map = settings.ankiFieldMap || {};
            const fields: Record<string, string> = {};
            const sentence = dictionaryContext?.sentence || '';
            const needsSentenceFurigana = Object.values(map).includes('Sentence Furigana');
            const sentenceFurigana = needsSentenceFurigana
                ? await buildSentenceFuriganaFromLookup(sentence, lookupYomitan, {
                      language: settings.yomitanLanguage,
                      groupingMode: settings.resultGroupingMode,
                  })
                : sentence;
            const wordAudioField = Object.keys(map).find((key) => map[key] === 'Word Audio');
            let wordAudioData:
                | { url?: string; data?: string; filename: string; fields: string[] }
                | undefined;
            if (wordAudioField) {
                const entryKey = getDictionaryEntryKey(entry);
                const audioSelection = wordAudioSelectionKey === entryKey ? wordAudioSelection : 'auto';
                const audioInfo = await resolveWordAudioUrl(
                    entry,
                    settings.yomitanLanguage,
                    audioSelection,
                );
                if (audioInfo?.url) {
                    wordAudioData = {
                        url: audioInfo.url,
                        filename: getWordAudioFilename(audioInfo.url),
                        fields: [wordAudioField],
                    };
                }
            }

            Object.entries(map).forEach(([ankiField, mapType]) => {
                if (mapType === 'Target Word') fields[ankiField] = entry.headword;
                else if (mapType === 'Word (Again)') fields[ankiField] = entry.headword;
                else if (mapType === 'Reading') fields[ankiField] = entry.reading;
                else if (mapType === 'Furigana') fields[ankiField] = generateAnkiFurigana(entry);
                else if (mapType === 'Pitch Accent') fields[ankiField] = generateAnkiPitchAccent(entry);
                else if (mapType === 'Definition' || mapType === 'Glossary') {
                    fields[ankiField] = buildDefinitionHtml(entry);
                }
                else if (mapType === 'Frequency') fields[ankiField] = getLowestFrequency(entry);
                else if (mapType === 'Sentence') fields[ankiField] = sentence;
                else if (mapType === 'Sentence Furigana') {
                    fields[ankiField] = sentenceFurigana;
                }
                else if (mapType === 'Word Audio') fields[ankiField] = '';
                else if (mapType === 'x') fields[ankiField] = 'x';
                else if (typeof mapType === 'string') {
                    const name = getSingleGlossaryName(mapType);
                    if (name) {
                        fields[ankiField] = buildDefinitionHtml(entry, name);
                    }
                }
            });

            const url = settings.ankiConnectUrl || 'http://127.0.0.1:8765';
            const imgField = Object.keys(map).find((key) => map[key] === 'Image');
            const audioField = Object.keys(map).find((key) => map[key] === 'Sentence Audio');

            let pictureData: { data?: string; filename: string; fields: string[] } | undefined;
            if (imgField) {
                const base64 = overrideImage || (await captureVideoFrame());
                if (base64) {
                    pictureData = {
                        data: base64.split(';base64,')[1],
                        filename: `manatan_card_${Date.now()}.webp`,
                        fields: [imgField],
                    };
                } else {
                    makeToast('Could not capture a video frame for the Anki image.', 'warning');
                }
            }

            const audioPayloads: Array<{ url?: string; data?: string; filename: string; fields: string[] }> = [];
            if (wordAudioData) {
                audioPayloads.push(wordAudioData);
            }
            if (audioField && dictionaryContext?.audioStart != null && dictionaryContext?.audioEnd != null) {
                const audioBase64 = await captureSentenceAudio(dictionaryContext.audioStart, dictionaryContext.audioEnd);
                if (audioBase64) {
                    const isMp4 = audioBase64.startsWith('data:audio/mp4');
                    const isOgg = audioBase64.startsWith('data:audio/ogg');
                    const isWav = audioBase64.startsWith('data:audio/wav');
                    const extension = isMp4 ? 'm4a' : isOgg ? 'ogg' : isWav ? 'wav' : 'webm';
                    audioPayloads.push({
                        data: audioBase64.split(';base64,')[1],
                        filename: `manatan_sentence_${Date.now()}.${extension}`,
                        fields: [audioField],
                    });
                } else {
                    makeToast('Could not capture sentence audio from the video.', 'warning');
                }
            }

            try {
                const noteId = await addNote(
                    url,
                    settings.ankiDeck,
                    settings.ankiModel,
                    fields,
                    ['manatan'],
                    pictureData,
                    audioPayloads.length ? audioPayloads : undefined,
                );
                makeToast('Anki card added.', { variant: 'success', autoHideDuration: 1500 });
                return noteId;
            } catch (error: any) {
                console.error('[AnimeVideoPlayer] Failed to add note', error);
                makeToast('Failed to add Anki card', 'error', error?.message ?? String(error));
                return null;
            }
        },
        [
            captureSentenceAudio,
            captureVideoFrame,
            dictionaryContext,
            getDictionaryEntryKey,
            settings.ankiConnectUrl,
            settings.ankiDeck,
            settings.ankiFieldMap,
            settings.ankiModel,
            settings.resultGroupingMode,
            settings.yomitanLanguage,
            showAlert,
            wordAudioSelection,
            wordAudioSelectionKey,
        ],
    );


    const getSubtitleCharOffset = (element: HTMLElement, clientX: number, clientY: number) => {
        const rangeFromPoint = document.caretRangeFromPoint?.(clientX, clientY);
        const caretPosition = document.caretPositionFromPoint?.(clientX, clientY);

        let targetNode: Node | null = null;
        let targetOffset = 0;

        if (rangeFromPoint) {
            targetNode = rangeFromPoint.startContainer;
            targetOffset = rangeFromPoint.startOffset;
        } else if (caretPosition) {
            targetNode = caretPosition.offsetNode;
            targetOffset = caretPosition.offset;
        }

        if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
            if (targetOffset > 0) {
                const checkRange = document.createRange();
                checkRange.setStart(targetNode, targetOffset - 1);
                checkRange.setEnd(targetNode, targetOffset);
                const rect = checkRange.getBoundingClientRect();
                if (
                    clientX >= rect.left &&
                    clientX <= rect.right &&
                    clientY >= rect.top &&
                    clientY <= rect.bottom
                ) {
                    targetOffset -= 1;
                }
            }

            const range = document.createRange();
            range.setStart(element, 0);
            range.setEnd(targetNode, targetOffset);
            return range.toString().length;
        }

        if (rangeFromPoint) {
            const range = document.createRange();
            range.setStart(element, 0);
            range.setEnd(rangeFromPoint.startContainer, rangeFromPoint.startOffset);
            return range.toString().length;
        }

        if (caretPosition) {
            const range = document.createRange();
            range.setStart(element, 0);
            range.setEnd(caretPosition.offsetNode, caretPosition.offset);
            return range.toString().length;
        }

        return 0;
    };

    const performSubtitleLookup = useCallback(
        async (
            text: string,
            cueKey: string,
            cueStart: number,
            cueEnd: number,
            charOffset: number,
            source: 'click' | 'hover',
        ) => {
            if (wasPopupClosedRecently()) {
                return;
            }

            const safeCharOffset = Math.min(Math.max(charOffset, 0), text.length);
            const fallbackHighlightRange = getSubtitleHighlightRange(text, safeCharOffset);
            setHighlightedSubtitle(null);

            const applyDictionaryHighlight = (matchLen?: number | null) => {
                if (matchLen && matchLen > 0) {
                    const end = Math.min(text.length, safeCharOffset + matchLen);
                    setHighlightedSubtitle({ key: cueKey, start: safeCharOffset, end });
                    return;
                }
                if (fallbackHighlightRange) {
                    setHighlightedSubtitle({ key: cueKey, ...fallbackHighlightRange });
                } else {
                    setHighlightedSubtitle(null);
                }
            };

            const encoder = new TextEncoder();
            const byteIndex = encoder.encode(text.substring(0, safeCharOffset)).length;

            const video = videoRef.current;
            if (!dictionaryVisible) {
                resumePlaybackRef.current = Boolean(video && !video.paused);
                overlayVisibilityRef.current = isOverlayVisible;
            }
            video?.pause();

            const offsetSeconds = safeSubtitleOffsetMs / 1000;
            const audioStart = Math.max(0, cueStart - offsetSeconds);
            const audioEnd = Math.max(audioStart, cueEnd - offsetSeconds);
            setDictionaryContext({ sentence: text, audioStart, audioEnd });
            setDictionaryVisible(true);
            setDictionaryQuery(text);
            setDictionaryResults([]);
            setDictionaryLoading(true);
            setDictionarySystemLoading(false);
            setIsOverlayVisible(false);
            dictionaryOpenedByHoverRef.current = source === 'hover';

            const requestId = dictionaryRequestRef.current + 1;
            dictionaryRequestRef.current = requestId;

            const results = await lookupYomitan(
                text,
                byteIndex,
                settings.resultGroupingMode,
                settings.yomitanLanguage
            );
            if (dictionaryRequestRef.current !== requestId) {
                return;
            }
            if (results === 'loading') {
                setDictionaryLoading(false);
                setDictionarySystemLoading(true);
            } else {
                setDictionaryResults(results || []);
                setDictionaryLoading(false);
                setDictionarySystemLoading(false);
                const matchLen = results?.[0]?.matchLen;
                applyDictionaryHighlight(matchLen);
            }
        },
        [
            dictionaryVisible,
            isOverlayVisible,
            safeSubtitleOffsetMs,
            settings.resultGroupingMode,
            settings.yomitanLanguage,
            wasPopupClosedRecently,
        ],
    );

    const handleSubtitleClick = async (
        event: React.MouseEvent<HTMLDivElement>,
        text: string,
        cueKey: string,
        cueStart: number,
        cueEnd: number,
    ) => {
        event.stopPropagation();
        dictionaryOpenedByHoverRef.current = false;
        const element = event.currentTarget;
        const charOffset = getSubtitleCharOffset(element, event.clientX, event.clientY);
        await performSubtitleLookup(text, cueKey, cueStart, cueEnd, charOffset, 'click');
    };

    const hoverLookupEnabled =
        settings.animeSubtitleHoverLookup && settings.enableYomitan && !isMobile && isDesktopPlatform;

    const handleSubtitleMouseMove = useCallback(
        (event: React.MouseEvent<HTMLDivElement>, cue: SubtitleCue) => {
            if (!hoverLookupEnabled) {
                return;
            }
            if (dictionaryVisible && !dictionaryOpenedByHoverRef.current) {
                return;
            }
            if (isAnyMenuOpen || wasPopupClosedRecently()) {
                return;
            }
            const element = event.currentTarget;
            const charOffset = getSubtitleCharOffset(element, event.clientX, event.clientY);
            const safeCharOffset = Math.min(Math.max(charOffset, 0), cue.text.length);
            const last = hoverLookupRef.current;
            if (last && last.cueKey === cue.id && last.charOffset === safeCharOffset) {
                return;
            }
            hoverLookupRef.current = { cueKey: cue.id, charOffset: safeCharOffset };
            if (hoverLookupTimerRef.current !== null) {
                window.clearTimeout(hoverLookupTimerRef.current);
            }
            hoverLookupTimerRef.current = window.setTimeout(() => {
                hoverLookupTimerRef.current = null;
                if (!hoverLookupEnabled) {
                    return;
                }
                if (dictionaryVisible && !dictionaryOpenedByHoverRef.current) {
                    return;
                }
                performSubtitleLookup(cue.text, cue.id, cue.start, cue.end, safeCharOffset, 'hover');
            }, 120);
        },
        [
            dictionaryVisible,
            hoverLookupEnabled,
            isAnyMenuOpen,
            performSubtitleLookup,
            wasPopupClosedRecently,
        ],
    );

    const handleSubtitleMouseLeave = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (hoverLookupTimerRef.current !== null) {
            window.clearTimeout(hoverLookupTimerRef.current);
            hoverLookupTimerRef.current = null;
        }
        hoverLookupRef.current = null;

        if (!dictionaryVisible) {
            return;
        }

        const nextTarget = event.relatedTarget as HTMLElement | null;
        if (nextTarget?.closest('[data-subtitle-cue="true"]')) {
            return;
        }

        if (hoverLookupEnabled && settings.animeSubtitleHoverAutoResume && dictionaryOpenedByHoverRef.current) {
            resumeFromDictionary();
        }
    }, [dictionaryVisible, hoverLookupEnabled, settings.animeSubtitleHoverAutoResume]);

    useEffect(() => {
        return () => {
            if (hoverLookupTimerRef.current !== null) {
                window.clearTimeout(hoverLookupTimerRef.current);
            }
        };
    }, []);

    const togglePlay = useCallback(() => {
        if (dictionaryVisible) {
            return;
        }
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            userPausedRef.current = false;
            video
                .play()
                .catch(() => {
                    setIsOverlayVisible(true);
                });
        } else {
            userPausedRef.current = true;
            video.pause();
        }
    }, [dictionaryVisible, setIsOverlayVisible]);


    const resumeFromDictionary = () => {
        const video = videoRef.current;
        const shouldResume = resumePlaybackRef.current;
        const previousOverlayVisible = overlayVisibilityRef.current;
        setDictionaryVisible(false);
        setDictionaryContext(null);
        setHighlightedSubtitle(null);
        closeWordAudioMenu();
        dictionaryOpenedByHoverRef.current = false;
        if (!video || !shouldResume) {
            setIsOverlayVisible(previousOverlayVisible);
            return;
        }
        userPausedRef.current = false;
        video
            .play()
            .then(() => setIsOverlayVisible(false))
            .catch(() => setIsOverlayVisible(previousOverlayVisible));
    };

    const ankiTargetField = useMemo(
        () => Object.keys(settings.ankiFieldMap || {}).find((key) => settings.ankiFieldMap?.[key] === 'Target Word'),
        [settings.ankiFieldMap],
    );
    const singleGlossaryPrefix = 'Single Glossary ';
    const getSingleGlossaryName = useCallback((value: string): string | null => {
        if (value.startsWith(singleGlossaryPrefix)) {
            const name = value.slice(singleGlossaryPrefix.length).trim();
            return name ? name : null;
        }
        if (value.startsWith('Single Glossary:')) {
            const name = value.replace('Single Glossary:', '').trim();
            return name ? name : null;
        }
        return null;
    }, []);

    const handlePlayWordAudio = useCallback(
        async (
            entry: DictionaryResult,
            selection?: WordAudioSourceSelection,
            playFailSound = true,
        ) => {
            const entryKey = getDictionaryEntryKey(entry);
            const resolvedSelection = selection || (wordAudioSelectionKey === entryKey ? wordAudioSelection : 'auto');
            const playedSource = await playWordAudio(entry, settings.yomitanLanguage, resolvedSelection);
            if (!playedSource && playFailSound) {
                playAudioFailClick();
            }
        },
        [getDictionaryEntryKey, settings.yomitanLanguage, wordAudioSelection, wordAudioSelectionKey],
    );

    const openWordAudioMenu = useCallback((event: React.MouseEvent, entry: DictionaryResult) => {
        event.preventDefault();
        event.stopPropagation();
        setWordAudioMenuEntry(entry);
        setWordAudioMenuAnchor({ top: event.clientY, left: event.clientX });
    }, []);

    const closeWordAudioMenu = useCallback(() => {
        setWordAudioMenuAnchor(null);
        setWordAudioMenuEntry(null);
    }, []);

    const handleSelectWordAudioSource = useCallback(
        (selection: WordAudioSourceSelection, entry: DictionaryResult) => {
            setWordAudioSelection(selection);
            setWordAudioSelectionKey(getDictionaryEntryKey(entry));
        },
        [getDictionaryEntryKey],
    );

    const checkDuplicateForEntry = useCallback(
        async (entry: DictionaryResult) => {
            if (!settings.ankiConnectEnabled || !settings.ankiCheckDuplicates || !settings.ankiDeck) {
                return;
            }
            const entryKey = getDictionaryEntryKey(entry);
            setAnkiStatusByEntry((prev) => ({
                ...prev,
                [entryKey]: { status: 'loading', noteId: null },
            }));
            try {
                const url = settings.ankiConnectUrl || 'http://127.0.0.1:8765';
                const safeHeadword = entry.headword.replace(/"/g, '\\"');
                let query = `deck:"${settings.ankiDeck}"`;
                if (ankiTargetField) {
                    query += ` "${ankiTargetField}:${safeHeadword}"`;
                } else {
                    query += ` "${safeHeadword}"`;
                }
                const ids = await findNotes(url, query);
                if (ids.length > 0) {
                    setAnkiStatusByEntry((prev) => ({
                        ...prev,
                        [entryKey]: { status: 'exists', noteId: ids[0] },
                    }));
                } else {
                    setAnkiStatusByEntry((prev) => ({
                        ...prev,
                        [entryKey]: { status: 'missing', noteId: null },
                    }));
                }
            } catch (error) {
                console.error('[AnimeVideoPlayer] Anki duplicate check failed', error);
                setAnkiStatusByEntry((prev) => ({
                    ...prev,
                    [entryKey]: { status: 'unknown', noteId: null },
                }));
            }
        },
        [ankiTargetField, settings.ankiCheckDuplicates, settings.ankiConnectEnabled, settings.ankiConnectUrl, settings.ankiDeck],
    );

    useEffect(() => {
        if (!dictionaryVisible || !dictionaryResults.length) {
            return;
        }
        if (!settings.ankiConnectEnabled) {
            return;
        }
        if (!settings.enableYomitan || !settings.ankiCheckDuplicates) {
            dictionaryResults.forEach((entry) => {
                const entryKey = getDictionaryEntryKey(entry);
                setAnkiStatusByEntry((prev) => ({
                    ...prev,
                    [entryKey]: { status: 'missing', noteId: null },
                }));
            });
            return;
        }
        dictionaryResults.forEach((entry) => {
            checkDuplicateForEntry(entry);
        });
    }, [
        dictionaryResults,
        dictionaryVisible,
        settings.ankiCheckDuplicates,
        settings.ankiConnectEnabled,
        settings.enableYomitan,
        checkDuplicateForEntry,
    ]);

    useEffect(() => {
        if (!dictionaryVisible) {
            closeWordAudioMenu();
            setWordAudioSelection('auto');
            setWordAudioSelectionKey(null);
        }
    }, [closeWordAudioMenu, dictionaryVisible]);

    useEffect(() => {
        if (!wordAudioMenuAnchor) {
            return;
        }
        const closeOnButtonClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) {
                return;
            }
            if (target.closest('[data-word-audio-menu="true"]')) {
                return;
            }
            const button = target.closest('button,[role="button"]');
            if (button) {
                closeWordAudioMenu();
            }
        };
        document.addEventListener('click', closeOnButtonClick, true);
        return () => document.removeEventListener('click', closeOnButtonClick, true);
    }, [closeWordAudioMenu, wordAudioMenuAnchor]);

    useEffect(() => {
        if (!wordAudioMenuEntry) {
            setWordAudioAvailability(null);
            setWordAudioAutoAvailable(null);
            return;
        }
        let cancelled = false;
        const entry = wordAudioMenuEntry;
        const resolveAvailability = async () => {
            const availability: Record<WordAudioSource, boolean> = {} as Record<WordAudioSource, boolean>;
            for (const source of wordAudioOptions) {
                const info = await resolveWordAudioUrl(entry, settings.yomitanLanguage, source);
                availability[source] = Boolean(info?.url);
            }
            const autoAvailable =
                wordAudioOptions.length > 0 && wordAudioOptions.some((source) => availability[source]);
            if (!cancelled) {
                setWordAudioAvailability(availability);
                setWordAudioAutoAvailable(autoAvailable);
            }
        };
        resolveAvailability();
        return () => {
            cancelled = true;
        };
    }, [settings.yomitanLanguage, wordAudioMenuEntry, wordAudioOptions]);

    useEffect(() => {
        if (!settings.autoPlayWordAudio) {
            return;
        }
        if (!dictionaryVisible || !dictionaryResults.length) {
            return;
        }
        const entry = dictionaryResults[0];
        const key = getDictionaryEntryKey(entry);
        if (autoPlayWordAudioKeyRef.current === key) {
            return;
        }
        autoPlayWordAudioKeyRef.current = key;
        handlePlayWordAudio(entry, undefined, false);
    }, [dictionaryResults, dictionaryVisible, handlePlayWordAudio, settings.autoPlayWordAudio]);

    const handleAnkiOpen = useCallback(
        async (entry: DictionaryResult) => {
            if (!settings.ankiConnectEnabled) {
                showAlert('AnkiConnect Disabled', 'Enable AnkiConnect in settings to open cards.');
                return;
            }
            if (!settings.ankiDeck) {
                showAlert('Anki Settings Missing', 'Please select a Deck in settings.');
                return;
            }
            try {
                const entryKey = getDictionaryEntryKey(entry);
                const status = ankiStatusByEntry[entryKey];
                const url = settings.ankiConnectUrl || 'http://127.0.0.1:8765';
                if (status?.noteId) {
                    await guiBrowse(url, `nid:${status.noteId}`);
                    return;
                }
                const safeHeadword = entry.headword.replace(/"/g, '\\"');
                let query = `deck:"${settings.ankiDeck}"`;
                if (ankiTargetField) {
                    query += ` "${ankiTargetField}:${safeHeadword}"`;
                } else {
                    query += ` "${safeHeadword}"`;
                }
                await guiBrowse(url, query);
            } catch (error) {
                console.error('[AnimeVideoPlayer] Failed to open Anki browser', error);
            }
        },
        [ankiStatusByEntry, ankiTargetField, settings.ankiConnectEnabled, settings.ankiConnectUrl, settings.ankiDeck, showAlert],
    );

    const handleAnkiAdd = useCallback(
        async (entry: DictionaryResult) => {
            const entryKey = getDictionaryEntryKey(entry);
            if (ankiActionPendingRef.current[entryKey]) {
                return;
            }
            ankiActionPendingRef.current[entryKey] = true;
            setAnkiStatusByEntry((prev) => ({
                ...prev,
                [entryKey]: { status: 'loading', noteId: prev[entryKey]?.noteId ?? null },
            }));
            setAnkiActionPending((prev) => ({ ...prev, [entryKey]: true }));
            try {
                const timeoutMs = 25000;
                let timeoutId: number | undefined;
                const timeoutPromise = new Promise<{ type: 'timeout' }>((resolve) => {
                    timeoutId = window.setTimeout(() => resolve({ type: 'timeout' }), timeoutMs);
                });
                const result = await Promise.race([
                    addNoteToAnki(entry)
                        .then((value) => ({ type: 'value' as const, value }))
                        .catch((error) => ({ type: 'error' as const, error })),
                    timeoutPromise,
                ]);
                if (timeoutId !== undefined) {
                    window.clearTimeout(timeoutId);
                }

                if (result.type === 'timeout') {
                    makeToast('Anki add timed out.', 'warning');
                    setAnkiStatusByEntry((prev) => ({
                        ...prev,
                        [entryKey]: { status: 'missing', noteId: null },
                    }));
                    return;
                }
                if (result.type === 'error') {
                    console.error('[AnimeVideoPlayer] Failed to add note', result.error);
                    makeToast('Failed to add Anki card', 'error', result.error?.message ?? String(result.error));
                    setAnkiStatusByEntry((prev) => ({
                        ...prev,
                        [entryKey]: { status: 'missing', noteId: null },
                    }));
                    return;
                }

                const noteId = result.value;
                if (noteId) {
                    setAnkiStatusByEntry((prev) => ({
                        ...prev,
                        [entryKey]: { status: 'exists', noteId },
                    }));
                } else {
                    setAnkiStatusByEntry((prev) => ({
                        ...prev,
                        [entryKey]: { status: 'missing', noteId: null },
                    }));
                }
            } finally {
                setAnkiActionPending((prev) => ({ ...prev, [entryKey]: false }));
                ankiActionPendingRef.current[entryKey] = false;
            }
        },
        [
            addNoteToAnki,
            settings.ankiFieldMap,
            setAnkiActionPending,
            setAnkiStatusByEntry,
        ],
    );

    const handleAnkiReplaceLast = useCallback(
        async (entry: DictionaryResult) => {
            const entryKey = getDictionaryEntryKey(entry);
            if (ankiActionPendingRef.current[entryKey]) {
                return;
            }
            ankiActionPendingRef.current[entryKey] = true;
            setAnkiActionPending((prev) => ({ ...prev, [entryKey]: true }));
            try {
                const activeContext = dictionaryContext;
                const rawSentence = activeContext?.sentence || '';
                if (!rawSentence) {
                    showAlert('Sentence Missing', 'Select a subtitle to set the sentence context first.');
                    return;
                }
                const map = settings.ankiFieldMap || {};
                const sentenceField = Object.keys(map).find((key) => map[key] === 'Sentence') || '';
                const imgField = Object.keys(map).find((key) => map[key] === 'Image') || '';
                const audioField = Object.keys(map).find((key) => map[key] === 'Sentence Audio') || '';

                if (!sentenceField && !imgField && !audioField) {
                    showAlert('Anki Fields Missing', 'Set Sentence, Image, or Sentence Audio fields in settings.');
                    return;
                }

                const url = settings.ankiConnectUrl || 'http://127.0.0.1:8765';
                const imageBase64 = imgField ? await captureVideoFrame() : null;
                const audioBase64 =
                    audioField && activeContext?.audioStart != null && activeContext?.audioEnd != null
                        ? await captureSentenceAudio(activeContext.audioStart, activeContext.audioEnd)
                        : null;

                if (imgField && !imageBase64) {
                    makeToast('Could not capture a video frame for the Anki image.', 'warning');
                }
                if (audioField && !audioBase64) {
                    makeToast('Could not capture sentence audio from the video.', 'warning');
                }

                await updateLastCard(
                    url,
                    undefined,
                    rawSentence,
                    imgField,
                    sentenceField,
                    settings.ankiImageQuality || 0.92,
                    imageBase64 || undefined,
                    audioField,
                    audioBase64 || undefined,
                );
                makeToast('Anki card updated.', { variant: 'success', autoHideDuration: 1500 });
            } catch (error: any) {
                console.error('[AnimeVideoPlayer] Failed to update last card', error);
                makeToast('Failed to update Anki card', 'error', error?.message ?? String(error));
            } finally {
                setAnkiActionPending((prev) => ({ ...prev, [entryKey]: false }));
                ankiActionPendingRef.current[entryKey] = false;
            }
        },
        [
            captureSentenceAudio,
            captureVideoFrame,
            dictionaryContext,
            setAnkiActionPending,
            settings.ankiConnectUrl,
            settings.ankiFieldMap,
            settings.ankiImageQuality,
            showAlert,
        ],
    );

    const getAnkiEntryStatus = useCallback(
        (entry: DictionaryResult) => {
            if (!settings.enableYomitan) {
                return 'missing';
            }
            const entryKey = getDictionaryEntryKey(entry);
            return ankiStatusByEntry[entryKey]?.status ?? (settings.ankiCheckDuplicates ? 'unknown' : 'missing');
        },
        [ankiStatusByEntry, settings.ankiCheckDuplicates, settings.enableYomitan],
    );

    const handleOverlayToggle = () => {
        if (dictionaryVisible) {
            return;
        }
        setIsOverlayVisible((prev) => {
            const next = !prev;
            setAutoOverlayDisabled(!next);
            return next;
        });
    };

    const isFullHeight = fillHeight || isPageFullscreen;
    const wrapperFixed = isPageFullscreen || (fillHeight && isMobile);
    const wrapperFullBleed = isFullHeight;
    const isTapZoneActive = isMobile && !dictionaryVisible && !isOverlayVisible;
    const tapZonePercentRaw = Number.isFinite(settings.tapZonePercent) ? settings.tapZonePercent : 30;
    const tapZonePercent = Math.min(Math.max(tapZonePercentRaw, 10), 60);
    const popupWidthUnit = settings.animePopupWidthUnit === 'px' ? 'px' : 'percent';
    const popupHeightUnit = settings.animePopupHeightUnit === 'px' ? 'px' : 'percent';
    const popupTopUnit = settings.animePopupTopOffsetUnit === 'px' ? 'px' : 'percent';
    const popupLeftUnit = settings.animePopupLeftOffsetUnit === 'px' ? 'px' : 'percent';
    const popupWidthRaw = Number.isFinite(settings.animePopupWidthPercent) ? settings.animePopupWidthPercent : 100;
    const popupHeightRaw = Number.isFinite(settings.animePopupHeightPercent) ? settings.animePopupHeightPercent : 50;
    const popupWidthPercent = Math.min(Math.max(popupWidthRaw, 30), 100);
    const popupHeightPercent = Math.min(Math.max(popupHeightRaw, 20), 90);
    const popupTopRaw = Number.isFinite(settings.animePopupTopOffsetPercent)
        ? settings.animePopupTopOffsetPercent
        : 0;
    const popupLeftRaw = Number.isFinite(settings.animePopupLeftOffsetPercent)
        ? settings.animePopupLeftOffsetPercent
        : 0;
    const popupTopMax = popupHeightUnit === 'percent' ? Math.max(0, 100 - popupHeightPercent) : 100;
    const popupTopOffsetPercent = Math.min(Math.max(popupTopRaw, 0), popupTopMax);
    const popupWidthInset = (100 - popupWidthPercent) / 2;
    const popupLeftMax = popupWidthUnit === 'percent' ? popupWidthInset : 50;
    const popupLeftOffsetPercent = Math.min(Math.max(popupLeftRaw, -popupLeftMax), popupLeftMax);
    const popupWidthPxRaw = Number.isFinite(settings.animePopupWidthPx) ? settings.animePopupWidthPx : 960;
    const popupHeightPxRaw = Number.isFinite(settings.animePopupHeightPx) ? settings.animePopupHeightPx : 420;
    const popupTopPxRaw = Number.isFinite(settings.animePopupTopOffsetPx) ? settings.animePopupTopOffsetPx : 0;
    const popupLeftPxRaw = Number.isFinite(settings.animePopupLeftOffsetPx) ? settings.animePopupLeftOffsetPx : 0;
    const popupWidthPx = Math.min(Math.max(popupWidthPxRaw, 280), 1920);
    const popupHeightPx = Math.min(Math.max(popupHeightPxRaw, 200), 1080);
    const popupTopOffsetPx = Math.min(Math.max(popupTopPxRaw, 0), 1600);
    const popupLeftOffsetPx = Math.min(Math.max(popupLeftPxRaw, -1600), 1600);
    const popupHeightClamp = popupHeightUnit === 'px' ? `${popupHeightPx}px` : `${popupHeightPercent}%`;
    const popupLeftBase = popupWidthUnit === 'px' ? '50%' : `${popupWidthInset}%`;
    const popupLeftOffset = popupLeftUnit === 'px'
        ? `calc(${popupLeftBase} + ${popupLeftOffsetPx}px)`
        : `calc(${popupLeftBase} + ${popupLeftOffsetPercent}%)`;
    const popupTopOffset = popupTopUnit === 'px'
        ? `min(${popupTopOffsetPx}px, calc(100% - ${popupHeightClamp}))`
        : popupHeightUnit === 'px'
            ? `min(${popupTopOffsetPercent}%, calc(100% - ${popupHeightPx}px))`
            : `${popupTopOffsetPercent}%`;
    const popupWidthStyle = popupWidthUnit === 'px'
        ? `min(${popupWidthPx}px, 100%)`
        : `${popupWidthPercent}%`;
    const popupHeightStyle = popupHeightUnit === 'px'
        ? `min(${popupHeightPx}px, 100%)`
        : `${popupHeightPercent}%`;
    const popupTransform = popupWidthUnit === 'px' ? 'translateX(-50%)' : 'none';
    const subtitleBottomOffset = isMobile
        ? isLandscape
            ? 'calc(env(safe-area-inset-bottom) + 28px)'
            : isOverlayVisible
                ? 'calc(env(safe-area-inset-bottom) + 140px)'
                : 'calc(env(safe-area-inset-bottom) + 84px)'
        : 48;

    const handleSeek = (_: Event, value: number | number[]) => {
        const video = videoRef.current;
        if (!video || typeof value !== 'number') {
            return;
        }
        const nextTime = (value / 100) * duration;
        video.currentTime = nextTime;
        setCurrentTime(nextTime);
    };

    const handleVolumeChange = (event: Event, value: number | number[]) => {
        event.stopPropagation();
        const nextValue = Array.isArray(value) ? value[0] : value;
        if (typeof nextValue !== 'number') {
            return;
        }
        const nextVolume = Math.min(Math.max(nextValue / 100, 0), 1);
        setVolume(nextVolume);
        const video = videoRef.current;
        if (video) {
            video.volume = nextVolume;
        }
    };

    const formatTime = (value: number) => {
        if (!Number.isFinite(value) || value <= 0) {
            return '0:00';
        }
        const hours = Math.floor(value / 3600);
        const minutes = Math.floor((value % 3600) / 60);
        const seconds = Math.floor(value % 60);
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const applyPlaybackRate = (rate: number) => {
        const video = videoRef.current;
        if (video) {
            video.playbackRate = rate;
        }
        setPlaybackRate(rate);
    };

    const renderSelectionIcon = useCallback(
        (isSelected: boolean) => (isSelected ? <CheckIcon fontSize="small" /> : <Box sx={{ width: 18, height: 18 }} />),
        [],
    );

    const handleSubtitleChange = useCallback(
        (index: number | null) => {
            setSelectedSubtitleIndex(index);
            if (index === null) {
                resetSubtitleDisplay();
                setSavedSubtitleLabel(null);
                setSavedSubtitleKey(null);
                setIsSubtitleDisabled(true);
                return;
            }
            setIsSubtitleDisabled(false);
            const option = subtitleOptions[index];
            const track = availableSubtitleTracks[index];
            const label = option?.label ?? null;
            if (track?.source !== 'local') {
                setSavedSubtitleLabel(label);
                if (label) {
                    setSavedSubtitleKey(buildSubtitleKey(label, track?.source));
                }
            }
        },
        [
            resetSubtitleDisplay,
            setIsSubtitleDisabled,
            setSavedSubtitleKey,
            setSavedSubtitleLabel,
            subtitleOptions,
            availableSubtitleTracks,
        ],
    );

    const subtitleMenuItems = useMemo(() => {
        const items = subtitleOptions.map((option) => {
            const isSelected = option.index === selectedSubtitleIndex;
            return (
                <MenuItem
                    key={option.index}
                    selected={isSelected}
                    className="subtitle-menu-item"
                    onClick={(event) => {
                        event.stopPropagation();
                        markMenuInteraction();
                        handleSubtitleChange(option.index);
                        setSubtitleMenuAnchor(null);
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 32 }}>{renderSelectionIcon(isSelected)}</ListItemIcon>
                    <ListItemText
                        primary={option.label}
                        primaryTypographyProps={{
                            sx: {
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                            },
                        }}
                    />
                </MenuItem>
            );
        });

        const jimakuApiKey = settings.jimakuApiKey?.trim();
        if (jimakuApiKey && onRequestJimakuTitleOverride) {
            const secondaryText = jimakuTitleOverride?.trim()
                ? `Current: ${jimakuTitleOverride.trim()}`
                : 'Use current anime title';
            items.push(
                <MenuItem
                    key="jimaku-title-override"
                    onClick={(event) => {
                        event.stopPropagation();
                        markMenuInteraction();
                        onRequestJimakuTitleOverride();
                        setSubtitleMenuAnchor(null);
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                        <TextFieldsIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Jimaku title" secondary={secondaryText} />
                </MenuItem>,
            );
        }

        return items;
    }, [
        handleSubtitleChange,
        jimakuTitleOverride,
        markMenuInteraction,
        onRequestJimakuTitleOverride,
        renderSelectionIcon,
        selectedSubtitleIndex,
        settings.jimakuApiKey,
        subtitleOptions,
    ]);

    const handlePlaybackChange = (rate: number) => {
        applyPlaybackRate(rate);
        setSavedPlaybackRate(rate);
    };

    const importSubtitleFile = useCallback(
        async (file: File) => {
            try {
                const text = await file.text();
                const cues = parseSubtitles(text, file.name);
                if (!cues.length) {
                    makeToast('No subtitle cues found in file.', 'warning');
                }
                const key = `local:${Date.now()}-${file.name}`;
                localSubtitleCuesRef.current.set(key, cues);
                const track: SubtitleTrack = {
                    url: key,
                    lang: 'local',
                    label: file.name,
                    source: 'local',
                };
                setLocalSubtitleTracks((prev) => {
                    const next = [...prev, track];
                    const nextIndex = subtitleTracks.length + next.length - 1;
                    setSelectedSubtitleIndex(nextIndex);
                    setIsSubtitleDisabled(false);
                    return next;
                });
            } catch (error) {
                console.error('[AnimeVideoPlayer] Failed to import subtitle file', error);
                makeToast('Failed to import subtitle file.', 'error');
            }
        },
        [subtitleTracks.length],
    );

    const handleSubtitleFileChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) {
                return;
            }
            importSubtitleFile(file);
        },
        [importSubtitleFile],
    );

    const seekBy = (delta: number) => {
        const video = videoRef.current;
        if (!video) return;
        const nextTime = Math.min(Math.max(video.currentTime + delta, 0), duration || video.currentTime);
        video.currentTime = nextTime;
        setCurrentTime(nextTime);
    };

    const seekToTime = (targetTime: number) => {
        const video = videoRef.current;
        if (!video) return;
        const safeTime = Math.min(Math.max(targetTime, 0), duration || targetTime);
        video.currentTime = safeTime;
        setCurrentTime(safeTime);
    };

    const repeatCurrentSubtitle = useCallback(() => {
        if (!sortedSubtitleCues.length) {
            return;
        }
        const offsetSeconds = safeSubtitleOffsetMs / 1000;
        const baseTime = videoRef.current?.currentTime ?? currentTime;
        const effectiveTime = baseTime + offsetSeconds;
        const epsilon = SUBTITLE_TIME_EPSILON;
        const currentCue = getCurrentSubtitleCue();
        if (currentCue) {
            seekToTime(currentCue.start - offsetSeconds);
            return;
        }
        for (let i = sortedSubtitleCues.length - 1; i >= 0; i -= 1) {
            const cue = sortedSubtitleCues[i];
            if (cue.start < effectiveTime - epsilon) {
                seekToTime(cue.start - offsetSeconds);
                return;
            }
        }
        seekToTime(sortedSubtitleCues[0].start - offsetSeconds);
    }, [sortedSubtitleCues, safeSubtitleOffsetMs, currentTime, getCurrentSubtitleCue, seekToTime]);

    const skipToPreviousSubtitle = useCallback(() => {
        if (!sortedSubtitleCues.length) {
            seekBy(-10);
            return;
        }
        const offsetSeconds = safeSubtitleOffsetMs / 1000;
        const baseTime = videoRef.current?.currentTime ?? currentTime;
        const effectiveTime = baseTime + offsetSeconds;
        const epsilon = SUBTITLE_TIME_EPSILON;
        const currentCue = getCurrentSubtitleCue();
        if (currentCue) {
            const currentIndex = sortedSubtitleCues.findIndex((cue) => cue.id === currentCue.id);
            if (currentIndex > 0) {
                seekToTime(sortedSubtitleCues[currentIndex - 1].start - offsetSeconds);
                return;
            }
            seekToTime(sortedSubtitleCues[0].start - offsetSeconds);
            return;
        }
        for (let i = sortedSubtitleCues.length - 1; i >= 0; i -= 1) {
            const cue = sortedSubtitleCues[i];
            if (cue.start < effectiveTime - epsilon) {
                seekToTime(cue.start - offsetSeconds);
                return;
            }
        }
        seekToTime(sortedSubtitleCues[0].start - offsetSeconds);
    }, [sortedSubtitleCues, safeSubtitleOffsetMs, currentTime, getCurrentSubtitleCue, seekBy, seekToTime]);

    const skipToNextSubtitle = useCallback(() => {
        if (!sortedSubtitleCues.length) {
            seekBy(10);
            return;
        }
        const offsetSeconds = safeSubtitleOffsetMs / 1000;
        const baseTime = videoRef.current?.currentTime ?? currentTime;
        const effectiveTime = baseTime + offsetSeconds;
        const epsilon = SUBTITLE_TIME_EPSILON;
        const currentCue = getCurrentSubtitleCue();
        if (currentCue) {
            const currentIndex = sortedSubtitleCues.findIndex((cue) => cue.id === currentCue.id);
            if (currentIndex >= 0 && currentIndex < sortedSubtitleCues.length - 1) {
                seekToTime(sortedSubtitleCues[currentIndex + 1].start - offsetSeconds);
                return;
            }
        }
        for (let i = 0; i < sortedSubtitleCues.length; i += 1) {
            const cue = sortedSubtitleCues[i];
            if (cue.start > effectiveTime + epsilon) {
                seekToTime(cue.start - offsetSeconds);
                return;
            }
        }
        const lastCue = sortedSubtitleCues[sortedSubtitleCues.length - 1];
        seekToTime(lastCue.start - offsetSeconds);
    }, [sortedSubtitleCues, safeSubtitleOffsetMs, currentTime, getCurrentSubtitleCue, seekBy, seekToTime]);

    const handleSwipeStart = useCallback(
        (event: React.TouchEvent<HTMLDivElement>) => {
            if (event.touches.length !== 1 || isAnyMenuOpen || dictionaryVisible) {
                swipeStateRef.current = null;
                return;
            }
            const touch = event.touches[0];
            swipeStateRef.current = {
                startX: touch.clientX,
                startY: touch.clientY,
                startTime: Date.now(),
                moved: false,
            };
            swipeConsumedRef.current = false;
        },
        [dictionaryVisible, isAnyMenuOpen],
    );

    const handleSwipeMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        const state = swipeStateRef.current;
        if (!state || event.touches.length !== 1) {
            return;
        }
        const touch = event.touches[0];
        const deltaX = touch.clientX - state.startX;
        const deltaY = touch.clientY - state.startY;
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
            state.moved = true;
        }
    }, []);

    const handleSwipeEnd = useCallback(
        (event: React.TouchEvent<HTMLDivElement>) => {
            const state = swipeStateRef.current;
            swipeStateRef.current = null;
            if (!state || !state.moved || isAnyMenuOpen || dictionaryVisible) {
                return;
            }
            const touch = event.changedTouches[0];
            if (!touch) {
                return;
            }
            const deltaX = touch.clientX - state.startX;
            const deltaY = touch.clientY - state.startY;
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);
            const elapsed = Date.now() - state.startTime;
            if (elapsed > 800 || absX < 60 || absX < absY * 1.2) {
                return;
            }
            swipeConsumedRef.current = true;
            if (deltaX < 0) {
                skipToPreviousSubtitle();
            } else {
                skipToNextSubtitle();
            }
        },
        [dictionaryVisible, isAnyMenuOpen, skipToNextSubtitle, skipToPreviousSubtitle],
    );

    const toggleSubtitles = useCallback(() => {
        setIsSubtitleDisabled((prev) => !prev);
    }, [setIsSubtitleDisabled]);

    const nudgeSubtitleOffset = useCallback((delta: number) => {
        setSubtitleOffsetMs((prev) => (Number.isFinite(prev) ? prev : 0) + delta);
    }, [setSubtitleOffsetMs]);

    const alignSubtitleOffset = useCallback((direction: 'previous' | 'next') => {
        const cue = getSubtitleSyncTarget(direction);
        syncSubtitleOffsetToCue(cue);
    }, [getSubtitleSyncTarget, syncSubtitleOffsetToCue]);

    useEffect(() => {
        if (!isDesktopPlatform) {
            return;
        }
        enableScope(HotkeyScope.ANIME);
        return () => disableScope(HotkeyScope.ANIME);
    }, [disableScope, enableScope, isDesktopPlatform]);

    const getHotkeyOptions = useCallback(
        (keys: string[]) => ({
            ...hotkeyScopeOptions,
            enabled: isDesktopPlatform && keys.length > 0,
        }),
        [hotkeyScopeOptions, isDesktopPlatform],
    );

    useHotkeysHook(
        animeHotkeys[AnimeHotkey.TOGGLE_PLAY],
        () => togglePlay(),
        getHotkeyOptions(animeHotkeys[AnimeHotkey.TOGGLE_PLAY]),
        [togglePlay],
    );
    useHotkeysHook(
        animeHotkeys[AnimeHotkey.PREVIOUS_SUBTITLE],
        () => skipToPreviousSubtitle(),
        getHotkeyOptions(animeHotkeys[AnimeHotkey.PREVIOUS_SUBTITLE]),
        [skipToPreviousSubtitle],
    );
    useHotkeysHook(
        animeHotkeys[AnimeHotkey.NEXT_SUBTITLE],
        () => skipToNextSubtitle(),
        getHotkeyOptions(animeHotkeys[AnimeHotkey.NEXT_SUBTITLE]),
        [skipToNextSubtitle],
    );
    useHotkeysHook(
        animeHotkeys[AnimeHotkey.REPEAT_SUBTITLE],
        () => repeatCurrentSubtitle(),
        getHotkeyOptions(animeHotkeys[AnimeHotkey.REPEAT_SUBTITLE]),
        [repeatCurrentSubtitle],
    );
    useHotkeysHook(
        animeHotkeys[AnimeHotkey.TOGGLE_SUBTITLES],
        () => toggleSubtitles(),
        getHotkeyOptions(animeHotkeys[AnimeHotkey.TOGGLE_SUBTITLES]),
        [toggleSubtitles],
    );
    useHotkeysHook(
        animeHotkeys[AnimeHotkey.ALIGN_PREVIOUS_SUBTITLE],
        () => alignSubtitleOffset('previous'),
        getHotkeyOptions(animeHotkeys[AnimeHotkey.ALIGN_PREVIOUS_SUBTITLE]),
        [alignSubtitleOffset],
    );
    useHotkeysHook(
        animeHotkeys[AnimeHotkey.ALIGN_NEXT_SUBTITLE],
        () => alignSubtitleOffset('next'),
        getHotkeyOptions(animeHotkeys[AnimeHotkey.ALIGN_NEXT_SUBTITLE]),
        [alignSubtitleOffset],
    );
    useHotkeysHook(
        animeHotkeys[AnimeHotkey.OFFSET_SUBTITLE_BACK_100],
        () => nudgeSubtitleOffset(-100),
        getHotkeyOptions(animeHotkeys[AnimeHotkey.OFFSET_SUBTITLE_BACK_100]),
        [nudgeSubtitleOffset],
    );
    useHotkeysHook(
        animeHotkeys[AnimeHotkey.OFFSET_SUBTITLE_FORWARD_100],
        () => nudgeSubtitleOffset(100),
        getHotkeyOptions(animeHotkeys[AnimeHotkey.OFFSET_SUBTITLE_FORWARD_100]),
        [nudgeSubtitleOffset],
    );

    const episodeMenuItems = useMemo(
        () =>
            episodeOptions.map((option) => {
                const isSelected = option.index === currentEpisodeIndex;
                return (
                    <MenuItem
                        key={option.index}
                        id={`episode-option-${option.index}`}
                        selected={isSelected}
                        onClick={(event) => {
                            event.stopPropagation();
                            markMenuInteraction();
                            onEpisodeSelect?.(option.index);
                            setEpisodeMenuAnchor(null);
                        }}
                    >
                        <ListItemIcon sx={{ minWidth: 32 }}>{renderSelectionIcon(isSelected)}</ListItemIcon>
                        <ListItemText primary={option.label} />
                    </MenuItem>
                );
            }),
        [currentEpisodeIndex, episodeOptions, markMenuInteraction, onEpisodeSelect, renderSelectionIcon],
    );

    const videoMenuItems = useMemo(
        () =>
            videoOptions.map((option) => {
                const isSelected = option.index === selectedVideoIndex;
                return (
                    <MenuItem
                        key={option.index}
                        selected={isSelected}
                        onClick={(event) => {
                            event.stopPropagation();
                            markMenuInteraction();
                            onVideoChange(option.index);
                            setVideoMenuAnchor(null);
                        }}
                    >
                        <ListItemIcon sx={{ minWidth: 32 }}>{renderSelectionIcon(isSelected)}</ListItemIcon>
                        <ListItemText primary={option.label} />
                    </MenuItem>
                );
            }),
        [markMenuInteraction, onVideoChange, renderSelectionIcon, selectedVideoIndex, videoOptions],
    );

    const renderSubtitleText = useCallback(
        (text: string, cueKey: string) => {
            if (!highlightedSubtitle || highlightedSubtitle.key !== cueKey) {
                return text;
            }

            const { start, end } = highlightedSubtitle;
            if (start < 0 || end <= start || end > text.length) {
                return text;
            }

            return (
                <>
                    {text.slice(0, start)}
                    <Box
                        component="span"
                        sx={{
                            backgroundColor: 'rgba(255,255,255,0.28)',
                            color: 'inherit',
                            borderRadius: 0.6,
                            px: 0.4,
                        }}
                    >
                        {text.slice(start, end)}
                    </Box>
                    {text.slice(end)}
                </>
            );
        },
        [highlightedSubtitle],
    );

    const renderShortcutKeys = useCallback((keys: string[]) => {
        if (!keys.length) {
            return (
                <Typography variant="body2" sx={{ opacity: 0.6 }}>
                    Unassigned
                </Typography>
            );
        }
        return <Hotkey keys={keys} />;
    }, []);

    return (
        <Box
            ref={wrapperRef}
            sx={{
                position: wrapperFixed ? 'fixed' : 'relative',
                inset: wrapperFixed ? 0 : 'auto',
                width: '100%',
                height: wrapperFullBleed ? '100%' : 'auto',
                backgroundColor: 'black',
                borderRadius: wrapperFullBleed ? 0 : 1,
                overflow: 'hidden',
                zIndex: wrapperFixed ? 1400 : 'auto',
                display: wrapperFixed ? 'flex' : 'block',
                alignItems: wrapperFixed ? 'center' : 'stretch',
                justifyContent: wrapperFixed ? 'center' : 'stretch',
                padding: wrapperFullBleed
                    ? 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'
                    : 0,
                boxSizing: 'border-box',
            }}
            onClick={() => {
                if (swipeConsumedRef.current) {
                    swipeConsumedRef.current = false;
                    return;
                }
                if (dictionaryVisible) {
                    resumeFromDictionary();
                    return;
                }
                if (isAnyMenuOpen || shouldIgnoreOverlayToggle()) {
                    return;
                }
                handleOverlayToggle();
            }}
            onTouchStart={handleSwipeStart}
            onTouchMove={handleSwipeMove}
            onTouchEnd={handleSwipeEnd}
        >
            <Box
                sx={{
                    position: 'relative',
                    width: '100%',
                    height: isFullHeight ? '100%' : 'auto',
                    aspectRatio: isFullHeight ? 'auto' : '16 / 9',
                    backgroundColor: 'black',
                    borderRadius: wrapperFullBleed ? 0 : 1,
                    overflow: 'hidden',
                }}
            >
                <Box
                    component="input"
                    type="file"
                    accept=".srt,.vtt,.ass,.ssa"
                    onChange={handleSubtitleFileChange}
                    ref={subtitleFileInputRef}
                    sx={{ display: 'none' }}
                />
                <Box
                    component="video"
                    ref={videoRef}
                    playsInline
                    autoPlay
                    preload="metadata"
                    crossOrigin="anonymous"
                    sx={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'black' }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        display: isCaptureMode ? 'none' : 'block',
                    }}
                >
                    <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `${tapZonePercent}%`,
                    zIndex: 2,
                    backgroundColor: showTapZoneHint ? 'rgba(255,0,0,0.2)' : 'transparent',
                    transition: 'background-color 0.3s ease',
                    pointerEvents: isTapZoneActive ? 'auto' : 'none',
                }}
                onClick={(event) => {
                    event.stopPropagation();
                    if (!isTapZoneActive) {
                        return;
                    }
                    togglePlay();
                }}
            />
            {showTapZoneHint && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: `${tapZonePercent}%`,
                        zIndex: 3,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                    }}
                >
                    <Typography
                        variant="body2"
                        sx={{
                            color: '#fff',
                            backgroundColor: 'rgba(0,0,0,0.4)',
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 999,
                        }}
                    >
                        Tap here to play/pause
                    </Typography>
                </Box>
            )}
            {showShortcutHint && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        zIndex: 4,
                        pointerEvents: 'none',
                        color: '#fff',
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        borderRadius: 2,
                        px: 2,
                        py: 1.5,
                        minWidth: 260,
                        maxWidth: 380,
                        backdropFilter: 'blur(8px)',
                    }}
                >
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, opacity: 0.7 }}>
                        Shortcuts
                    </Typography>
                    <Stack spacing={0.75} sx={{ mt: 1 }}>
                        {ANIME_HOTKEYS.map((hotkey) => (
                            <Stack
                                key={hotkey}
                                direction="row"
                                spacing={2}
                                alignItems="center"
                                sx={{ justifyContent: 'space-between' }}
                            >
                                {renderShortcutKeys(animeHotkeys[hotkey] ?? [])}
                                <Typography
                                    variant="body2"
                                    sx={{ opacity: 0.7, textAlign: 'right' }}
                                    title={ANIME_HOTKEY_DESCRIPTIONS[hotkey]}
                                >
                                    {ANIME_HOTKEY_LABELS[hotkey]}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </Box>
            )}
            {statusMessage && (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#cbd0d6',
                        textAlign: 'center',
                        px: 2,
                        zIndex: 4,
                        pointerEvents: 'none',
                        transform: 'translateY(-32px)',
                    }}
                >
                    <Typography variant="body2">{statusMessage}</Typography>
                </Box>
            )}
            <Stack
                sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: subtitleBottomOffset,
                    px: 2,
                    pb: 2,
                    textAlign: 'center',
                    pointerEvents: 'none',
                    zIndex: 3,
                    alignItems: 'center',
                }}
            >
                {shouldRenderSubtitles &&
                    activeCues.map((cue) => (
                        <Box
                            key={cue.id}
                            data-subtitle-cue="true"
                            sx={{
                                color: 'white',
                                borderRadius: 1,
                                p: 0.5,
                                mb: 0.5,
                                pointerEvents: 'auto',
                                cursor: 'pointer',
                                whiteSpace: 'pre-line',
                                textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                                display: 'inline-block',
                                alignSelf: 'center',
                                maxWidth: '100%',
                                WebkitTapHighlightColor: 'transparent',
                            }}
                            onClick={(event) => handleSubtitleClick(event, cue.text, cue.id, cue.start, cue.end)}
                            onMouseMove={(event) => handleSubtitleMouseMove(event, cue)}
                            onMouseLeave={(event) => handleSubtitleMouseLeave(event)}
                        >
                            <Typography
                                variant="body1"
                                sx={{
                                    fontSize: settings.subtitleFontSize || 22,
                                    fontWeight: settings.subtitleFontWeight ?? 600,
                                    textShadow:
                                        '0 0 1px rgba(0,0,0,0.9), 0 1px 1px rgba(0,0,0,0.9), 0 -1px 1px rgba(0,0,0,0.9), 1px 0 1px rgba(0,0,0,0.9), -1px 0 1px rgba(0,0,0,0.9)',
                                }}
                            >
                                {renderSubtitleText(cue.text, cue.id)}
                            </Typography>
                        </Box>
                    ))}
            </Stack>
            {dictionaryVisible && (
                <>
                    <Box
                        sx={{
                            position: 'absolute',
                            top: popupTopOffset,
                            left: popupLeftOffset,
                            transform: popupTransform,
                            width: popupWidthStyle,
                            height: popupHeightStyle,
                            backgroundColor: 'rgba(26,29,33,0.96)',
                            color: '#eee',
                            p: 2,
                            overflowY: 'auto',
                            zIndex: 4,
                        }}
                        onClick={(event) => {
                            event.stopPropagation();
                            closeWordAudioMenu();
                        }}
                    >
                        <Stack spacing={1}>
                            {dictionaryLoading && (
                                <Typography variant="body2" sx={{ textAlign: 'center', color: '#aaa', py: 2 }}>
                                    Scanning…
                                </Typography>
                            )}
                            {!dictionaryLoading && dictionaryResults.map((entry, i) => (
                                <Box
                                    key={`${entry.headword}-${entry.reading}-${i}`}
                                    sx={{
                                        mb: 2,
                                        pb: 2,
                                        borderBottom: i < dictionaryResults.length - 1 ? '1px solid #333' : 'none',
                                    }}
                                >
                                    <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="flex-start"
                                        sx={{ mb: 1 }}
                                    >
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 1 }}>
                                            <Typography variant="h5" sx={{ lineHeight: 1 }}>
                                                {entry.headword}
                                            </Typography>
                                            {entry.reading && (
                                                <Typography variant="caption" sx={{ color: '#aaa' }}>
                                                    {entry.reading}
                                                </Typography>
                                            )}
                                            {entry.termTags
                                                ?.flatMap((tag) => splitTagString(getTermTagLabel(tag)))
                                                .map((label, tagIndex) => (
                                                    <Box
                                                        key={`${entry.headword}-tag-${tagIndex}`}
                                                        sx={{
                                                            px: 0.5,
                                                            py: 0.1,
                                                            borderRadius: 0.5,
                                                            fontSize: '0.7rem',
                                                            backgroundColor: '#666',
                                                        }}
                                                    >
                                                        {label}
                                                    </Box>
                                                ))}
                                        </Box>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            {settings.ankiConnectEnabled && (
                                                <>
                                                    {(!settings.ankiDeck || !settings.ankiModel) ? (
                                                        <IconButton
                                                            size="small"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                showAlert(
                                                                    'Anki Settings Missing',
                                                                    'Select a target Deck and Card Type in settings.',
                                                                );
                                                            }}
                                                            title="Anki settings missing"
                                                            sx={{ color: '#d04a4a' }}
                                                            aria-label="Anki settings missing"
                                                        >
                                                            <CloseIcon fontSize="small" />
                                                        </IconButton>
                                                    ) : (
                                                        settings.enableYomitan
                                                            ? (() => {
                                                                const entryKey = getDictionaryEntryKey(entry);
                                                                if (ankiActionPending[entryKey]) {
                                                                    return (
                                                                        <IconButton
                                                                            size="small"
                                                                            disabled
                                                                            title="Adding card..."
                                                                            sx={{ color: '#888' }}
                                                                            aria-label="Adding card"
                                                                        >
                                                                            <HourglassEmptyIcon fontSize="small" />
                                                                        </IconButton>
                                                                    );
                                                                }
                                                                const status = getAnkiEntryStatus(entry);
                                                                if (status === 'exists') {
                                                                    return (
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                handleAnkiOpen(entry);
                                                                            }}
                                                                            title="Open in Anki"
                                                                            sx={{ color: '#2ecc71' }}
                                                                            aria-label="Open in Anki"
                                                                        >
                                                                            <MenuBookIcon sx={{ fontSize: 22, transform: 'translateY(-0.5px)' }} />
                                                                        </IconButton>
                                                                    );
                                                                }
                                                                if (status === 'missing') {
                                                                    return (
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                handleAnkiAdd(entry);
                                                                            }}
                                                                            title="Add to Anki"
                                                                            sx={{ color: '#2ecc71' }}
                                                                            aria-label="Add to Anki"
                                                                        >
                                                                            <AddCircleOutlineIcon
                                                                                sx={{
                                                                                    fontSize: 22,
                                                                                    '& path': {
                                                                                        transform: 'scale(0.9167)',
                                                                                        transformOrigin: 'center',
                                                                                        transformBox: 'fill-box',
                                                                                    },
                                                                                }}
                                                                            />
                                                                        </IconButton>
                                                                    );
                                                                }
                                                                return (
                                                                    <IconButton
                                                                        size="small"
                                                                        disabled
                                                                        title="Checking duplicates"
                                                                        sx={{ color: '#888' }}
                                                                        aria-label="Checking duplicates"
                                                                    >
                                                                        <HourglassEmptyIcon fontSize="small" />
                                                                    </IconButton>
                                                                );
                                                            })()
                                                            : (() => {
                                                                const entryKey = getDictionaryEntryKey(entry);
                                                                const isPending = ankiActionPending[entryKey];
                                                                return (
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            if (isPending) {
                                                                                return;
                                                                            }
                                                                            handleAnkiReplaceLast(entry);
                                                                        }}
                                                                        title={isPending ? 'Updating card...' : 'Update last card'}
                                                                        sx={{ color: isPending ? '#888' : '#4fb0ff' }}
                                                                        disabled={isPending}
                                                                        aria-label={isPending ? 'Updating card' : 'Update last card'}
                                                                    >
                                                                        <NoteAddIcon fontSize="small" />
                                                                    </IconButton>
                                                                );
                                                            })()
                                                    )}
                                                </>
                                            )}
                                            <IconButton
                                                size="small"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handlePlayWordAudio(entry);
                                                }}
                                                onContextMenu={(event) => openWordAudioMenu(event, entry)}
                                                title="Play word audio (right-click for sources)"
                                                aria-label="Play word audio"
                                                disabled={!wordAudioOptions.length}
                                                sx={{
                                                    color: wordAudioOptions.length ? '#7cc8ff' : '#555',
                                                }}
                                            >
                                                <VolumeUpIcon sx={{ fontSize: 22 }} />
                                            </IconButton>
                                        </Stack>
                                    </Stack>
                                    {(() => {
                                        const { pitchAccents, ipa } = extractPronunciationData(entry);
                                        if (pitchAccents.length === 0 && ipa.length === 0) return null;
                                        return (
                                            <PronunciationSection
                                                reading={entry.reading || entry.headword}
                                                pitchAccents={pitchAccents}
                                                ipa={ipa}
                                                showGraph={true}
                                                showText={true}
                                                showNotation={true}
                                            />
                                        );
                                    })()}
                                    {entry.frequencies && entry.frequencies.length > 0 && (
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: 0.75,
                                                mb: 1,
                                            }}
                                        >
                                            {entry.frequencies.map((freq, freqIndex) => (
                                                <Box
                                                    key={`${entry.headword}-freq-${freqIndex}`}
                                                    sx={{
                                                        display: 'inline-flex',
                                                        fontSize: '0.7rem',
                                                        borderRadius: 0.75,
                                                        overflow: 'hidden',
                                                        border: '1px solid rgba(255,255,255,0.2)',
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            backgroundColor: '#2ecc71',
                                                            color: '#000',
                                                            fontWeight: 'bold',
                                                            px: 0.75,
                                                            py: 0.2,
                                                        }}
                                                    >
                                                        {freq.dictionaryName}
                                                    </Box>
                                                    <Box
                                                        sx={{
                                                            backgroundColor: '#333',
                                                            color: '#eee',
                                                            px: 0.75,
                                                            py: 0.2,
                                                            fontWeight: 'bold',
                                                        }}
                                                    >
                                                        {freq.value}
                                                    </Box>
                                                </Box>
                                            ))}
                                        </Box>
                                    )}
                                    {entry.glossary?.map((def, defIndex) => (
                                        <Stack key={`${entry.headword}-def-${defIndex}`} sx={{ mb: 1 }}>
                                            <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
                                                {normalizeTagList(def.tags ?? []).map((tag, tagIndex) => (
                                                    <Box
                                                        key={`${entry.headword}-def-${defIndex}-tag-${tagIndex}`}
                                                        sx={{
                                                            px: 0.5,
                                                            py: 0.1,
                                                            borderRadius: 0.5,
                                                            fontSize: '0.7rem',
                                                            backgroundColor: '#666',
                                                        }}
                                                    >
                                                        {tag}
                                                    </Box>
                                                ))}
                                                <Box
                                                    sx={{
                                                        px: 0.5,
                                                        py: 0.1,
                                                        borderRadius: 0.5,
                                                        fontSize: '0.7rem',
                                                        backgroundColor: '#9b59b6',
                                                    }}
                                                >
                                                    {def.dictionaryName}
                                                </Box>
                                            </Stack>
                                            <Box sx={{ color: '#ddd' }}>
                                                {def.content.map((jsonString, idx) => (
                                                    <Box key={`${entry.headword}-def-${defIndex}-${idx}`} sx={{ mb: 0.5 }}>
                                                        <StructuredContent contentString={jsonString} />
                                                    </Box>
                                                ))}
                                            </Box>
                                        </Stack>
                                    ))}
                                </Box>
                            ))}
                            {!dictionaryLoading && dictionaryResults.length === 0 && (
                                <Typography variant="body2" sx={{ textAlign: 'center', color: '#777' }}>
                                    No results found
                                </Typography>
                            )}
                        </Stack>
                    </Box>
                </>
            )}
            {isOverlayVisible && !dictionaryVisible && (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        px: 2,
                        pt: isMobile ? 'calc(env(safe-area-inset-top) + 24px)' : 2,
                        pb: isMobile
                            ? isLandscape
                                ? 'calc(env(safe-area-inset-bottom) + 4px)'
                                : 'calc(env(safe-area-inset-bottom) + 12px)'
                            : 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                    }}
                        onClick={(event) => {
                            event.stopPropagation();
                            if (isAnyMenuOpen || shouldIgnoreOverlayToggle()) {
                                return;
                            }
                            setIsOverlayVisible(false);
                            setAutoOverlayDisabled(true);
                        }}
                    >
                    <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ pointerEvents: 'none' }}
                    >
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ pointerEvents: 'auto' }}>
                            {episodeOptions.length > 0 && onEpisodeSelect && (
                                <IconButton
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        markMenuInteraction();
                                        setEpisodeMenuAnchor(event.currentTarget);
                                    }}
                                    color="inherit"
                                    aria-label="Episodes"
                                    title="Episodes"
                                >
                                    <FormatListBulletedIcon />
                                </IconButton>
                            )}
                            <IconButton
                                onClick={(event) => {
                                    event.stopPropagation();
                                    markMenuInteraction();
                                    setVideoMenuAnchor(event.currentTarget);
                                }}
                                color="inherit"
                                aria-label="Video options"
                                title="Video options"
                            >
                                <VideoSettingsIcon />
                            </IconButton>
                            <IconButton
                                onClick={(event) => {
                                    event.stopPropagation();
                                    markMenuInteraction();
                                    setSubtitleMenuAnchor(event.currentTarget);
                                }}
                                color="inherit"
                                aria-label="Subtitle options"
                                title="Subtitle options"
                            >
                                <SubtitlesIcon />
                            </IconButton>
                            <IconButton
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (!hasSubtitleTracks) {
                                        return;
                                    }
                                    toggleSubtitles();
                                }}
                                color="inherit"
                                disabled={!hasSubtitleTracks}
                                aria-label={
                                    hasSubtitleTracks
                                        ? (isSubtitleDisabled ? 'Show subtitles' : 'Hide subtitles')
                                        : 'No subtitles available'
                                }
                                title={
                                    hasSubtitleTracks
                                        ? (isSubtitleDisabled ? 'Show subtitles' : 'Hide subtitles')
                                        : 'No subtitles available'
                                }
                            >
                                {isSubtitleDisabled ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                            <IconButton
                                onClick={(event) => {
                                    event.stopPropagation();
                                    markMenuInteraction();
                                    setSpeedMenuAnchor(event.currentTarget);
                                }}
                                color="inherit"
                                aria-label="Playback speed"
                                title="Playback speed"
                            >
                                <SpeedIcon />
                            </IconButton>
                            <IconButton
                                onClick={(event) => {
                                    event.stopPropagation();
                                    markMenuInteraction();
                                    if (isDesktopPlatform) {
                                        showShortcutHintFor(6000);
                                    } else {
                                        showTapZoneHintFor(3000);
                                    }
                                }}
                                color="inherit"
                                aria-label={infoButtonLabel}
                                title={infoButtonLabel}
                            >
                                <InfoOutlinedIcon />
                            </IconButton>
                            <IconButton
                                onClick={(event) => {
                                    event.stopPropagation();
                                    openSettings();
                                }}
                                color="inherit"
                                aria-label="Manatan Settings"
                                title="Manatan Settings"
                            >
                                <Box
                                    component="img"
                                    src={ManatanLogo}
                                    alt="Manatan"
                                    sx={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
                                />
                            </IconButton>
                            {shouldShowFullscreen && (
                                <IconButton
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        void toggleFullscreen();
                                    }}
                                    color="inherit"
                                    aria-label={isPageFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                                    title={isPageFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                                >
                                    {isPageFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                                </IconButton>
                            )}
                        </Stack>
                        <IconButton
                            onClick={(event) => {
                                event.stopPropagation();
                                onExit();
                            }}
                            color="inherit"
                            sx={{ pointerEvents: 'auto' }}
                            aria-label="Close player"
                            title="Close player"
                        >
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                    <Box sx={{ flexGrow: 1 }} />
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none',
                            zIndex: 3,
                        }}
                    >
                        <Stack direction="row" justifyContent="center" spacing={2} alignItems="center">
                            {shouldShowEpisodeNavigation && (
                                <IconButton
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        if (previousEpisodeOption && onEpisodeSelect) {
                                            onEpisodeSelect(previousEpisodeOption.index);
                                        }
                                    }}
                                    color="inherit"
                                    sx={{ pointerEvents: 'auto' }}
                                    disabled={!previousEpisodeOption || !onEpisodeSelect}
                                    aria-label="Previous episode"
                                    title={previousEpisodeOption ? 'Previous episode' : 'No previous episode'}
                                >
                                    <SkipPreviousIcon />
                                </IconButton>
                            )}
                            <IconButton
                                onClick={(event) => {
                                    event.stopPropagation();
                                    skipToPreviousSubtitle();
                                }}
                                color="inherit"
                                sx={{ pointerEvents: 'auto' }}
                            >
                                <RotateLeftIcon />
                            </IconButton>
                            <IconButton
                                onClick={(event) => {
                                    event.stopPropagation();
                                    togglePlay();
                                }}
                                color="inherit"
                                sx={{ pointerEvents: 'auto' }}
                            >
                                {isVideoLoading ? (
                                    <CircularProgress size={32} color="inherit" />
                                ) : isPaused ? (
                                    <PlayArrowIcon />
                                ) : (
                                    <PauseIcon />
                                )}
                            </IconButton>
                            <IconButton
                                onClick={(event) => {
                                    event.stopPropagation();
                                    skipToNextSubtitle();
                                }}
                                color="inherit"
                                sx={{ pointerEvents: 'auto' }}
                            >
                                <RotateRightIcon />
                            </IconButton>
                            {shouldShowEpisodeNavigation && (
                                <IconButton
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        if (nextEpisodeOption && onEpisodeSelect) {
                                            onEpisodeSelect(nextEpisodeOption.index);
                                        }
                                    }}
                                    color="inherit"
                                    sx={{ pointerEvents: 'auto' }}
                                    disabled={!nextEpisodeOption || !onEpisodeSelect}
                                    aria-label="Next episode"
                                    title={nextEpisodeOption ? 'Next episode' : 'No next episode'}
                                >
                                    <SkipNextIcon />
                                </IconButton>
                            )}
                        </Stack>
                    </Box>
                    <Stack spacing={1} sx={{ pointerEvents: 'none', position: 'relative', zIndex: 4 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'center', sm: 'flex-end' }} spacing={2}>
                            <Stack spacing={0.5} sx={{ flexGrow: 1, width: '100%', pointerEvents: 'auto' }}>
                                <Box
                                    sx={{
                                        position: 'relative',
                                        width: '100%',
                                        minHeight: 28,
                                        display: 'flex',
                                        alignItems: 'center',
                                    }}
                                    onClick={(event) => event.stopPropagation()}
                                    onMouseDown={(event) => event.stopPropagation()}
                                >
                                    <Box
                                        sx={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: 0,
                                        right: 0,
                                        height: 4,
                                        transform: 'translateY(calc(-50% + 12px))',
                                        backgroundColor: 'rgba(255,255,255,0.2)',
                                        borderRadius: 999,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            height: '100%',
                                            width: `${buffered * 100}%`,
                                            backgroundColor: 'rgba(255,255,255,0.5)',
                                            borderRadius: 999,
                                        }}
                                    />
                                </Box>
                                    <Slider
                                        value={duration ? (currentTime / duration) * 100 : 0}
                                        onChange={handleSeek}
                                        aria-label="Video position"
                                        size="small"
                                        sx={{
                                            py: 1.25,
                                            transform: 'translateY(12px)',
                                            '& .MuiSlider-rail, & .MuiSlider-track': {
                                                height: 4,
                                            },
                                        }}
                                    />
                                </Box>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        minHeight: 28,
                                        pointerEvents: 'auto',
                                    }}
                                    onClick={(event) => event.stopPropagation()}
                                    onMouseDown={(event) => event.stopPropagation()}
                                >
                                    {shouldShowVolume && (
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                                px: 0.75,
                                                py: 0.5,
                                                borderRadius: 999,
                                                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                                                backdropFilter: 'blur(6px)',
                                                width: 28,
                                                overflow: 'hidden',
                                                opacity: 0.7,
                                                transition: 'width 200ms ease, opacity 200ms ease',
                                                '&:hover, &:focus-within': {
                                                    width: 160,
                                                    opacity: 1,
                                                },
                                                '&:hover .volume-slider, &:focus-within .volume-slider': {
                                                    opacity: 1,
                                                },
                                            }}
                                        >
                                            <VolumeUpIcon fontSize="small" />
                                            <Slider
                                                className="volume-slider"
                                                value={volumePercent}
                                                onChange={handleVolumeChange}
                                                aria-label="Volume"
                                                size="small"
                                                min={0}
                                                max={100}
                                                sx={{
                                                    width: 110,
                                                    opacity: 0,
                                                    transition: 'opacity 150ms ease',
                                                }}
                                            />
                                        </Box>
                                    )}
                                    <Typography
                                        variant="caption"
                                        sx={{ whiteSpace: 'nowrap', lineHeight: 1, display: 'flex', alignItems: 'center' }}
                                    >
                                        {formatTime(currentTime)} / {formatTime(duration)}
                                    </Typography>
                                    {shouldShowAutoPlayToggle && (
                                        <Box
                                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                                            onClick={(event) => event.stopPropagation()}
                                            onMouseDown={(event) => event.stopPropagation()}
                                        >
                                            <Typography variant="caption" sx={{ opacity: 0.8, whiteSpace: 'nowrap' }}>
                                                Auto-play
                                            </Typography>
                                            <Switch
                                                size="small"
                                                checked={Boolean(autoPlayNextEpisode)}
                                                onChange={(event) => setAutoPlayNextEpisode(event.target.checked)}
                                                color="default"
                                                inputProps={{ 'aria-label': 'Auto-play next episode' }}
                                            />
                                        </Box>
                                    )}
                                </Box>
                            </Stack>
                            <Stack spacing={0.5} alignItems="center" sx={{ pointerEvents: 'auto' }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ minHeight: 28 }}>
                                    {(() => {
                                        const previousCue = getSubtitleSyncTarget('previous');
                                        return (
                                            <IconButton
                                                size="small"
                                                disabled={!previousCue}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    syncSubtitleOffsetToCue(previousCue);
                                                }}
                                                color="inherit"
                                                aria-label="Align to previous subtitle start"
                                                title="Align to previous subtitle start"
                                            >
                                                <KeyboardDoubleArrowLeftIcon fontSize="small" />
                                            </IconButton>
                                        );
                                    })()}
                                    {(() => {
                                        const nextCue = getSubtitleSyncTarget('next');
                                        return (
                                            <IconButton
                                                size="small"
                                                disabled={!nextCue}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    syncSubtitleOffsetToCue(nextCue);
                                                }}
                                                color="inherit"
                                                aria-label="Align to next subtitle start"
                                                title="Align to next subtitle start"
                                            >
                                                <KeyboardDoubleArrowRightIcon fontSize="small" />
                                            </IconButton>
                                        );
                                    })()}
                                </Stack>
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: 'auto 64px auto',
                                        alignItems: 'center',
                                        columnGap: 1,
                                        minHeight: 28,
                                    }}
                                >
                                    <IconButton
                                        size="small"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setSubtitleOffsetMs((prev) => (Number.isFinite(prev) ? prev : 0) - 100);
                                        }}
                                        color="inherit"
                                        aria-label="Decrease subtitle offset 100 ms"
                                        title="Shift subtitle offset -100 ms"
                                    >
                                        <KeyboardArrowLeftIcon fontSize="small" />
                                    </IconButton>
                                    <Typography
                                        variant="caption"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            openSubtitleOffsetDialog();
                                        }}
                                        onTouchEnd={(event) => {
                                            event.stopPropagation();
                                            openSubtitleOffsetDialog();
                                        }}
                                        sx={{
                                            cursor: 'pointer',
                                            minWidth: 64,
                                            textAlign: 'center',
                                            lineHeight: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {safeSubtitleOffsetMs} ms
                                    </Typography>
                                    <IconButton
                                        size="small"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setSubtitleOffsetMs((prev) => (Number.isFinite(prev) ? prev : 0) + 100);
                                        }}
                                        color="inherit"
                                        aria-label="Increase subtitle offset 100 ms"
                                        title="Shift subtitle offset +100 ms"
                                    >
                                        <KeyboardArrowRightIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Stack>
                        </Stack>
                    </Stack>
                    <Menu
                        anchorEl={episodeMenuAnchor}
                        open={Boolean(episodeMenuAnchor)}
                        onClose={(event) => {
                            stopMenuEvent(event);
                            markMenuInteraction();
                            setEpisodeMenuAnchor(null);
                        }}
                        disablePortal={isFullscreenOverlay}
                        container={menuContainer}
                        MenuListProps={{
                            'data-word-audio-menu': 'true',
                            onClick: stopMenuClick,
                        } as any}
                        PaperProps={{
                            sx: { maxHeight: '60vh', minWidth: 220 },
                        }}
                        sx={{ zIndex: isPageFullscreen || (fillHeight && isMobile) ? 1601 : undefined }}
                    >
                        {episodeMenuItems}
                    </Menu>
                    <Menu
                        anchorEl={videoMenuAnchor}
                        open={Boolean(videoMenuAnchor)}
                        onClose={(event) => {
                            stopMenuEvent(event);
                            markMenuInteraction();
                            setVideoMenuAnchor(null);
                        }}
                        disablePortal={isFullscreenOverlay}
                        container={menuContainer}
                        MenuListProps={{
                            onClick: stopMenuClick,
                        }}
                        sx={{ zIndex: isPageFullscreen || (fillHeight && isMobile) ? 1601 : undefined }}
                    >
                        {videoMenuItems}
                    </Menu>
                    <Menu
                        anchorEl={subtitleMenuAnchor}
                        open={Boolean(subtitleMenuAnchor)}
                        onClose={(event) => {
                            stopMenuEvent(event);
                            markMenuInteraction();
                            setSubtitleMenuAnchor(null);
                        }}
                        disablePortal={isFullscreenOverlay}
                        container={menuContainer}
                        MenuListProps={{
                            onClick: stopMenuClick,
                        }}
                        sx={{ zIndex: isPageFullscreen || (fillHeight && isMobile) ? 1601 : undefined }}
                    >
                        <MenuItem
                            onClick={(event) => {
                                event.stopPropagation();
                                markMenuInteraction();
                                setSubtitleMenuAnchor(null);
                                subtitleFileInputRef.current?.click();
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                                <UploadFileIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary="Import subtitle file" />
                        </MenuItem>
                        <MenuItem
                            selected={selectedSubtitleIndex === null}
                            onClick={(event) => {
                                event.stopPropagation();
                                markMenuInteraction();
                                handleSubtitleChange(null);
                                setSubtitleMenuAnchor(null);
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                                {renderSelectionIcon(selectedSubtitleIndex === null)}
                            </ListItemIcon>
                            <ListItemText primary="Off" />
                        </MenuItem>
                        {subtitleMenuItems}
                    </Menu>
                    <Menu
                        anchorEl={speedMenuAnchor}
                        open={Boolean(speedMenuAnchor)}
                        onClose={(event) => {
                            stopMenuEvent(event);
                            markMenuInteraction();
                            setSpeedMenuAnchor(null);
                        }}
                        disablePortal={isFullscreenOverlay}
                        container={menuContainer}
                        MenuListProps={{
                            onClick: stopMenuClick,
                        }}
                        sx={{ zIndex: isPageFullscreen || (fillHeight && isMobile) ? 1601 : undefined }}
                    >
                        {playbackRates.map((rate) => {
                            const isSelected = rate === playbackRate;
                            return (
                                <MenuItem
                                    key={rate}
                                    selected={isSelected}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        markMenuInteraction();
                                        handlePlaybackChange(rate);
                                        setSpeedMenuAnchor(null);
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: 32 }}>{renderSelectionIcon(isSelected)}</ListItemIcon>
                                    <ListItemText primary={`${rate}x`} />
                                </MenuItem>
                            );
                        })}
                        {showBraveProxyToggle && onBraveAudioFixModeChange && (
                            <MenuItem
                                onClick={(event) => {
                                    event.stopPropagation();
                                    markMenuInteraction();
                                    handleBraveAudioFixToggle();
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                    {renderSelectionIcon(braveAudioFixMode !== 'off')}
                                </ListItemIcon>
                                <ListItemText primary={`Brave audio fix: ${braveAudioFixLabel}`} />
                            </MenuItem>
                        )}
                        {showBraveProxyToggle && enableBraveAudioFix && autoBraveFixDetected && (
                            <MenuItem
                                disableRipple
                                disableTouchRipple
                                onClick={(event) => event.stopPropagation()}
                                sx={{ flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}
                            >
                                <Typography variant="caption" sx={{ textTransform: 'uppercase', opacity: 0.7 }}>
                                    Brave start buffer
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                                    <Typography variant="caption">{braveBufferSeconds}s</Typography>
                                    <Slider
                                        value={braveBufferSeconds}
                                        min={5}
                                        max={120}
                                        step={5}
                                        size="small"
                                        onChange={(_, value) => {
                                            const nextValue = Array.isArray(value) ? value[0] : value;
                                            setBraveBufferSeconds(nextValue);
                                        }}
                                        sx={{ width: 140 }}
                                    />
                                </Stack>
                            </MenuItem>
                        )}
                        {showBraveProxyToggle && enableBraveAudioFix && autoBraveFixDetected && (
                            <MenuItem
                                disableRipple
                                disableTouchRipple
                                onClick={(event) => event.stopPropagation()}
                                sx={{ flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}
                            >
                                <Typography variant="caption" sx={{ textTransform: 'uppercase', opacity: 0.7 }}>
                                    Brave audio reset
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                                    <Typography variant="caption">{braveWarmupSeconds}s</Typography>
                                    <Slider
                                        value={braveWarmupSeconds}
                                        min={2}
                                        max={30}
                                        step={1}
                                        size="small"
                                        onChange={(_, value) => {
                                            const nextValue = Array.isArray(value) ? value[0] : value;
                                            setBraveWarmupSeconds(nextValue);
                                        }}
                                        sx={{ width: 140 }}
                                    />
                                </Stack>
                            </MenuItem>
                        )}
                    </Menu>
                    <Menu
                        anchorReference="anchorPosition"
                        anchorPosition={wordAudioMenuAnchor ?? undefined}
                        open={Boolean(wordAudioMenuAnchor)}
                        onClose={(event) => {
                            stopMenuEvent(event);
                            markMenuInteraction();
                            closeWordAudioMenu();
                        }}
                        disablePortal={isFullscreenOverlay}
                        container={menuContainer}
                        MenuListProps={{
                            onClick: stopMenuClick,
                        }}
                        PaperProps={{
                            sx: { minWidth: 220 },
                        }}
                        sx={{ zIndex: isPageFullscreen || (fillHeight && isMobile) ? 1601 : undefined }}
                    >
                        <MenuItem
                            onClick={(event) => {
                                event.stopPropagation();
                                if (wordAudioMenuEntry) {
                                    handlePlayWordAudio(wordAudioMenuEntry, 'auto');
                                }
                                closeWordAudioMenu();
                            }}
                        >
                            <ListItemText
                                primary="Auto (first available)"
                                primaryTypographyProps={{
                                    sx: {
                                        textDecoration: wordAudioAutoAvailable === false ? 'line-through' : 'none',
                                        color: wordAudioAutoAvailable === false ? '#777' : undefined,
                                    },
                                }}
                            />
                            <IconButton
                                size="small"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (wordAudioMenuEntry) {
                                        handleSelectWordAudioSource('auto', wordAudioMenuEntry);
                                    }
                                    closeWordAudioMenu();
                                }}
                                title="Use this source for cards"
                                aria-label="Use this source for cards"
                                sx={{
                                    color:
                                        wordAudioAutoAvailable === false
                                            ? '#555'
                                            : activeWordAudioSelection === 'auto'
                                                ? '#f1c40f'
                                                : '#777',
                                }}
                            >
                                {renderSelectionIcon(activeWordAudioSelection === 'auto')}
                            </IconButton>
                        </MenuItem>
                        {wordAudioOptions.map((source) => (
                            <MenuItem
                                key={source}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (wordAudioMenuEntry) {
                                        handlePlayWordAudio(wordAudioMenuEntry, source);
                                    }
                                    closeWordAudioMenu();
                                }}
                            >
                                <ListItemText
                                    primary={getWordAudioSourceLabel(source)}
                                    primaryTypographyProps={{
                                        sx: {
                                            textDecoration: wordAudioAvailability?.[source] === false ? 'line-through' : 'none',
                                            color: wordAudioAvailability?.[source] === false ? '#777' : undefined,
                                        },
                                    }}
                                />
                                <IconButton
                                    size="small"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        if (wordAudioMenuEntry) {
                                            handleSelectWordAudioSource(source, wordAudioMenuEntry);
                                        }
                                        closeWordAudioMenu();
                                    }}
                                    title="Use this source for cards"
                                    aria-label="Use this source for cards"
                                    sx={{
                                        color:
                                            wordAudioAvailability?.[source] === false
                                                ? '#555'
                                                : activeWordAudioSelection === source
                                                    ? '#f1c40f'
                                                    : '#777',
                                    }}
                                >
                                    {renderSelectionIcon(activeWordAudioSelection === source)}
                                </IconButton>
                            </MenuItem>
                        ))}
                    </Menu>
                    <Dialog
                        open={subtitleOffsetDialogOpen}
                        onClose={(_, reason) => {
                            if (reason === 'backdropClick') {
                                return;
                            }
                            closeSubtitleOffsetDialog();
                        }}
                        onClick={(event) => event.stopPropagation()}
                        disablePortal={isFullscreenOverlay}
                        container={menuContainer}
                        disableEscapeKeyDown={false}
                    >
                        <DialogTitle>Subtitle offset</DialogTitle>
                        <DialogContent sx={{ pt: 2, minWidth: 280 }}>
                            <TextField
                                label="Offset (ms)"
                                type="number"
                                value={subtitleOffsetInput}
                                onChange={(event) => setSubtitleOffsetInput(event.target.value)}
                                fullWidth
                                autoFocus
                                margin="dense"
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ step: 1 }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        applySubtitleOffsetInput();
                                    }
                                }}
                            />
                        </DialogContent>
                        <DialogActions>
                            <Button
                                onClick={(event) => {
                                    event.stopPropagation();
                                    resetSubtitleOffset();
                                }}
                            >
                                Reset
                            </Button>
                            <Button
                                onClick={(event) => {
                                    event.stopPropagation();
                                    closeSubtitleOffsetDialog();
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    applySubtitleOffsetInput();
                                }}
                            >
                                Save
                            </Button>
                        </DialogActions>
                    </Dialog>
                </Box>
            )}
                </Box>
            </Box>
        </Box>
    );
};
