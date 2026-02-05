// src/ln/reader/types/reader.ts

import { Settings } from '@/Manatan/types';
import { BookStats } from '@/lib/storage/AppStorage';

export interface BaseReaderProps {
    bookId: string;
    chapters: string[];
    stats: BookStats | null;
    settings: Settings;
    isVertical: boolean;
    isRTL: boolean;
    initialChapter?: number;
    initialProgress?: {
        sentenceText?: string;
        chapterIndex?: number;
        pageIndex?: number;
        chapterCharOffset?: number;
        totalProgress?: number;

        blockId?: string;
        blockLocalOffset?: number;
        contextSnippet?: string;
    };
    onToggleUI?: () => void;
    showNavigation?: boolean;
    onPositionUpdate?: (position: {
        chapterIndex: number;
        pageIndex?: number;
        chapterCharOffset?: number;
        sentenceText: string;
        totalProgress: number;

        blockId?: string;
        blockLocalOffset?: number;
        contextSnippet?: string;
    }) => void;
    onRegisterSave?: (saveFn: () => Promise<void>) => void;
    onUpdateSettings?: (key: string, value: any) => void;
    chapterFilenames: string[];
}

export interface PagedReaderProps extends BaseReaderProps {
    initialPage?: number;
}

export interface ContinuousReaderProps extends BaseReaderProps { }