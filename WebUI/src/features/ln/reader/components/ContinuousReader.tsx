import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Settings } from '@/Manatan/types';
import { ReaderNavigationUI } from './ReaderNavigationUI';
import { ChapterBlock } from './ChapterBlock';
import { useChapterLoader } from '../hooks/useChapterLoader';
import { useTextLookup } from '../hooks/useTextLookup';
import { buildContainerStyles } from '../utils/styles';
import { getReaderTheme } from '../utils/themes';
import { calculateProgress as calculateScrollProgress } from '../utils/navigation';
import { BlockTracker } from '../utils/blockTracker';
import {
    extractContextSnippet,
    calculateBlockLocalOffset,
    getCleanTextContent,
    getCleanCharCount,
} from '../utils/blockPosition';
import {
    SaveablePosition,
    calculateProgress,
    createSaveScheduler
} from '../utils/readerSave';
import { restoreReadingPosition } from '../utils/restoration';
import { ContinuousReaderProps } from '../types/reader';
import './ContinuousReader.css';

// ============================================================================
// Constants
// ============================================================================

const DRAG_THRESHOLD = 10;
const SAVE_DEBOUNCE_MS = 3000;
const SCROLL_DEBOUNCE_MS = 150;

// ============================================================================
// Component
// ============================================================================

export const ContinuousReader: React.FC<ContinuousReaderProps> = ({
    bookId,
    chapters,
    stats,
    settings,
    isVertical,
    isRTL,
    initialChapter = 0,
    initialProgress,
    onToggleUI,
    showNavigation = false,
    onPositionUpdate,
    onRegisterSave,
    onUpdateSettings,
    chapterFilenames = [],
}) => {
    // ========================================================================
    // Refs
    // ========================================================================

    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const blockTrackerRef = useRef<BlockTracker | null>(null);
    const lastReportedChapterRef = useRef(initialChapter);
    const hasRestoredRef = useRef(false);
    const scrollDebounceRef = useRef<number | null>(null);

    // Drag detection
    const isDraggingRef = useRef(false);
    const startPosRef = useRef({ x: 0, y: 0 });

    // Callback refs
    const onPositionUpdateRef = useRef(onPositionUpdate);
    const onRegisterSaveRef = useRef(onRegisterSave);
    const onToggleUIRef = useRef(onToggleUI);

    // Current block refs
    const currentBlockIdRef = useRef<string | null>(null);
    const currentBlockElementRef = useRef<Element | null>(null);

    // Save scheduler
    const [isSaved, setIsSaved] = useState(true);
    const saveSchedulerRef = useRef(
        createSaveScheduler({
            bookId,
            debounceMs: SAVE_DEBOUNCE_MS,
            autoSaveEnabled: settings.lnAutoBookmark ?? true,
            saveDelay: settings.lnBookmarkDelay ?? 0,
            onSaveStatusChange: setIsSaved,
        })
    );

    // ========================================================================
    // Update Callback Refs
    // ========================================================================

    useEffect(() => {
        onPositionUpdateRef.current = onPositionUpdate;
    }, [onPositionUpdate]);

    useEffect(() => {
        onRegisterSaveRef.current = onRegisterSave;
    }, [onRegisterSave]);

    useEffect(() => {
        onToggleUIRef.current = onToggleUI;
    }, [onToggleUI]);

    useEffect(() => {
        if (initialProgress?.blockId) {
            saveSchedulerRef.current.setInitialSavedPosition(initialProgress.blockId);
        }
    }, []);

    useEffect(() => {
        saveSchedulerRef.current.updateOptions({
            bookId,
            autoSaveEnabled: settings.lnAutoBookmark ?? true,
            saveDelay: settings.lnBookmarkDelay ?? 0,
        });
    }, [bookId, settings.lnAutoBookmark, settings.lnBookmarkDelay]);

    // ========================================================================
    // State
    // ========================================================================

    const [currentChapter, setCurrentChapter] = useState(initialChapter);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [contentLoaded, setContentLoaded] = useState(false);
    const [currentProgress, setCurrentProgress] = useState(initialProgress?.totalProgress || 0);
    const [currentPosition, setCurrentPosition] = useState<SaveablePosition | null>(null);
    const [restorationComplete, setRestorationComplete] = useState(!initialProgress?.blockId);

    // ========================================================================
    // Simple Derived Values
    // ========================================================================

    const theme = useMemo(
        () => getReaderTheme(settings.lnTheme),
        [settings.lnTheme]
    );

    const navOptions = useMemo(
        () => ({ isVertical, isRTL, isPaged: false }),
        [isVertical, isRTL]
    );

    const { tryLookup } = useTextLookup();

    const containerStyles = useMemo(
        () => buildContainerStyles(settings, isVertical, isRTL),
        [settings, isVertical, isRTL]
    );

    // ========================================================================
    // Chapter Loader
    // ========================================================================

    const { loadChaptersAround, getChapterHtml, loadingState } = useChapterLoader({
        chapters,
        preloadCount: 3,
    });

    useEffect(() => {
        loadChaptersAround(initialChapter);
    }, [initialChapter, loadChaptersAround]);

    useEffect(() => {
        const checkLoaded = () => {
            const loaded = chapters.some((_, i) => getChapterHtml(i) !== null);
            if (loaded && !contentLoaded) {
                setContentLoaded(true);
            }
        };

        checkLoaded();
        const timer = setInterval(checkLoaded, 100);
        return () => clearInterval(timer);
    }, [chapters, getChapterHtml, contentLoaded]);

    // ========================================================================
    // Register Save Function
    // ========================================================================

    useEffect(() => {
        onRegisterSaveRef.current?.(saveSchedulerRef.current.saveNow);
    }, []);

    // ========================================================================
    // Position Calculation from Block
    // ========================================================================

    const calculatePositionFromBlock = useCallback((
        blockId: string,
        blockElement: Element
    ): SaveablePosition | null => {
        if (!containerRef.current || !stats) return null;

        const container = containerRef.current;

        // Calculate block local offset
        const blockLocalOffset = calculateBlockLocalOffset(
            blockElement,
            container,
            isVertical
        );

        // Extract context
        const contextSnippet = extractContextSnippet(blockElement, blockLocalOffset, 20);

        // Get chapter index from block ID
        const chapterMatch = blockId.match(/ch(\d+)-/);
        const chapterIndex = chapterMatch ? parseInt(chapterMatch[1], 10) : currentChapter;

        // Calculate chapter character offset
        let chapterCharOffset = blockLocalOffset;
        const blockOrder = parseInt(blockId.split('-b')[1] || '0', 10);

        for (let i = 0; i < blockOrder; i++) {
            const prevBlock = container.querySelector(
                `[data-block-id="ch${chapterIndex}-b${i}"]`
            );
            if (prevBlock) {
                const text = getCleanTextContent(prevBlock);
                chapterCharOffset += getCleanCharCount(text);
            }
        }

        // Calculate progress
        const progressCalc = calculateProgress(chapterIndex, chapterCharOffset, stats);

        return {
            blockId,
            blockLocalOffset,
            contextSnippet,
            chapterIndex,
            chapterCharOffset,
            totalCharsRead: progressCalc.totalCharsRead,
            chapterProgress: progressCalc.chapterProgress,
            totalProgress: progressCalc.totalProgress,
            sentenceText: contextSnippet,
        };
    }, [stats, isVertical, currentChapter]);

    // ========================================================================
    // Block Tracker Callback
    // ========================================================================

    const handleActiveBlockChange = useCallback((blockId: string, element: Element) => {
        // Skip if this is the same block as the restored position (no actual user movement)
        if (currentBlockIdRef.current === blockId) {
            return;
        }
        
        currentBlockIdRef.current = blockId;
        currentBlockElementRef.current = element;

        const position = calculatePositionFromBlock(blockId, element);
        if (!position) return;

        setCurrentProgress(position.totalProgress);
        setCurrentPosition(position);
        saveSchedulerRef.current.scheduleSave(position);

        // Update chapter if changed
        const chapterMatch = blockId.match(/ch(\d+)-/);
        if (chapterMatch) {
            const chapterIndex = parseInt(chapterMatch[1], 10);
            if (chapterIndex !== currentChapter) {
                setCurrentChapter(chapterIndex);
                loadChaptersAround(chapterIndex);
            }
        }

        // Notify parent
        onPositionUpdateRef.current?.({
            chapterIndex: position.chapterIndex,
            chapterCharOffset: position.chapterCharOffset,
            sentenceText: position.sentenceText || '',
            totalProgress: position.totalProgress,
            blockId: position.blockId,
        });
    }, [calculatePositionFromBlock, currentChapter, loadChaptersAround]);

    // ========================================================================
    // Block Tracker Setup
    // ========================================================================

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !contentLoaded || !stats) return;
        
        // Don't start tracking until restoration is complete
        // This prevents saving wrong position during initialization
        if (!restorationComplete) {
            console.log('[BlockTracker] Waiting for restoration before starting...');
            return;
        }

        console.log('[BlockTracker] Starting tracking after restoration complete');

        // Clean up previous tracker
        blockTrackerRef.current?.stop();

        // Create new tracker
        blockTrackerRef.current = new BlockTracker(container, {
            isVertical,
            isPaged: false,
            onActiveBlockChange: handleActiveBlockChange,
        });

        blockTrackerRef.current.start();

        return () => {
            blockTrackerRef.current?.stop();
            blockTrackerRef.current = null;
        };
    }, [contentLoaded, stats, isVertical, handleActiveBlockChange, restorationComplete]);

    // ========================================================================
    // Scroll Handler
    // ========================================================================

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            // Calculate scroll progress
            const progress = calculateScrollProgress(container, navOptions);
            setScrollProgress(progress);

            // Debounce heavy operations
            if (scrollDebounceRef.current) {
                clearTimeout(scrollDebounceRef.current);
            }

            scrollDebounceRef.current = window.setTimeout(() => {
                // BlockTracker handles position updates
                blockTrackerRef.current?.refresh();
            }, SCROLL_DEBOUNCE_MS);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            container.removeEventListener('scroll', handleScroll);
            if (scrollDebounceRef.current) {
                clearTimeout(scrollDebounceRef.current);
            }
        };
    }, [navOptions]);

    // ========================================================================
    // Position Restoration
    // ========================================================================

    useEffect(() => {
        if (!contentLoaded || hasRestoredRef.current || !initialProgress) return;
        if (!containerRef.current) return;

        const container = containerRef.current;

        // Wait for content to render
        setTimeout(() => {
            if (hasRestoredRef.current) return;

            const result = restoreReadingPosition(
                container,
                {
                    chapterIndex: initialProgress.chapterIndex ?? 0,
                    blockId: initialProgress.blockId,
                    blockLocalOffset: initialProgress.blockLocalOffset,
                    contextSnippet: initialProgress.contextSnippet,
                    chapterCharOffset: initialProgress.chapterCharOffset,
                    sentenceText: initialProgress.sentenceText,
                },
                isVertical,
                isRTL
            );

            hasRestoredRef.current = true;
            
            // Initialize current block to restored position
            // This prevents BlockTracker from immediately saving a different block
            if (result.blockId) {
                currentBlockIdRef.current = result.blockId;
            }
            
            console.log('[ContinuousReader] Position restored:', result);
            
            // Wait for scroll to settle before starting BlockTracker
            // This prevents BlockTracker from detecting the wrong block immediately
            setTimeout(() => {
                console.log('[ContinuousReader] Scroll settled, enabling BlockTracker');
                setRestorationComplete(true);
            }, 500);
        }, 300);
    }, [contentLoaded, initialProgress, isVertical, isRTL]);

    // ========================================================================
    // Touch/Click Handlers
    // ========================================================================

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        isDraggingRef.current = false;
        startPosRef.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDraggingRef.current) {
            const dx = Math.abs(e.clientX - startPosRef.current.x);
            const dy = Math.abs(e.clientY - startPosRef.current.y);
            if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
                isDraggingRef.current = true;
            }
        }
    }, []);

    const handleContentClick = useCallback(async (e: React.MouseEvent) => {
        if (isDraggingRef.current) return;

        const target = e.target as HTMLElement;

        // Handle links
        const link = target.closest('a');
        if (link) {
            const href = link.getAttribute('href');

            if (href?.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } else if (href?.startsWith('http')) {
                e.preventDefault();
                window.open(href, '_blank', 'noopener,noreferrer');
            } else if (href?.includes('.html') || href?.includes('.xhtml')) {
                e.preventDefault();
                const linkEvent = new CustomEvent('epub-link-clicked', {
                    detail: { href },
                    bubbles: true
                });
                e.currentTarget.dispatchEvent(linkEvent);
            }
            return;
        }

        // Ignore UI elements
        if (target.closest('button, img, ruby rt, .nav-btn, .reader-progress-bar, .dict-popup')) {
            return;
        }

        // Try text lookup
        const lookupSuccess = await tryLookup(e);
        if (!lookupSuccess) {
            onToggleUIRef.current?.();
        }
    }, [tryLookup]);

    // ========================================================================
    // Navigation
    // ========================================================================

    const scrollSmall = useCallback((forward: boolean) => {
        const container = containerRef.current;
        if (!container) return;

        const amount = 200;
        const behavior = settings.lnDisableAnimations ? 'auto' : 'smooth';

        if (isVertical) {
            const delta = forward ? (isRTL ? -amount : amount) : (isRTL ? amount : -amount);
            container.scrollBy({ left: delta, behavior });
        } else {
            container.scrollBy({ top: forward ? amount : -amount, behavior });
        }
    }, [isVertical, isRTL, settings.lnDisableAnimations]);

    // ========================================================================
    // EPUB Link Handler
    // ========================================================================

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleEpubLink = (event: Event) => {
            const customEvent = event as CustomEvent<{ href: string }>;
            const href = customEvent.detail.href;
            const [filename, anchor] = href.split('#');

            let chapterIndex = chapterFilenames.indexOf(filename);

            if (chapterIndex === -1) {
                chapterIndex = chapterFilenames.findIndex(fn =>
                    fn.endsWith(filename) || fn.endsWith('/' + filename)
                );
            }

            if (chapterIndex === -1) {
                const targetBasename = filename.split('/').pop() || filename;
                chapterIndex = chapterFilenames.findIndex(fn => {
                    const storedBasename = fn.split('/').pop() || fn;
                    return storedBasename === targetBasename;
                });
            }

            if (chapterIndex !== -1) {
                const chapterElement = container.querySelector(`[data-chapter="${chapterIndex}"]`);

                if (chapterElement) {
                    if (anchor) {
                        const anchorElement = chapterElement.querySelector(`#${CSS.escape(anchor)}`);
                        if (anchorElement) {
                            anchorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else {
                            chapterElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    } else {
                        chapterElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            }
        };

        container.addEventListener('epub-link-clicked', handleEpubLink);
        return () => container.removeEventListener('epub-link-clicked', handleEpubLink);
    }, [chapterFilenames]);

    // ========================================================================
    // Wheel Handler (Vertical Mode)
    // ========================================================================

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !isVertical) return;

        const lineHeightPx = (settings.lnFontSize || 18) * (settings.lnLineHeight || 1.8);

        const handleWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                let delta = e.deltaY;

                if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
                    delta *= lineHeightPx;
                } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
                    delta *= container.clientWidth;
                }

                container.scrollLeft += isRTL ? -delta : delta;
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [isVertical, isRTL, settings.lnFontSize, settings.lnLineHeight]);

    const handleSaveNow = useCallback(async (): Promise<boolean> => {
        return await saveSchedulerRef.current.saveNow();
    }, []);

    // ========================================================================
    // Visibility Change Handler
    // ========================================================================

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                saveSchedulerRef.current.saveNow();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // ========================================================================
    // Cleanup
    // ========================================================================

    useEffect(() => {
        return () => {
            if (scrollDebounceRef.current) {
                clearTimeout(scrollDebounceRef.current);
            }
            blockTrackerRef.current?.stop();
            saveSchedulerRef.current.saveNow();
        };
    }, []);

    // ========================================================================
    // Render
    // ========================================================================

    // Memoized wrapper style to prevent re-renders on UI toggle
    const wrapperStyle = useMemo(() => ({
        backgroundColor: theme.bg,
        color: theme.fg,
        direction: isRTL ? 'rtl' : 'ltr',
    }), [theme.bg, theme.fg, isRTL]);

    // Memoized content style to prevent re-renders on UI toggle
    const contentStyle = useMemo(() => ({
        writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
        textOrientation: isVertical ? 'mixed' : undefined,
        direction: 'ltr',
    }), [isVertical]);

    const handleUpdateSettings = onUpdateSettings ?? (() => {});

    return (
        <div
    className={`continuous-reader-wrapper ${isRTL ? 'rtl-mode' : 'ltr-mode'}`}
    style={wrapperStyle}
    data-dark-mode={settings.lnTheme === 'dark' || settings.lnTheme === 'black'}
>
            <div
                ref={containerRef}
                className={`continuous-reader-container ${isVertical ? 'vertical' : 'horizontal'}`}
                style={containerStyles}
                onClick={handleContentClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
            >
                <div
                    ref={contentRef}
                    className={`continuous-content ${isVertical ? 'vertical' : 'horizontal'} ${!settings.lnEnableFurigana ? 'furigana-hidden' : ''}`}
                    style={contentStyle}
                >
                    {chapters.map((_, index) => (
                        <ChapterBlock
                            key={index}
                            html={getChapterHtml(index)}
                            index={index}
                            isLoading={loadingState.get(index) || false}
                            isVertical={isVertical}
                            settings={settings}
                        />
                    ))}
                </div>
            </div>

            <ReaderNavigationUI
                visible={showNavigation}
                onNext={() => scrollSmall(true)}
                onPrev={() => scrollSmall(false)}
                canGoNext={scrollProgress < 100}
                canGoPrev={scrollProgress > 0}
                currentPage={0}
                totalPages={1}
                currentChapter={currentChapter}
                totalChapters={chapters.length}
                progress={scrollProgress}
                totalBookProgress={currentProgress}
                theme={theme}
                isVertical={isVertical}
                mode="continuous"
                currentPosition={currentPosition ?? undefined}
                bookStats={stats ?? undefined}
                settings={settings}
                onUpdateSettings={onUpdateSettings}
                isSaved={isSaved}
                onSaveNow={handleSaveNow}
            />
        </div>
    );
};