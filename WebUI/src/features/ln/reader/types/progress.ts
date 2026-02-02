// src/ln/reader/types/progress.ts

export interface BookStats {
    chapterLengths: number[];
    totalLength: number;
}

export interface ReadingPosition {
    chapterIndex: number;
    pageIndex?: number;
    chapterCharOffset: number;
    totalCharsRead: number;
    sentenceText: string;
    chapterProgress: number;
    totalProgress: number;
    timestamp: number;
}

export interface ProgressManagerState {
    isReady: boolean;
    currentProgress: number;
    currentPosition: ReadingPosition | null;
}