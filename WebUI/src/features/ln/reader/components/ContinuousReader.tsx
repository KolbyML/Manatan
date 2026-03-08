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

const SAVE_DEBOUNCE_MS = 3000;
const SCROLL_DEBOUNCE_MS = 150;
const SAVE_LOCK_DURATION_MS = 3000;

// ============================================================================
// Restoration State Machine
// ============================================================================

type RestorationState = 
    | 'LOADING_TARGET'    // Loading the target chapter
    | 'WAITING_FOR_DOM'   // Waiting for target chapter to appear in DOM
    | 'RESTORING'         // Performing scroll restoration
    | 'ACTIVE'            // Normal operation, tracking enabled
    | 'NAVIGATING';       // User jumped via TOC/search

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
    safeAreaInsetsPx,
    onPositionUpdate,
    onRegisterSave,
    onUpdateSettings,
    chapterFilenames = [],
    highlights = [],
    onAddHighlight,
    onRemoveHighlight,
    navigationRef,
    css,
}) => {
    // ========================================================================
    // Determine Target Chapter (Source of Truth)
    // ========================================================================
    
    const targetChapter = useMemo(() => {
        // initialProgress takes precedence over initialChapter
        if (initialProgress?.chapterIndex !== undefined) {
            return initialProgress.chapterIndex;
        }
        return initialChapter;
    }, [initialProgress?.chapterIndex, initialChapter]);

    // ========================================================================
    // Refs
    // ========================================================================

    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const blockTrackerRef = useRef<BlockTracker | null>(null);
    const scrollDebounceRef = useRef<number | null>(null);
    
    // Restoration refs
    const restorationStateRef = useRef<RestorationState>(
        initialProgress?.blockId ? 'LOADING_TARGET' : 'ACTIVE'
    );
    const saveLockUntilRef = useRef<number>(0);
    const currentBlockIdRef = useRef<string | null>(null);
    const currentBlockElementRef = useRef<Element | null>(null);

    // Drag detection
    const isDraggingRef = useRef(false);
    const startPosRef = useRef({ x: 0, y: 0 });

    // Callback refs
    const onPositionUpdateRef = useRef(onPositionUpdate);
    const onRegisterSaveRef = useRef(onRegisterSave);
    const onToggleUIRef = useRef(onToggleUI);

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
    // State
    // ========================================================================

    // Initialize with target chapter (from initialProgress or fallback)
    const [currentChapter, setCurrentChapter] = useState(targetChapter);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [contentLoaded, setContentLoaded] = useState(false);
    const [currentProgress, setCurrentProgress] = useState(initialProgress?.totalProgress || 0);
    const [currentPosition, setCurrentPosition] = useState<SaveablePosition | null>(null);
    const [restorationComplete, setRestorationComplete] = useState(!initialProgress?.blockId);

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
    }, [initialProgress?.blockId]);

    useEffect(() => {
        saveSchedulerRef.current.updateOptions({
            bookId,
            autoSaveEnabled: settings.lnAutoBookmark ?? true,
            saveDelay: settings.lnBookmarkDelay ?? 0,
        });
    }, [bookId, settings.lnAutoBookmark, settings.lnBookmarkDelay]);

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

    // Layout key for detecting changes that require re-restoration
    const layoutKey = useMemo(() => JSON.stringify({
        isVertical,
        isRTL,
        fontSize: settings.lnFontSize,
        lineHeight: settings.lnLineHeight,
        letterSpacing: settings.lnLetterSpacing,
        fontFamily: settings.lnFontFamily,
        textAlign: settings.lnTextAlign,
        furigana: settings.lnEnableFurigana,
        marginTop: settings.lnMarginTop,
        marginBottom: settings.lnMarginBottom,
        marginLeft: settings.lnMarginLeft,
        marginRight: settings.lnMarginRight,
    }), [
        isVertical, isRTL,
        settings.lnFontSize, settings.lnLineHeight, settings.lnLetterSpacing,
        settings.lnFontFamily, settings.lnTextAlign, settings.lnEnableFurigana,
        settings.lnMarginTop, settings.lnMarginBottom, settings.lnMarginLeft, settings.lnMarginRight,
    ]);

    // ========================================================================
    // Chapter Loader
    // ========================================================================

    const { loadChaptersAround, getChapterHtml, loadingState, loadChapter } = useChapterLoader({
        chapters,
        preloadCount: 3,
    });

    // Load target chapter FIRST, then neighbors
    useEffect(() => {
        console.log('[ContinuousReader] Initial load - target chapter:', targetChapter);
        
        // Load target chapter with priority
        loadChapter(targetChapter, true);
        
        // Then load neighbors
        loadChaptersAround(targetChapter);
    }, [targetChapter, loadChapter, loadChaptersAround]);

    // Track when content is loaded
    useEffect(() => {
        const checkLoaded = () => {
            // Check if target chapter specifically is loaded
            const targetHtml = getChapterHtml(targetChapter);
            if (targetHtml && !contentLoaded) {
                console.log('[ContinuousReader] Target chapter loaded:', targetChapter);
                setContentLoaded(true);
            }
        };

        checkLoaded();
        const timer = setInterval(checkLoaded, 50);
        return () => clearInterval(timer);
    }, [targetChapter, getChapterHtml, contentLoaded]);

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

        // Try precise caret-based offset first
        let blockLocalOffset = calculatePreciseBlockOffset(
            blockElement,
            container,
            isVertical
        );

        // Fallback to ratio-based if precise fails
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

        // Calculate chapter character offset
        let chapterCharOffset: number;
        
        if (stats.blockMaps && stats.blockMaps.length > 0) {
            const chapterLookup = createChapterBlockLookup(stats.blockMaps, chapterIndex);
            chapterCharOffset = calculateCharOffsetFromBlock(chapterLookup, blockId, blockLocalOffset);
        } else {
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
        // GUARD: Don't save if restoration state is not ACTIVE
        if (restorationStateRef.current !== 'ACTIVE') {
            console.log('[BlockTracker] Not active state, ignoring:', restorationStateRef.current);
            return;
        }
        
        // GUARD: Enforce save lock
        if (Date.now() < saveLockUntilRef.current) {
            console.log('[BlockTracker] Save locked, ignoring block change');
            return;
        }
        
        // GUARD: Ignore if same block (no movement)
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
    // Reset restoration when layout changes
    // ========================================================================

    useEffect(() => {
        if (restorationStateRef.current === 'ACTIVE' && initialProgress?.blockId) {
            restorationStateRef.current = 'LOADING_TARGET';
            setRestorationComplete(false);
        }
    }, [layoutKey]);

    // ========================================================================
    // Restoration Effect (No Timeouts!)
    // ========================================================================

    useEffect(() => {
        // Skip if already restored or no position to restore
        if (restorationStateRef.current === 'ACTIVE') return;
        if (!initialProgress?.blockId) {
            restorationStateRef.current = 'ACTIVE';
            setRestorationComplete(true);
            return;
        }
        
        const container = containerRef.current;
        if (!container || !contentLoaded) return;
        
        const targetChapterIndex = initialProgress.chapterIndex ?? 0;
        
        // Wait for fonts and layout to settle before restoring
        const waitForReady = async () => {
            if (document.fonts) {
                try { await document.fonts.ready; } catch {}
            }
            // Wait for layout to settle
            await new Promise(r => requestAnimationFrame(r));
            await new Promise(r => requestAnimationFrame(r));
        };
        
        // First check - if no blocks, wait and try again
        let blocks = container.querySelectorAll(`[data-block-id^="ch${targetChapterIndex}-b"]`);
        if (blocks.length === 0) {
            await waitForReady();
            // Check again after waiting
            blocks = container.querySelectorAll(`[data-block-id^="ch${targetChapterIndex}-b"]`);
        }
        
        if (blocks.length === 0) {
            // Target chapter not in DOM yet
            // Effect will re-run when DOM updates (via contentLoaded or other deps)
            console.log('[Restore] Waiting for chapter', targetChapterIndex, 'to appear in DOM');
            restorationStateRef.current = 'WAITING_FOR_DOM';
            return;
        }
        
        // Target chapter is ready - perform restoration
        console.log('[Restore] Chapter', targetChapterIndex, 'ready with', blocks.length, 'blocks');
        restorationStateRef.current = 'RESTORING';
        
        const result = restoreReadingPosition(
            container,
            {
                chapterIndex: targetChapterIndex,
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
        
        // Update refs
        currentBlockIdRef.current = result.blockId || initialProgress.blockId;
        saveLockUntilRef.current = Date.now() + SAVE_LOCK_DURATION_MS;
        
        console.log('[Restore] Position restored:', result);
        
        // Wait for scroll to settle using requestAnimationFrame (not setTimeout!)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                restorationStateRef.current = 'ACTIVE';
                setRestorationComplete(true);
                console.log('[Restore] Restoration complete, tracking enabled');
            });
        });
        
    }, [contentLoaded, initialProgress, isVertical, isRTL, stats?.blockMaps, layoutKey]);

    // ========================================================================
    // Handle initialProgress Changes (Search/Highlight Navigation)
    // ========================================================================

    const lastInitialProgressRef = useRef(initialProgress);
    
    useEffect(() => {
        const lastProgress = lastInitialProgressRef.current;
        const progressChanged = 
            (lastProgress?.blockId !== initialProgress?.blockId) ||
            (lastProgress?.chapterIndex !== initialProgress?.chapterIndex);
        
        if (progressChanged && initialProgress?.blockId && restorationStateRef.current === 'ACTIVE') {
            console.log('[ContinuousReader] InitialProgress changed, navigating to new position');
            
            // Use scrollToBlock for navigation
            scrollToBlock(initialProgress.blockId, initialProgress.blockLocalOffset);
        }
        
        lastInitialProgressRef.current = initialProgress;
    }, [initialProgress?.blockId, initialProgress?.chapterIndex, initialProgress?.blockLocalOffset]);

    // ========================================================================
    // Block Tracker Setup
    // ========================================================================

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !contentLoaded || !stats) return;
        
        // CRITICAL: Only start tracking when restoration is complete
        if (!restorationComplete) {
            console.log('[BlockTracker] Waiting for restoration...');
            return;
        }

        console.log('[BlockTracker] Starting tracking');

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
            const progress = calculateScrollProgress(container, navOptions);
            setScrollProgress(progress);

            if (scrollDebounceRef.current) {
                clearTimeout(scrollDebounceRef.current);
            }

            scrollDebounceRef.current = window.setTimeout(() => {
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
    // Direct Navigation Functions (TOC/Search)
    // ========================================================================

    const scrollToBlock = useCallback((blockId: string, blockLocalOffset?: number) => {
        const container = containerRef.current;
        if (!container) return;

        // Extract chapter index from blockId
        const chapterMatch = blockId.match(/ch(\d+)-/);
        const chapterIndex = chapterMatch ? parseInt(chapterMatch[1], 10) : 0;

        console.log('[Navigate] scrollToBlock:', blockId, 'chapter:', chapterIndex);

        // Set state to navigating (prevents saves)
        restorationStateRef.current = 'NAVIGATING';
        saveLockUntilRef.current = Date.now() + SAVE_LOCK_DURATION_MS;

        // Update chapter state
        setCurrentChapter(chapterIndex);

        // Load chapter with priority
        loadChapter(chapterIndex, true);

        // Use MutationObserver to wait for block to appear (no setTimeout!)
        const observer = new MutationObserver(() => {
            const block = container.querySelector(`[data-block-id="${blockId}"]`);
            
            if (block) {
                observer.disconnect();
                
                // Scroll to block
                block.scrollIntoView({ behavior: 'auto', block: 'start' });

                // Apply local offset if provided
                if (blockLocalOffset && blockLocalOffset > 0) {
                    requestAnimationFrame(() => {
                        applyLocalOffset(block as Element, container, blockLocalOffset, isVertical, isRTL);
                    });
                }

                // Update tracking
                currentBlockIdRef.current = blockId;

                // Load adjacent chapters
                loadChaptersAround(chapterIndex);

                // Enable tracking after scroll settles
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        restorationStateRef.current = 'ACTIVE';
                        setRestorationComplete(true);
                    });
                });
            }
        });

        // Start observing
        observer.observe(container, { childList: true, subtree: true });

        // Check if block already exists
        const existingBlock = container.querySelector(`[data-block-id="${blockId}"]`);
        if (existingBlock) {
            observer.disconnect();
            
            existingBlock.scrollIntoView({ behavior: 'auto', block: 'start' });
            
            if (blockLocalOffset && blockLocalOffset > 0) {
                requestAnimationFrame(() => {
                    applyLocalOffset(existingBlock as Element, container, blockLocalOffset, isVertical, isRTL);
                });
            }
            
            currentBlockIdRef.current = blockId;
            loadChaptersAround(chapterIndex);
            
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    restorationStateRef.current = 'ACTIVE';
                    setRestorationComplete(true);
                });
            });
        }

        // Safety timeout to disconnect observer
        const safetyTimeout = setTimeout(() => {
            observer.disconnect();
            console.log('[Navigate] Observer timeout - block may not exist');
            restorationStateRef.current = 'ACTIVE';
            setRestorationComplete(true);
        }, 3000);

        // Clean up safety timeout if observer finds block
        return () => {
            clearTimeout(safetyTimeout);
            observer.disconnect();
        };
    }, [isVertical, isRTL, loadChapter, loadChaptersAround]);

    const scrollToChapter = useCallback((chapterIndex: number) => {
        const container = containerRef.current;
        if (!container) return;

        console.log('[Navigate] scrollToChapter:', chapterIndex);

        // Set state to navigating
        restorationStateRef.current = 'NAVIGATING';
        saveLockUntilRef.current = Date.now() + SAVE_LOCK_DURATION_MS;

        // Update state
        setCurrentChapter(chapterIndex);

        // Load chapter
        loadChapter(chapterIndex, true);

        // Use MutationObserver
        const observer = new MutationObserver(() => {
            const blocks = container.querySelectorAll(
                `[data-block-id^="ch${chapterIndex}-b"]`
            );
            
            if (blocks.length > 0) {
                observer.disconnect();
                
                // Scroll to first block
                (blocks[0] as HTMLElement).scrollIntoView({ 
                    behavior: 'auto', 
                    block: 'start' 
                });
                
                currentBlockIdRef.current = blocks[0].getAttribute('data-block-id');
                loadChaptersAround(chapterIndex);
                
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        restorationStateRef.current = 'ACTIVE';
                        setRestorationComplete(true);
                    });
                });
            }
        });

        observer.observe(container, { childList: true, subtree: true });

        // Check if already exists
        const existingBlocks = container.querySelectorAll(
            `[data-block-id^="ch${chapterIndex}-b"]`
        );
        
        if (existingBlocks.length > 0) {
            observer.disconnect();
            
            (existingBlocks[0] as HTMLElement).scrollIntoView({ 
                behavior: 'auto', 
                block: 'start' 
            });
            
            currentBlockIdRef.current = existingBlocks[0].getAttribute('data-block-id');
            loadChaptersAround(chapterIndex);
            
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    restorationStateRef.current = 'ACTIVE';
                    setRestorationComplete(true);
                });
            });
        }

        // Safety timeout
        setTimeout(() => {
            observer.disconnect();
            restorationStateRef.current = 'ACTIVE';
            setRestorationComplete(true);
        }, 3000);
    }, [loadChapter, loadChaptersAround]);

    // Expose navigation functions via ref
    useEffect(() => {
        if (navigationRef) {
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
    // Scroll Navigation
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
                scrollToChapter(chapterIndex);
            }
        };

        container.addEventListener('epub-link-clicked', handleEpubLink);
        return () => container.removeEventListener('epub-link-clicked', handleEpubLink);
    }, [chapterFilenames, scrollToChapter]);

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
    // Render Helpers
    // ========================================================================

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

    // ========================================================================
    // Visible Chapter Window
    // ========================================================================

    const visibleChapterIndices = useMemo(() => {
        const windowSize = 2;
        const start = Math.max(0, currentChapter - windowSize);
        const end = Math.min(chapters.length - 1, currentChapter + windowSize);
        const indices = [];
        for (let i = start; i <= end; i++) {
            indices.push(i);
        }
        return indices;
    }, [currentChapter, chapters.length]);

    // ========================================================================
    // Memoized Styles
    // ========================================================================

    const wrapperStyle = useMemo(() => {
        const brightness = settings.lnTextBrightness ?? 100;
        const textColor = brightness === 100 
            ? theme.fg 
            : adjustBrightness(theme.fg, brightness);
        
        return {
            backgroundColor: theme.bg,
            color: textColor,
            direction: isRTL ? 'rtl' : 'ltr',
            '--ln-highlight-bg': (theme as any).highlight || 'rgba(255, 235, 59, 0.45)',
        };
    }, [theme.bg, theme.fg, isRTL, settings.lnTextBrightness]);

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
            opacity: contentLoaded ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
        };
    }, [isVertical, settings.lnFontFamily, settings.lnSecondaryFontFamily, settings.lnFontWeight, contentLoaded]);

    const safeInsets = useMemo(() => ({
        top: safeAreaInsetsPx?.top ?? (safeAreaTopInset ? parseInt(safeAreaTopInset, 10) : 0),
        right: safeAreaInsetsPx?.right ?? 0,
        bottom: safeAreaInsetsPx?.bottom ?? 0,
        left: safeAreaInsetsPx?.left ?? 0,
    }), [safeAreaInsetsPx, safeAreaTopInset]);

    const handleUpdateSettings = onUpdateSettings ?? (() => {});

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div
            className={`continuous-reader-wrapper ${isRTL ? 'rtl-mode' : 'ltr-mode'}`}
            style={wrapperStyle as React.CSSProperties}
            data-dark-mode={settings.lnTheme === 'dark' || settings.lnTheme === 'black'}
        >
            <div
                className="continuous-margin-container"
                style={{
                    position: 'absolute',
                    inset: 0,
                    overflow: 'hidden',
                    paddingTop: `${(settings.lnMarginTop ?? 0) + safeInsets.top}px`,
                    paddingRight: `${(settings.lnMarginRight ?? 0) + safeInsets.right}px`,
                    paddingBottom: `${(settings.lnMarginBottom ?? 0) + safeInsets.bottom}px`,
                    paddingLeft: `${(settings.lnMarginLeft ?? 0) + safeInsets.left}px`,
                }}
            >
                <div
                    ref={containerRef}
                    className={`continuous-reader-container ${isVertical ? 'vertical' : 'horizontal'}`}
                    style={{
                        ...containerStyles,
                        width: '100%',
                        height: '100%',
                    }}
                    onClick={handleContentClick}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                >
                    <div
                        ref={contentRef}
                        className={`continuous-content ${isVertical ? 'vertical' : 'horizontal'} ${!settings.lnEnableFurigana ? 'furigana-hidden' : ''}`}
                        style={contentStyle as React.CSSProperties}
                    >
                        {/* Sanitized EPUB CSS (fonts stripped) */}
                        {css && <style>{`@scope (.continuous-content) { ${css} }`}</style>}

                        {visibleChapterIndices.map((index) => (
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
                onUpdateSettings={handleUpdateSettings}
                isSaved={isSaved}
                onSaveNow={handleSaveNow}
            />

            <SelectionHandles 
                containerRef={contentRef}
                enabled={contentLoaded && restorationComplete}
                theme={(settings.lnTheme as 'light' | 'sepia' | 'dark' | 'black') || 'dark'}
                onSelectionComplete={(text, startOffset, endOffset, blockId) => {
                    if (onAddHighlight && currentChapter !== undefined && blockId) {
                        onAddHighlight(currentChapter, blockId, text, startOffset, endOffset);
                    }
                }}
            />
        </div>
    );
};