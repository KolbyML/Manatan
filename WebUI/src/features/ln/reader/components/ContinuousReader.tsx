import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ReaderNavigationUI } from '@/features/ln/reader/components/ReaderNavigationUI';
import { ChapterBlock } from '@/features/ln/reader/components/ChapterBlock';
import { SelectionHandles } from '@/features/ln/reader/components/SelectionHandles';
import { useChapterLoader } from '@/features/ln/reader/hooks/useChapterLoader';
import { useTextLookup } from '@/features/ln/reader/hooks/useTextLookup';
import { buildContainerStyles } from '@/features/ln/reader/utils/styles';
import { getReaderTheme } from '@/features/ln/reader/utils/themes';
import { calculateProgress as calculateScrollProgress } from '@/features/ln/reader/utils/navigation';
import { BlockTracker } from '@/features/ln/reader/utils/blockTracker';
import {
    extractContextSnippet,
    calculateBlockLocalOffset,
    calculatePreciseBlockOffset,
    getCleanTextContent,
    getCleanCharCount,
} from '@/features/ln/reader/utils/blockPosition';
import { createChapterBlockLookup, calculateCharOffsetFromBlock } from '@/features/ln/reader/utils/blockMap';
import { SaveablePosition, calculateProgress, createSaveScheduler } from '@/features/ln/reader/utils/readerSave';
import { restoreReadingPosition, applyLocalOffset, RestorationPosition } from '@/features/ln/reader/utils/restoration';
import { ContinuousReaderProps } from '@/features/ln/reader/types/reader';
import '@/features/ln/reader/components/ContinuousReader.css';

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
    | 'LOADING_TARGET' // Loading the target chapter
    | 'WAITING_FOR_DOM' // Waiting for target chapter to appear in DOM
    | 'RESTORING' // Performing scroll restoration
    | 'ACTIVE' // Normal operation, tracking enabled
    | 'NAVIGATING'; // User jumped via TOC/search

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
    // Hooks & Memos (Top Level)
    // ========================================================================

    const targetChapter = useMemo(() => {
        if (initialProgress?.chapterIndex !== undefined) {
            return initialProgress.chapterIndex;
        }
        return initialChapter;
    }, [initialProgress?.chapterIndex, initialChapter]);

    const { loadChaptersAround, getChapterHtml, loadingState, loadChapter } = useChapterLoader({
        chapters,
        preloadCount: 3,
    });

    const { tryLookup } = useTextLookup();

    const theme = useMemo(() => getReaderTheme(settings.lnTheme), [settings.lnTheme]);

    const navOptions = useMemo(() => ({ isVertical, isRTL, isPaged: false }), [isVertical, isRTL]);

    const containerStyles = useMemo(
        () => buildContainerStyles(settings, isVertical, isRTL),
        [settings, isVertical, isRTL],
    );

    const layoutKey = useMemo(
        () =>
            JSON.stringify({
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
            }),
        [
            isVertical,
            isRTL,
            settings.lnFontSize,
            settings.lnLineHeight,
            settings.lnLetterSpacing,
            settings.lnFontFamily,
            settings.lnTextAlign,
            settings.lnEnableFurigana,
            settings.lnMarginTop,
            settings.lnMarginBottom,
            settings.lnMarginLeft,
            settings.lnMarginRight,
        ],
    );

    // ========================================================================
    // Refs
    // ========================================================================

    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const blockTrackerRef = useRef<BlockTracker | null>(null);
    const scrollDebounceRef = useRef<number | null>(null);

    const restorationStateRef = useRef<RestorationState>(initialProgress?.blockId ? 'LOADING_TARGET' : 'ACTIVE');
    const saveLockUntilRef = useRef<number>(0);
    const currentBlockIdRef = useRef<string | null>(null);
    const currentBlockElementRef = useRef<Element | null>(null);
    const restoreAnchorRef = useRef<RestorationPosition | null>(null);

    const isDraggingRef = useRef(false);
    const startPosRef = useRef({ x: 0, y: 0 });

    const onPositionUpdateRef = useRef(onPositionUpdate);
    const onRegisterSaveRef = useRef(onRegisterSave);
    const onToggleUIRef = useRef(onToggleUI);

    const [isSaved, setIsSaved] = useState(true);
    const saveSchedulerRef = useRef(
        createSaveScheduler({
            bookId,
            debounceMs: SAVE_DEBOUNCE_MS,
            autoSaveEnabled: settings.lnAutoBookmark ?? true,
            saveDelay: settings.lnBookmarkDelay ?? 0,
            onSaveStatusChange: setIsSaved,
        }),
    );

    // ========================================================================
    // State
    // ========================================================================

    const [currentChapter, setCurrentChapter] = useState(targetChapter);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [contentLoaded, setContentLoaded] = useState(false);
    const [currentProgress, setCurrentProgress] = useState(initialProgress?.totalProgress || 0);
    const [currentPosition, setCurrentPosition] = useState<SaveablePosition | null>(null);
    const [restorationComplete, setRestorationComplete] = useState(!initialProgress?.blockId);

    // ========================================================================
    // Logic Callbacks (Defined early to avoid initialization issues)
    // ========================================================================

    const calculatePositionFromBlock = useCallback(
        (blockId: string, blockElement: Element): SaveablePosition | null => {
            if (!containerRef.current || !stats) return null;

            const container = containerRef.current;

            // Try precise caret-based offset first
            let blockLocalOffset = calculatePreciseBlockOffset(blockElement, container, isVertical);

            // Fallback to ratio-based if precise fails
            const textContent = getCleanTextContent(blockElement);
            if (blockLocalOffset === 0 && textContent.length > 0) {
                blockLocalOffset = calculateBlockLocalOffset(blockElement, container, isVertical);
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
                    const prevBlock = container.querySelector(`[data-block-id="ch${chapterIndex}-b${i}"]`);
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
        },
        [stats, isVertical, currentChapter],
    );

    const handleActiveBlockChange = useCallback(
        (blockId: string, element: Element) => {
            // Update anchor ref for layout changes
            const chapterMatch = blockId.match(/ch(\d+)-/);
            const chapterIndex = chapterMatch ? parseInt(chapterMatch[1], 10) : currentChapter;

            restoreAnchorRef.current = {
                blockId,
                chapterIndex,
                blockLocalOffset: calculatePreciseBlockOffset(element, containerRef.current!, isVertical),
            };

            // GUARD: Don't track if restoration state is not ACTIVE
            if (restorationStateRef.current !== 'ACTIVE') {
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

            // UI Updates (Current progress, position, chapter)
            setCurrentProgress(position.totalProgress);
            setCurrentPosition(position);

            // Update chapter if changed
            const chapterMatchLocal = blockId.match(/ch(\d+)-/);
            if (chapterMatchLocal) {
                const chapterIndexLocal = parseInt(chapterMatchLocal[1], 10);
                if (chapterIndexLocal !== currentChapter) {
                    console.log('[ContinuousReader] Active chapter changed:', chapterIndexLocal);
                    setCurrentChapter(chapterIndexLocal);
                    loadChaptersAround(chapterIndexLocal);
                }
            }

            // Notify parent (for TOC updates, etc.) - HIGHEST PRIORITY
            onPositionUpdateRef.current?.({
                chapterIndex: position.chapterIndex,
                chapterCharOffset: position.chapterCharOffset,
                sentenceText: position.sentenceText || '',
                totalProgress: position.totalProgress,
                blockId: position.blockId,
            });

            // Save Scheduling (Only if not locked)
            if (Date.now() >= saveLockUntilRef.current) {
                saveSchedulerRef.current.scheduleSave(position);
            } else {
                console.log('[BlockTracker] Save locked, reporting position but skipping save');
            }
        },
        [calculatePositionFromBlock, currentChapter, loadChaptersAround, isVertical],
    );

    // ========================================================================
    // Direct Navigation Functions (TOC/Search)
    // ========================================================================

    const scrollToBlock = useCallback(
        (blockId: string, blockLocalOffset?: number) => {
            const container = containerRef.current;
            if (!container) return;

            // Extract chapter index from blockId
            const chapterMatch = blockId.match(/ch(\d+)-/);
            const chapterIndex = chapterMatch ? parseInt(chapterMatch[1], 10) : currentChapter;

            console.log('[Navigate] scrollToBlock:', blockId, 'offset:', blockLocalOffset, 'chapter:', chapterIndex);

            // Set state to navigating (prevents saves)
            restorationStateRef.current = 'NAVIGATING';
            saveLockUntilRef.current = Date.now() + SAVE_LOCK_DURATION_MS;

            // Update chapter state (Sync with TOC)
            if (chapterIndex !== currentChapter) {
                setCurrentChapter(chapterIndex);
            }

            // Load chapter with priority
            loadChapter(chapterIndex, true);

            const performScroll = (element: Element) => {
                element.scrollIntoView({ behavior: 'auto', block: 'start' });

                if (blockLocalOffset && blockLocalOffset > 0) {
                    // Use multiple frames to ensure layout is updated after scrollIntoView
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            applyLocalOffset(element, container, blockLocalOffset, isVertical, isRTL);
                        });
                    });
                }

                currentBlockIdRef.current = blockId;
                loadChaptersAround(chapterIndex);

                // Notify parent of navigation success (Sync with TOC)
                const position = calculatePositionFromBlock(blockId, element);
                if (position) {
                    onPositionUpdateRef.current?.({
                        chapterIndex: position.chapterIndex,
                        chapterCharOffset: position.chapterCharOffset,
                        sentenceText: position.sentenceText || '',
                        totalProgress: position.totalProgress,
                        blockId: position.blockId,
                    });
                }

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        restorationStateRef.current = 'ACTIVE';
                        setRestorationComplete(true);
                    });
                });
            };

            // Check if block already exists
            const existingBlock = container.querySelector(`[data-block-id="${blockId}"]`);
            if (existingBlock) {
                performScroll(existingBlock);
                return;
            }

            // Use MutationObserver to wait for block to appear
            const observer = new MutationObserver(() => {
                const block = container.querySelector(`[data-block-id="${blockId}"]`);
                if (block) {
                    observer.disconnect();
                    clearTimeout(safetyTimeout);
                    performScroll(block);
                }
            });

            // Start observing
            observer.observe(container, { childList: true, subtree: true });

            // Safety timeout to disconnect observer
            const safetyTimeout = setTimeout(() => {
                observer.disconnect();
                console.log('[Navigate] Observer timeout - block may not exist');
                restorationStateRef.current = 'ACTIVE';
                setRestorationComplete(true);
            }, 5000);
        },
        [isVertical, isRTL, loadChapter, loadChaptersAround, currentChapter, calculatePositionFromBlock],
    );

    // ========================================================================
    // Reset restoration when layout changes
    // ========================================================================

    useEffect(() => {
        if (restorationStateRef.current === 'ACTIVE') {
            console.log('[ContinuousReader] Layout changed, resetting restoration state');
            restorationStateRef.current = 'LOADING_TARGET';
            setRestorationComplete(false);
        }
    }, [layoutKey]);

    // ========================================================================
    // Restoration Effect (No Timeouts!)
    // ========================================================================

    useEffect(() => {
        let isCancelled = false;

        const performRestoration = async () => {
            // Skip if already restored, navigating, or no position to restore
            if (restorationStateRef.current === 'ACTIVE' || restorationStateRef.current === 'NAVIGATING') return;

            const anchor =
                restoreAnchorRef.current ||
                (initialProgress?.blockId
                    ? {
                          blockId: initialProgress.blockId,
                          chapterIndex: initialProgress.chapterIndex ?? 0,
                          blockLocalOffset: initialProgress.blockLocalOffset,
                          contextSnippet: initialProgress.contextSnippet,
                          chapterCharOffset: initialProgress.chapterCharOffset,
                          sentenceText: initialProgress.sentenceText,
                      }
                    : null);

            if (!anchor) {
                restorationStateRef.current = 'ACTIVE';
                setRestorationComplete(true);
                return;
            }

            const container = containerRef.current;
            if (!container || !contentLoaded || isCancelled) return;

            const targetChapterIndex = anchor.chapterIndex ?? 0;

            // Wait for fonts and layout to settle before restoring
            if (document.fonts) {
                try {
                    await document.fonts.ready;
                } catch {}
            }
            if (isCancelled) return;

            // Wait for layout to settle
            await new Promise((r) => requestAnimationFrame(r));
            await new Promise((r) => requestAnimationFrame(r));
            if (isCancelled) return;

            // Check if target chapter blocks are present
            const blocks = container.querySelectorAll(`[data-block-id^="ch${targetChapterIndex}-b"]`);
            if (blocks.length === 0) {
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
                    blockId: anchor.blockId,
                    blockLocalOffset: anchor.blockLocalOffset,
                    contextSnippet: anchor.contextSnippet,
                    chapterCharOffset: anchor.chapterCharOffset,
                    sentenceText: anchor.sentenceText,
                },
                {
                    isVertical,
                    isRTL,
                    blockMaps: stats?.blockMaps,
                },
            );

            if (isCancelled) return;

            // Update refs
            currentBlockIdRef.current = result.blockId || anchor.blockId || null;
            saveLockUntilRef.current = Date.now() + SAVE_LOCK_DURATION_MS;

            console.log('[Restore] Position restored:', result);

            // Wait for scroll to settle
            requestAnimationFrame(() => {
                if (isCancelled) return;
                requestAnimationFrame(() => {
                    if (isCancelled) return;
                    restorationStateRef.current = 'ACTIVE';
                    setRestorationComplete(true);
                    console.log('[Restore] Restoration complete, tracking enabled');
                });
            });
        };

        performRestoration();
        return () => {
            isCancelled = true;
        };
    }, [contentLoaded, initialProgress, isVertical, isRTL, stats?.blockMaps, layoutKey]);

    const scrollToChapter = useCallback(
        (chapterIndex: number) => {
            const container = containerRef.current;
            if (!container) return;

            console.log('[Navigate] scrollToChapter:', chapterIndex);

            // Set state to navigating
            restorationStateRef.current = 'NAVIGATING';
            saveLockUntilRef.current = Date.now() + SAVE_LOCK_DURATION_MS;

            // Update state
            if (chapterIndex !== currentChapter) {
                setCurrentChapter(chapterIndex);
            }

            // Load chapter
            loadChapter(chapterIndex, true);

            const performScroll = (blocks: NodeListOf<Element>) => {
                if (blocks.length === 0) return;

                (blocks[0] as HTMLElement).scrollIntoView({
                    behavior: 'auto',
                    block: 'start',
                });

                const blockId = blocks[0].getAttribute('data-block-id');
                currentBlockIdRef.current = blockId;
                loadChaptersAround(chapterIndex);

                // Notify parent of navigation success (Sync with TOC)
                if (blockId) {
                    const position = calculatePositionFromBlock(blockId, blocks[0]);
                    if (position) {
                        onPositionUpdateRef.current?.({
                            chapterIndex: position.chapterIndex,
                            chapterCharOffset: position.chapterCharOffset,
                            sentenceText: position.sentenceText || '',
                            totalProgress: position.totalProgress,
                            blockId: position.blockId,
                        });
                    }
                }

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        restorationStateRef.current = 'ACTIVE';
                        setRestorationComplete(true);
                    });
                });
            };

            // Check if already exists
            const existingBlocks = container.querySelectorAll(`[data-block-id^="ch${chapterIndex}-b"]`);

            if (existingBlocks.length > 0) {
                performScroll(existingBlocks);
                return;
            }

            // Use MutationObserver
            const observer = new MutationObserver(() => {
                const blocks = container.querySelectorAll(`[data-block-id^="ch${chapterIndex}-b"]`);

                if (blocks.length > 0) {
                    observer.disconnect();
                    clearTimeout(safetyTimeout);
                    performScroll(blocks);
                }
            });

            observer.observe(container, { childList: true, subtree: true });

            // Safety timeout
            const safetyTimeout = setTimeout(() => {
                observer.disconnect();
                console.log('[Navigate] scrollToChapter timeout');
                restorationStateRef.current = 'ACTIVE';
                setRestorationComplete(true);
            }, 5000);
        },
        [loadChapter, loadChaptersAround, currentChapter, calculatePositionFromBlock, isVertical, isRTL],
    );

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
    // Effects (Using defined callbacks)
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

    useEffect(() => {
        console.log('[ContinuousReader] Initial load - target chapter:', targetChapter);
        loadChapter(targetChapter, true);
        loadChaptersAround(targetChapter);
    }, [targetChapter, loadChapter, loadChaptersAround]);

    useEffect(() => {
        const checkLoaded = () => {
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

    useEffect(() => {
        onRegisterSaveRef.current?.(saveSchedulerRef.current.saveNow);
    }, []);

    // ========================================================================
    // Handle initialProgress Changes (Search/Highlight Navigation)
    // ========================================================================

    const lastInitialProgressRef = useRef(initialProgress);

    useEffect(() => {
        const lastProgress = lastInitialProgressRef.current;
        const progressChanged =
            lastProgress?.blockId !== initialProgress?.blockId ||
            lastProgress?.chapterIndex !== initialProgress?.chapterIndex;

        // Skip if this update matches our current internal state (internal scroll)
        const isInternalUpdate = initialProgress?.blockId === currentBlockIdRef.current;

        if (progressChanged && initialProgress?.blockId && !isInternalUpdate) {
            console.log('[ContinuousReader] External position change, navigating:', initialProgress.blockId);

            // Update currentChapter to ensure the correct window of chapters is rendered
            if (initialProgress.chapterIndex !== undefined && initialProgress.chapterIndex !== currentChapter) {
                setCurrentChapter(initialProgress.chapterIndex);
                loadChaptersAround(initialProgress.chapterIndex);
            }

            // Use scrollToBlock for navigation
            scrollToBlock(initialProgress.blockId, initialProgress.blockLocalOffset);
        }

        lastInitialProgressRef.current = initialProgress;
    }, [initialProgress, currentChapter, scrollToBlock, loadChaptersAround]);

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
    // Touch/Click Handlers
    // ========================================================================

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        isDraggingRef.current = false;
        startPosRef.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handlePointerMove = useCallback(
        (e: React.PointerEvent) => {
            const threshold = settings.lnDragThreshold ?? 10;
            if (!isDraggingRef.current) {
                const dx = Math.abs(e.clientX - startPosRef.current.x);
                const dy = Math.abs(e.clientY - startPosRef.current.y);
                if (dx > threshold || dy > threshold) {
                    isDraggingRef.current = true;
                }
            }
        },
        [settings.lnDragThreshold],
    );

    const handleContentClick = useCallback(
        async (e: React.MouseEvent) => {
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
                        bubbles: true,
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
        },
        [tryLookup],
    );

    // ========================================================================
    // Scroll Navigation
    // ========================================================================

    const scrollSmall = useCallback(
        (forward: boolean) => {
            const container = containerRef.current;
            if (!container) return;

            const amount = 200;
            const behavior = settings.lnDisableAnimations ? 'auto' : 'smooth';

            if (isVertical) {
                const delta = forward ? (isRTL ? -amount : amount) : isRTL ? amount : -amount;
                container.scrollBy({ left: delta, behavior });
            } else {
                container.scrollBy({ top: forward ? amount : -amount, behavior });
            }
        },
        [isVertical, isRTL, settings.lnDisableAnimations],
    );

    // ========================================================================
    // EPUB Link Handler
    // ========================================================================

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleEpubLink = (event: Event) => {
            const customEvent = event as CustomEvent<{ href: string }>;
            const { href } = customEvent.detail;
            const [filename, anchor] = href.split('#');

            let chapterIndex = chapterFilenames.indexOf(filename);

            if (chapterIndex === -1) {
                chapterIndex = chapterFilenames.findIndex((fn) => fn.endsWith(filename) || fn.endsWith(`/${filename}`));
            }

            if (chapterIndex === -1) {
                const targetBasename = filename.split('/').pop() || filename;
                chapterIndex = chapterFilenames.findIndex((fn) => {
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

    const handleSaveNow = useCallback(async (): Promise<boolean> => saveSchedulerRef.current.saveNow(), []);

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

    useEffect(
        () => () => {
            if (scrollDebounceRef.current) {
                clearTimeout(scrollDebounceRef.current);
            }
            blockTrackerRef.current?.stop();
            saveSchedulerRef.current.saveNow();
        },
        [],
    );

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
        const textColor = brightness === 100 ? theme.fg : adjustBrightness(theme.fg, brightness);

        return {
            backgroundColor: theme.bg,
            color: textColor,
            direction: isRTL ? 'rtl' : 'ltr',
            '--ln-highlight-bg': (theme as any).highlight || 'rgba(255, 235, 59, 0.45)',
        };
    }, [theme.bg, theme.fg, isRTL, settings.lnTextBrightness]);

    const safeInsets = useMemo(
        () => ({
            top: safeAreaInsetsPx?.top ?? (safeAreaTopInset ? parseInt(safeAreaTopInset, 10) : 0),
            right: safeAreaInsetsPx?.right ?? 0,
            bottom: safeAreaInsetsPx?.bottom ?? 0,
            left: safeAreaInsetsPx?.left ?? 0,
        }),
        [safeAreaInsetsPx, safeAreaTopInset],
    );

    const contentStyle = useMemo(() => {
        let fontFamily = settings.lnFontFamily || "'Noto Serif JP', serif";
        if (settings.lnSecondaryFontFamily) {
            fontFamily = `${fontFamily}, ${settings.lnSecondaryFontFamily}`;
        }

        const marginTop = (settings.lnMarginTop ?? 0) + safeInsets.top;

        // Calculate bottom margin/padding.
        // We only add extra padding to clear the navigation bar if it's LOCKED (always visible).
        // If it's just toggled, we don't reflow the layout to avoid glitches.
        const baseBottom = (settings.lnMarginBottom ?? 0) + safeInsets.bottom;
        const navHeight = 40;
        const extraBottom = settings.lnLockProgressBar ? Math.max(0, navHeight - baseBottom) : 0;
        const marginBottom = baseBottom + extraBottom;

        const marginLeft = (settings.lnMarginLeft ?? 0) + safeInsets.left;
        const marginRight = (settings.lnMarginRight ?? 0) + safeInsets.right;

        return {
            writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
            textOrientation: isVertical ? 'mixed' : undefined,
            direction: 'ltr',
            fontFamily,
            fontWeight: settings.lnFontWeight || 400,
            opacity: contentLoaded ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
            paddingTop: `${marginTop}px`,
            paddingBottom: `${marginBottom}px`,
            paddingLeft: `${marginLeft}px`,
            paddingRight: `${marginRight}px`,
        };
    }, [isVertical, settings, contentLoaded, safeInsets]);

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
