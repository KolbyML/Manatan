import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Settings } from '@/Manatan/types';
import { ReaderNavigationUI } from './ReaderNavigationUI';
import { ChapterBlock } from './ChapterBlock';
import { ReaderContextMenu } from './ReaderContextMenu';
import { SelectionHandles } from './SelectionHandles';
import { useChapterLoader } from '../hooks/useChapterLoader';
import { useTextLookup } from '../hooks/useTextLookup';
import { buildContainerStyles } from '../utils/styles';
import { getReaderTheme } from '../utils/themes';
import { calculateProgress as calculateScrollProgress } from '../utils/navigation';
import { BlockTracker } from '../utils/blockTracker';
import {
    extractContextSnippet,
    calculateBlockLocalOffset,
    calculatePreciseBlockOffset,
    getCleanTextContent,
    getCleanCharCount,
} from '../utils/blockPosition';
import { createChapterBlockLookup, calculateCharOffsetFromBlock } from '../utils/blockMap';
import {
    SaveablePosition,
    calculateProgress,
    createSaveScheduler
} from '../utils/readerSave';
import { restoreReadingPosition, applyLocalOffset } from '../utils/restoration';
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
    safeAreaTopInset,
    onPositionUpdate,
    onRegisterSave,
    onUpdateSettings,
    chapterFilenames = [],
    highlights = [],
    onAddHighlight,
    onRemoveHighlight,
    navigationRef,
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
    
    // Save lock to prevent saving immediately after restoration (3 seconds)
    const saveLockUntilRef = useRef<number>(0);
    const SAVE_LOCK_DURATION_MS = 3000;

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

    // Reset restoration when initialProgress changes (for search/highlight navigation)
    const lastInitialProgressRef = useRef(initialProgress);
    useEffect(() => {
        const lastProgress = lastInitialProgressRef.current;
        const progressChanged = 
            (lastProgress?.blockId !== initialProgress?.blockId) ||
            (lastProgress?.chapterIndex !== initialProgress?.chapterIndex);
        
        if (progressChanged && initialProgress?.blockId && hasRestoredRef.current) {
            console.log('[ContinuousReader] InitialProgress changed, resetting restoration');
            hasRestoredRef.current = false;
            setRestorationComplete(false);
        }
        
        lastInitialProgressRef.current = initialProgress;
    }, [initialProgress?.blockId, initialProgress?.chapterIndex, initialProgress?.chapterCharOffset]);

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

        // Try precise caret-based offset first (more accurate)
        let blockLocalOffset = calculatePreciseBlockOffset(
            blockElement,
            container,
            isVertical
        );

        // If precise fails (returns 0 when there should be content), fall back to ratio-based
        const textContent = getCleanTextContent(blockElement);
        if (blockLocalOffset === 0 && textContent.length > 0) {
            blockLocalOffset = calculateBlockLocalOffset(
                blockElement,
                container,
                isVertical
            );
        }

        // Extract context
        const contextSnippet = extractContextSnippet(blockElement, blockLocalOffset, 20);

        // Get chapter index from block ID
        const chapterMatch = blockId.match(/ch(\d+)-/);
        const chapterIndex = chapterMatch ? parseInt(chapterMatch[1], 10) : currentChapter;

        // Calculate chapter character offset using blockMaps (precise!)
        let chapterCharOffset: number;
        
        if (stats.blockMaps && stats.blockMaps.length > 0) {
            const chapterLookup = createChapterBlockLookup(stats.blockMaps, chapterIndex);
            chapterCharOffset = calculateCharOffsetFromBlock(chapterLookup, blockId, blockLocalOffset);
        } else {
            // Fallback: count from DOM if no blockMaps
            chapterCharOffset = blockLocalOffset;
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
        }

        // Calculate progress
        const progressCalc = calculateProgress(chapterIndex, chapterCharOffset, stats);

        console.log('[ContinuousReader] Saving position:', {
            blockId,
            blockLocalOffset,
            chapterCharOffset,
            chapterIndex,
            hasBlockMaps: !!(stats.blockMaps && stats.blockMaps.length > 0),
        });

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
        // Skip if save is locked (after restoration)
        if (Date.now() < saveLockUntilRef.current) {
            console.log('[ContinuousReader] Save locked, skipping block change');
            return;
        }
        
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
        const targetChapter = initialProgress.chapterIndex ?? 0;

        // Wait for target chapter's content to be rendered before restoration
        const tryRestore = async () => {
            const maxWaitMs = 10000; // 10 seconds for weak devices
            const checkIntervalMs = 200;

            // Wait for target chapter's blocks to be in DOM
            for (let elapsed = 0; elapsed < maxWaitMs; elapsed += checkIntervalMs) {
                const blocks = container.querySelectorAll(`[data-block-id^="ch${targetChapter}-b"]`);
                if (blocks.length > 0) {
                    console.log('[ContinuousReader] Chapter content loaded after', elapsed, 'ms');
                    break;
                }
                await new Promise(r => setTimeout(r, checkIntervalMs));
            }

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
                {
                    isVertical,
                    isRTL,
                    blockMaps: stats?.blockMaps,
                }
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
                // Set save lock for 3 seconds to prevent overwriting restored position
                saveLockUntilRef.current = Date.now() + SAVE_LOCK_DURATION_MS;
                setRestorationComplete(true);
            }, 500);
        };

        tryRestore();
    }, [contentLoaded, initialProgress, isVertical, isRTL, stats?.blockMaps]);

    // ========================================================================
    // Direct Navigation (for TOC/search - bypasses restoration)
    // ========================================================================

    const scrollToBlock = useCallback((blockId: string, blockLocalOffset?: number) => {
        const container = containerRef.current;
        if (!container) return;

        // Extract chapter index from blockId
        const chapterMatch = blockId.match(/ch(\d+)-/);
        const chapterIndex = chapterMatch ? parseInt(chapterMatch[1], 10) : 0;

        console.log('[ContinuousReader] scrollToBlock:', blockId, 'chapter:', chapterIndex);

        // Function to actually scroll to the block
        const doScroll = () => {
            const block = container.querySelector(`[data-block-id="${blockId}"]`);
            if (!block) {
                console.log('[ContinuousReader] scrollToBlock: block not found:', blockId);
                return false;
            }

            // Disable restoration temporarily so we don't trigger it
            hasRestoredRef.current = true;

            // Scroll to block
            block.scrollIntoView({ behavior: 'auto', block: 'start' });

            // Apply local offset if provided
            if (blockLocalOffset && blockLocalOffset > 0) {
                setTimeout(() => {
                    applyLocalOffset(block as Element, container, blockLocalOffset, isVertical, isRTL);
                }, 50);
            }

            // Update current block tracking
            currentBlockIdRef.current = blockId;

            // Update chapter if changed
            if (chapterIndex !== currentChapter) {
                setCurrentChapter(chapterIndex);
            }

            // Mark restoration complete
            setRestorationComplete(true);

            // Set save lock to prevent overwriting
            saveLockUntilRef.current = Date.now() + SAVE_LOCK_DURATION_MS;

            return true;
        };

        // Check if chapter is already loaded (has blocks in DOM)
        const existingBlocks = container.querySelectorAll(`[data-block-id^="ch${chapterIndex}-b"]`);
        
        if (existingBlocks.length > 0) {
            // Chapter already loaded, try to scroll immediately
            doScroll();
        } else {
            // Chapter not loaded yet, load it first
            console.log('[ContinuousReader] scrollToBlock: loading chapter:', chapterIndex);
            loadChaptersAround(chapterIndex);
            
            // Wait for chapter to load and render
            const maxAttempts = 10;
            let attempts = 0;
            
            const tryScroll = () => {
                attempts++;
                const blocks = container.querySelectorAll(`[data-block-id^="ch${chapterIndex}-b"]`);
                
                if (blocks.length > 0) {
                    console.log('[ContinuousReader] scrollToBlock: chapter loaded after', attempts * 100, 'ms');
                    doScroll();
                } else if (attempts < maxAttempts) {
                    console.log('[ContinuousReader] scrollToBlock: retrying, attempt:', attempts);
                    setTimeout(tryScroll, 100);
                } else {
                    console.log('[ContinuousReader] scrollToBlock: failed to load chapter after', maxAttempts * 100, 'ms');
                }
            };
            
            setTimeout(tryScroll, 100);
        }
    }, [isVertical, isRTL, currentChapter, loadChaptersAround]);

    const scrollToChapter = useCallback((chapterIndex: number) => {
        const container = containerRef.current;
        if (!container) return;

        console.log('[ContinuousReader] scrollToChapter:', chapterIndex);

        // Function to do the actual scrolling
        const doScroll = (): boolean => {
            const blocks = container.querySelectorAll(`[data-block-id^="ch${chapterIndex}-b"]`);
            if (blocks.length === 0) {
                return false;
            }

            // Disable restoration temporarily
            hasRestoredRef.current = true;

            // Scroll to first block
            (blocks[0] as HTMLElement).scrollIntoView({ behavior: 'auto', block: 'start' });

            // Update state
            setCurrentChapter(chapterIndex);
            currentBlockIdRef.current = blocks[0].getAttribute('data-block-id');

            // Mark restoration complete
            setRestorationComplete(true);

            // Set save lock
            saveLockUntilRef.current = Date.now() + SAVE_LOCK_DURATION_MS;

            return true;
        };

        // Check if chapter is already loaded
        const existingBlocks = container.querySelectorAll(`[data-block-id^="ch${chapterIndex}-b"]`);
        
        if (existingBlocks.length > 0) {
            doScroll();
        } else {
            // Chapter not loaded, load it first
            console.log('[ContinuousReader] scrollToChapter: loading chapter:', chapterIndex);
            loadChaptersAround(chapterIndex);
            
            // Wait for chapter to load with retry logic
            const maxAttempts = 10;
            let attempts = 0;
            
            const tryScroll = () => {
                attempts++;
                if (doScroll()) {
                    console.log('[ContinuousReader] scrollToChapter: chapter loaded after', attempts * 100, 'ms');
                } else if (attempts < maxAttempts) {
                    console.log('[ContinuousReader] scrollToChapter: retrying, attempt:', attempts);
                    setTimeout(tryScroll, 100);
                } else {
                    console.log('[ContinuousReader] scrollToChapter: failed to load chapter after', maxAttempts * 100, 'ms');
                }
            };
            
            setTimeout(tryScroll, 100);
        }
    }, [loadChaptersAround]);

    // Expose navigation functions via ref
    useEffect(() => {
        if (navigationRef?.current) {
            navigationRef.current = {
                scrollToBlock,
                scrollToChapter,
            };
        }
    }, [scrollToBlock, scrollToChapter, navigationRef]);

    // ========================================================================
    // Touch/Click Handlers
    // ========================================================================

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        isDraggingRef.current = false;
        startPosRef.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        const threshold = settings.lnDragThreshold ?? 10;
        if (!isDraggingRef.current) {
            const dx = Math.abs(e.clientX - startPosRef.current.x);
            const dy = Math.abs(e.clientY - startPosRef.current.y);
            if (dx > threshold || dy > threshold) {
                isDraggingRef.current = true;
            }
        }
    }, [settings.lnDragThreshold]);

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

    // Helper to adjust brightness
    const adjustBrightness = (hexColor: string, brightness: number): string => {
        if (hexColor.startsWith('rgba')) {
            const match = hexColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
                const [, r, g, b] = match;
                const factor = brightness / 100;
                return `rgba(${Math.round(Number(r) * factor)}, ${Math.round(Number(g) * factor)}, ${Math.round(Number(b) * factor)})`;
            }
            return hexColor;
        }
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const factor = brightness / 100;
        return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
    };

    // Memoized wrapper style to prevent re-renders on UI toggle
    const wrapperStyle = useMemo(() => {
        const brightness = settings.lnTextBrightness ?? 100;
        const textColor = brightness === 100 
            ? theme.fg 
            : adjustBrightness(theme.fg, brightness);
        
        return {
            backgroundColor: theme.bg,
            color: textColor,
            direction: isRTL ? 'rtl' : 'ltr',
        };
    }, [theme.bg, theme.fg, isRTL, settings.lnTextBrightness]);

    // Memoized content style to prevent re-renders on UI toggle
    const contentStyle = useMemo(() => {
        let fontFamily = settings.lnFontFamily || "'Noto Serif JP', serif";
        if (settings.lnSecondaryFontFamily) {
            fontFamily = `${fontFamily}, ${settings.lnSecondaryFontFamily}`;
        }
        
        return {
            writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
            textOrientation: isVertical ? 'mixed' : undefined,
            direction: 'ltr',
            fontFamily,
            fontWeight: settings.lnFontWeight || 400,
        };
    }, [isVertical, settings.lnFontFamily, settings.lnSecondaryFontFamily, settings.lnFontWeight]);

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
                style={{
                    ...containerStyles,
                    paddingTop: safeAreaTopInset ?? 'env(safe-area-inset-top)',
                    boxSizing: 'border-box',
                }}
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

            <SelectionHandles 
                containerRef={contentRef}
                enabled={contentReady}
                theme={(settings.lnTheme as 'light' | 'sepia' | 'dark' | 'black') || 'dark'}
                onSelectionComplete={(text, startOffset, endOffset, blockId) => {
                    if (onAddHighlight && currentChapter && blockId) {
                        onAddHighlight(currentChapter, blockId, text, startOffset, endOffset);
                    }
                }}
            />
        </div>
    );
};
