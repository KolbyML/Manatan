/**
 * Reading Progress Hook
 * Handles:
 * 1. Book statistics calculation (total characters)
 * 2. Real-time progress tracking (percentage)
 * 3. Last read sentence tracking
 * 4. Auto-save with 10s timer
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateBookStats } from '../utils/textUtils';

interface UseReadingProgressProps {
    chapters: string[];
    currentChapterIndex: number;
    containerRef: React.RefObject<HTMLElement>;
    isVertical: boolean;
    onSaveProgress?: (progress: ProgressData) => void;
}

export interface ProgressData {
    chapterIndex: number;
    textOffset: number; // Character offset in the current chapter
    totalProgress: number; // 0-100 percentage of total book
    sentenceText: string; // The text of the sentence (for robust restoration)
}

export function useReadingProgress({
    chapters,
    currentChapterIndex,
    containerRef,
    isVertical,
    onSaveProgress
}: UseReadingProgressProps) {
    const [chapterLengths, setChapterLengths] = useState<number[]>([]);
    const [totalLength, setTotalLength] = useState(0);
    const [currentProgress, setCurrentProgress] = useState(0);

    const saveTimerRef = useRef<number | null>(null);
    const lastSavedPosition = useRef<string>('');

    // 1. Calculate book statistics on load
    useEffect(() => {
        if (chapters.length === 0) return;

        // Calculate chapter lengths in a non-blocking way
        const calculate = async () => {
            const lengths = calculateBookStats(chapters);
            const total = lengths.reduce((a, b) => a + b, 0);

            setChapterLengths(lengths);
            setTotalLength(total);
        };

        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(calculate);
        } else {
            setTimeout(calculate, 0);
        }
    }, [chapters]);

    // 2. Function to detect current text position
    const calculatePosition = useCallback((): ProgressData | null => {
        const container = containerRef.current;
        if (!container || chapterLengths.length === 0) return null;

        // Determine the "reading line"
        const rect = container.getBoundingClientRect();

   
        const x = isVertical ? rect.right - 50 : rect.left + 50;
        const y = isVertical ? rect.top + 50 : rect.top + 50;

        let range: Range | null = null;

        // Hit test to find text at reading position
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(x, y);
        } else if ((document as any).caretPositionFromPoint) {
            const pos = (document as any).caretPositionFromPoint(x, y);
            if (pos) {
                range = document.createRange();
                range.setStart(pos.offsetNode, pos.offset);
            }
        }

        let sentenceText = '';

        if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
            const node = range.startContainer;
            const offset = range.startOffset;
            const text = node.textContent || '';
            // Get a snippet of text around the current position
            const start = Math.max(0, offset - 20);
            const end = Math.min(text.length, offset + 50);
            sentenceText = text.substring(start, end).trim();
        }

        // Calculate Global Percentage based on scroll position
        let charsBeforeCurrentChapter = 0;
        for (let i = 0; i < currentChapterIndex; i++) {
            charsBeforeCurrentChapter += (chapterLengths[i] || 0);
        }

        let chapterProgress = 0;
        if (isVertical) {
            const maxScroll = container.scrollWidth - container.clientWidth;
            if (maxScroll > 0) {
                const scrollLeft = Math.abs(container.scrollLeft);
                chapterProgress = scrollLeft / maxScroll;
            }
        } else {
            const maxScroll = container.scrollHeight - container.clientHeight;
            if (maxScroll > 0) {
                chapterProgress = container.scrollTop / maxScroll;
            }
        }

        chapterProgress = Math.max(0, Math.min(1, chapterProgress));

        const currentCharsInChapter = Math.floor((chapterLengths[currentChapterIndex] || 0) * chapterProgress);

        const totalRead = charsBeforeCurrentChapter + currentCharsInChapter;
        const percent = totalLength > 0 ? (totalRead / totalLength) * 100 : 0;

        return {
            chapterIndex: currentChapterIndex,
            totalProgress: Math.min(100, Math.max(0, percent)),
            textOffset: currentCharsInChapter,
            sentenceText: sentenceText
        };

    }, [chapterLengths, currentChapterIndex, isVertical, totalLength]);

    // 3. Update Progress and Handle Timer
    const updateProgress = useCallback(() => {
        const pos = calculatePosition();
        if (!pos) return;

        setCurrentProgress(pos.totalProgress);

        // Unique signature for current position
        const currentSignature = `${currentChapterIndex}-${pos.sentenceText}`;

        if (currentSignature !== lastSavedPosition.current && pos.sentenceText) {
            // Reset timer
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

            lastSavedPosition.current = currentSignature;

            // Start 10s timer
            saveTimerRef.current = window.setTimeout(() => {
                if (onSaveProgress) {
                    onSaveProgress(pos);
                }
            }, 10000);
        } else if (!pos.sentenceText) {
          
        }
    }, [calculatePosition, currentChapterIndex, onSaveProgress]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    return {
        currentProgress,
        updateProgress
    };
}