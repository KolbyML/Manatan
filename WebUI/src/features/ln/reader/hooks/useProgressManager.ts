

import { useRef, useCallback, useEffect, useState } from 'react';
import { AppStorage, BookStats } from '@/lib/storage/AppStorage';
import { ReadingPosition } from '../types/progress';
import {
    buildReadingPosition,
    restoreReadingPosition,
    calculateScrollProgress,
    calculateTotalProgress,
    getTextAtReadingPosition,
    extractSentenceContext,
    calculateChapterCharOffset,
} from '../utils/progressUtils';

interface UseProgressManagerProps {
    bookId: string;
    chapters: string[];
    stats: BookStats | null;
    containerRef: React.RefObject<HTMLElement>;
    isVertical: boolean;
    isRTL: boolean;
    isPaged: boolean;
    currentChapter: number;
    currentPage?: number;
    totalPages?: number;
    initialProgress?: {
        sentenceText?: string;
        chapterIndex?: number;
        pageIndex?: number;
        chapterCharOffset?: number;
        totalProgress?: number;
    };
    onRestoreComplete?: () => void;
}

interface UseProgressManagerReturn {
    isReady: boolean;
    currentProgress: number;
    currentPosition: ReadingPosition | null;
    reportScroll: () => void;
    reportChapterChange: (chapter: number, page?: number) => void;
    reportPageChange: (page: number, total?: number) => void;
    saveNow: () => Promise<void>;
    restorePosition: () => boolean;
}

const SAVE_DEBOUNCE_MS = 3000;
const READY_DELAY_MS = 500;
const READY_DELAY_CONTINUOUS_MS = 200;

export function useProgressManager({
    bookId,
    chapters,
    stats,
    containerRef,
    isVertical,
    isRTL,
    isPaged,
    currentChapter,
    currentPage,
    totalPages,
    initialProgress,
    onRestoreComplete,
}: UseProgressManagerProps): UseProgressManagerReturn {
    const [isReady, setIsReady] = useState(false);
    const [currentPosition, setCurrentPosition] = useState<ReadingPosition | null>(null);

    const saveTimerRef = useRef<number | null>(null);
    const lastSavedSignatureRef = useRef<string>('');
    const pendingPositionRef = useRef<ReadingPosition | null>(null);
    const hasRestoredRef = useRef(false);
    const readyTimerRef = useRef<number | null>(null);
    const restoreAttemptRef = useRef(0);

    const chapterRef = useRef(currentChapter);
    const pageRef = useRef(currentPage);
    const totalPagesRef = useRef(totalPages);


    useEffect(() => {
        chapterRef.current = currentChapter;
        pageRef.current = currentPage;
        totalPagesRef.current = totalPages;
    }, [currentChapter, currentPage, totalPages]);


    useEffect(() => {
        if (!stats || chapters.length === 0) {
            setIsReady(false);
            return;
        }


        if (isPaged) {
            setIsReady(true);
            return;
        }

        if (readyTimerRef.current) {
            clearTimeout(readyTimerRef.current);
        }

        readyTimerRef.current = window.setTimeout(() => {
            setIsReady(true);
            readyTimerRef.current = null;
        }, 200);

        return () => {
            if (readyTimerRef.current) {
                clearTimeout(readyTimerRef.current);
            }
        };
    }, [stats, chapters.length, isPaged]);



    const savePosition = useCallback(
        async (position: ReadingPosition) => {
            if (!bookId || !position.sentenceText) return;

            const signature = `${position.chapterIndex}-${position.chapterCharOffset}-${position.sentenceText.substring(0, 20)}`;
            if (signature === lastSavedSignatureRef.current) return;

            try {
                await AppStorage.saveLnProgress(bookId, {
                    chapterIndex: position.chapterIndex,
                    pageNumber: position.pageIndex,
                    chapterCharOffset: position.chapterCharOffset,
                    totalCharsRead: position.totalCharsRead,
                    sentenceText: position.sentenceText,
                    chapterProgress: position.chapterProgress,
                    totalProgress: position.totalProgress,
                });

                lastSavedSignatureRef.current = signature;

                console.log('[Progress] Saved:', {
                    chapter: position.chapterIndex,
                    charOffset: position.chapterCharOffset,
                    progress: `${position.totalProgress.toFixed(1)}%`,
                    sentence: position.sentenceText.substring(0, 30) + '...',
                });
            } catch (err) {
                console.error('[Progress] Save failed:', err);
            }
        },
        [bookId]
    );


    const scheduleSave = useCallback(
        (position: ReadingPosition) => {
            pendingPositionRef.current = position;

            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            saveTimerRef.current = window.setTimeout(() => {
                const pending = pendingPositionRef.current;
                if (pending) {
                    savePosition(pending);
                }
                saveTimerRef.current = null;
            }, SAVE_DEBOUNCE_MS);
        },
        [savePosition]
    );


    const updatePosition = useCallback(() => {
        const container = containerRef.current;
        if (!container || !stats || !isReady) return null;

        let chapterProgress: number;

        if (isPaged && totalPagesRef.current && totalPagesRef.current > 1) {
            const page = pageRef.current ?? 0;
            chapterProgress = ((page + 1) / totalPagesRef.current) * 100;
        } else {
            chapterProgress = calculateScrollProgress(container, isVertical, isRTL);
        }

        const { totalCharsRead, totalProgress } = calculateTotalProgress(
            chapterRef.current,
            chapterProgress,
            stats
        );

        let sentenceText = '';
        let chapterCharOffset = 0;

        // In paged mode, calculate chapterCharOffset from chapterProgress
        if (isPaged) {
            const currentChapterLength = stats.chapterLengths[chapterRef.current] || 0;
            chapterCharOffset = Math.floor(currentChapterLength * (chapterProgress / 100));
        }

        const textPos = getTextAtReadingPosition(container, isVertical);
        if (textPos) {
            sentenceText = extractSentenceContext(textPos.node, textPos.offset);

            // Only recalculate chapterCharOffset from DOM in continuous mode
            if (!isPaged) {
                let chapterEl: Element | null = container.querySelector(
                    `[data-chapter="${chapterRef.current}"]`
                );
                if (!chapterEl) {
                    chapterEl = container.querySelector('.paged-content') || container;
                }

                if (chapterEl) {
                    chapterCharOffset = calculateChapterCharOffset(
                        chapterEl,
                        textPos.node,
                        textPos.offset
                    );
                }
            }
        }

        if (!sentenceText && totalProgress === 0) {
            return null;
        }

        const position: ReadingPosition = {
            chapterIndex: chapterRef.current,
            pageIndex: pageRef.current,
            chapterCharOffset,
            totalCharsRead,
            sentenceText,
            chapterProgress,
            totalProgress,
            timestamp: Date.now(),
        };

        setCurrentPosition(position);
        pendingPositionRef.current = position;

        return position;
    }, [containerRef, stats, isVertical, isRTL, isPaged, isReady]);


    const reportScroll = useCallback(() => {
        if (!isReady) return;

        const position = updatePosition();
        if (position) {
            setCurrentPosition(position);
            scheduleSave(position);
        }
    }, [isReady, updatePosition, scheduleSave]);


    const reportChapterChange = useCallback(
        (chapter: number, page?: number) => {
            const previousChapter = chapterRef.current;
            chapterRef.current = chapter;
            pageRef.current = page ?? 0;

            const position = updatePosition();
            if (position) {
                setCurrentPosition(position);

                if (saveTimerRef.current) {
                    clearTimeout(saveTimerRef.current);
                    saveTimerRef.current = null;
                }

                if (chapter !== previousChapter) {
                    savePosition(position);
                } else {
                    scheduleSave(position);
                }
            }
        },
        [updatePosition, savePosition, scheduleSave]
    );


    const reportPageChange = useCallback(
        (page: number, total?: number) => {
            pageRef.current = page;
            if (total !== undefined) {
                totalPagesRef.current = total;
            }

            const position = updatePosition();
            if (position) {
                setCurrentPosition(position);
                scheduleSave(position);
            }
        },
        [updatePosition, scheduleSave]
    );


    const saveNow = useCallback(async () => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }

        const position = pendingPositionRef.current || updatePosition();
        if (position) {
            await savePosition(position);
        }
    }, [updatePosition, savePosition]);


    const restorePosition = useCallback((): boolean => {
        if (hasRestoredRef.current) return true;

        const container = containerRef.current;
        if (!container || !initialProgress) {
            return false;
        }

        const {
            sentenceText,
            chapterIndex = 0,
            chapterCharOffset = 0
        } = initialProgress;

        console.log('[restorePosition] Attempting:', {
            chapterIndex,
            chapterCharOffset,
            sentenceText: sentenceText?.substring(0, 30) + '...',
            isVertical,
            isPaged,
            attempt: restoreAttemptRef.current,
        });

        const success = restoreReadingPosition(
            container,
            chapterIndex,
            chapterCharOffset,
            sentenceText || '',
            isVertical,
            isRTL
        );

        if (success) {
            hasRestoredRef.current = true;
            onRestoreComplete?.();
            console.log('[restorePosition] Success');
            return true;
        }


        restoreAttemptRef.current++;

        if (restoreAttemptRef.current >= 5) {
            hasRestoredRef.current = true;
            onRestoreComplete?.();
            console.log('[restorePosition] Max attempts reached');
        }

        return false;
    }, [containerRef, initialProgress, isVertical, isRTL, isPaged, onRestoreComplete]);


    useEffect(() => {
        if (!isReady || !initialProgress || hasRestoredRef.current) return;

        const attemptRestore = () => {
            if (hasRestoredRef.current) return;

            const success = restorePosition();

            if (!success && restoreAttemptRef.current < 5) {

                setTimeout(attemptRestore, 100 * (restoreAttemptRef.current + 1));
            }
        };



        const timer = setTimeout(attemptRestore, 150);

        return () => clearTimeout(timer);
    }, [isReady, initialProgress, restorePosition]);


    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                saveNow();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [saveNow]);


    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            const position = pendingPositionRef.current;
            if (position && bookId) {
                AppStorage.saveLnProgress(bookId, {
                    chapterIndex: position.chapterIndex,
                    pageNumber: position.pageIndex,
                    chapterCharOffset: position.chapterCharOffset,
                    totalCharsRead: position.totalCharsRead,
                    sentenceText: position.sentenceText,
                    chapterProgress: position.chapterProgress,
                    totalProgress: position.totalProgress,
                });
            }
        };
    }, [bookId]);


    useEffect(() => {
        const handleBeforeUnload = () => {
            const position = pendingPositionRef.current;
            if (position && bookId) {
                AppStorage.saveLnProgress(bookId, {
                    chapterIndex: position.chapterIndex,
                    pageNumber: position.pageIndex,
                    chapterCharOffset: position.chapterCharOffset,
                    totalCharsRead: position.totalCharsRead,
                    sentenceText: position.sentenceText,
                    chapterProgress: position.chapterProgress,
                    totalProgress: position.totalProgress,
                });
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [bookId]);


    return {
        isReady,
        currentProgress: currentPosition?.totalProgress ?? 0,
        currentPosition,
        reportScroll,
        reportChapterChange,
        reportPageChange,
        saveNow,
        restorePosition,
    };
}