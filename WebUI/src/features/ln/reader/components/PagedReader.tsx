
import React, {
    useRef,
    useEffect,
    useState,
    useCallback,
    useMemo,
    useLayoutEffect
} from 'react';
import { Settings } from '@/Manatan/types';
import { BookStats, AppStorage, LNHighlight } from '@/lib/storage/AppStorage';
import { ReaderNavigationUI } from './ReaderNavigationUI';
import { ClickZones, getClickZone } from './ClickZones';
import { SelectionHandles } from './SelectionHandles';
import { buildTypographyStyles } from '../utils/styles';
import { handleKeyNavigation, NavigationCallbacks } from '../utils/navigation';
import { PagedReaderProps } from '../types/reader';
import { detectVisibleBlockPaged, restoreToBlockPaged } from '../utils/pagedPosition';
import { extractContextSnippet } from '../utils/blockPosition';
import { getReaderTheme } from '../utils/themes';
import { useTextLookup } from '../hooks/useTextLookup';
import {
    SaveablePosition,
    calculateProgress,
    createSaveScheduler
} from '../utils/readerSave';
import { createChapterBlockLookup, getPositionFromCharOffset } from '../utils/blockMap';
import './PagedReader.css';

// ============================================================================
// Helpers

function adjustBrightness(hexColor: string, brightness: number): string {
    // Handle rgba format
    if (hexColor.startsWith('rgba')) {
        const match = hexColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            const [, r, g, b] = match;
            const factor = brightness / 100;
            return `rgba(${Math.round(Number(r) * factor)}, ${Math.round(Number(g) * factor)}, ${Math.round(Number(b) * factor)})`;
        }
        return hexColor;
    }
    
    // Handle hex format
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    const factor = brightness / 100;
    return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

// ============================================================================
// Highlight Application
// ============================================================================

function applyHighlightsToHtml(
    html: string,
    chapterHighlights: LNHighlight[],
    chapterIndex: number
): string {
    if (!chapterHighlights.length || !html) return html;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Sort highlights by startOffset descending so we apply from end to start
    // This prevents offset shifting issues
    const sortedHighlights = [...chapterHighlights]
        .filter(h => h.chapterIndex === chapterIndex)
        .sort((a, b) => {
            // First by blockId, then by startOffset descending
            if (a.blockId !== b.blockId) {
                return a.blockId.localeCompare(b.blockId);
            }
            return b.startOffset - a.startOffset;
        });

    for (const highlight of sortedHighlights) {
        const block = doc.querySelector(`[data-block-id="${highlight.blockId}"]`);
        if (!block) continue;

        try {
            applyHighlightToBlock(block, highlight.startOffset, highlight.endOffset, highlight.id);
        } catch (err) {
            console.warn('[Highlights] Failed to apply highlight:', highlight.id, err);
        }
    }

    return doc.body.innerHTML;
}

function applyHighlightToBlock(
    block: Element,
    startOffset: number,
    endOffset: number,
    highlightId: string
): void {
    const walker = document.createTreeWalker(
        block,
        NodeFilter.SHOW_TEXT,
        null
    );

    let currentOffset = 0;
    const textNodes: { node: Text; start: number; end: number }[] = [];

    // Collect all text nodes with their offsets
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const nodeLength = node.textContent?.length || 0;
        
        textNodes.push({
            node,
            start: currentOffset,
            end: currentOffset + nodeLength,
        });
        
        currentOffset += nodeLength;
    }

    // Find nodes that overlap with the highlight range
    const overlappingNodes = textNodes.filter(
        tn => tn.end > startOffset && tn.start < endOffset
    );

    // Apply highlight to each overlapping node (in reverse order to preserve offsets)
    for (let i = overlappingNodes.length - 1; i >= 0; i--) {
        const { node, start } = overlappingNodes[i];
        
        const highlightStart = Math.max(0, startOffset - start);
        const highlightEnd = Math.min(node.textContent?.length || 0, endOffset - start);

        if (highlightStart >= highlightEnd) continue;

        const text = node.textContent || '';
        const before = text.substring(0, highlightStart);
        const highlighted = text.substring(highlightStart, highlightEnd);
        const after = text.substring(highlightEnd);

        const fragment = document.createDocumentFragment();
        
        if (before) {
            fragment.appendChild(document.createTextNode(before));
        }
        
        const mark = document.createElement('mark');
        mark.className = 'highlight';
        mark.dataset.highlightId = highlightId;
        mark.textContent = highlighted;
        fragment.appendChild(mark);
        
        if (after) {
            fragment.appendChild(document.createTextNode(after));
        }

        node.parentNode?.replaceChild(fragment, node);
    }
}

// ============================================================================
// Constants
// ============================================================================

const DRAG_THRESHOLD = 10;
const SAVE_DEBOUNCE_MS = 3000;
const POSITION_DETECT_DELAY_MS = 150;
const SWIPE_MIN_DISTANCE = 50;
const SWIPE_MAX_TIME = 500;

// ============================================================================
// Component
// ============================================================================

export const PagedReader: React.FC<PagedReaderProps> = ({
    bookId,
    chapters,
    stats,
    settings,
    isVertical,
    isRTL,
    initialChapter = 0,
    initialPage = 0,
    initialProgress,
    onToggleUI,
    showNavigation = false,
    safeAreaTopOffsetPx = 0,
    safeAreaInsetsPx,
    onPositionUpdate,
    onRegisterSave,
    onUpdateSettings,
    chapterFilenames = [],
    highlights = [],
    onAddHighlight,
    onRemoveHighlight,
    css,
}) => {
    // ========================================================================
    // Refs
    // ========================================================================

    const wrapperRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const wheelTimeoutRef = useRef<number | null>(null);
    const navigationIntentRef = useRef<{ goToLastPage: boolean } | null>(null);
    const positionDetectTimerRef = useRef<number | null>(null);

    // Restore state refs
    const restoreAnchorRef = useRef<{ blockId?: string; chapterIndex: number; chapterCharOffset?: number } | null>(null);
    const lastRestoreKeyRef = useRef<string>('');
    const restorePendingRef = useRef(false);
    
    // Save lock to prevent saving immediately after restoration (3 seconds)
    const saveLockUntilRef = useRef<number>(0);
    const SAVE_LOCK_DURATION_MS = 3000;

    // Drag/touch detection
    const isDraggingRef = useRef(false);
    const startPosRef = useRef({ x: 0, y: 0 });
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

    // Callback refs (prevent re-render loops)
    const onPositionUpdateRef = useRef(onPositionUpdate);
    const onRegisterSaveRef = useRef(onRegisterSave);
    const onToggleUIRef = useRef(onToggleUI);

    // Save scheduler ref
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
    // Initialization
    // ========================================================================

    // Initialize anchor from props once
    useEffect(() => {
        if (!restoreAnchorRef.current) {
            restoreAnchorRef.current = {
                blockId: initialProgress?.blockId,
                chapterIndex: initialProgress?.chapterIndex ?? initialChapter,
                chapterCharOffset: initialProgress?.chapterCharOffset,
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (initialProgress?.blockId) {
            saveSchedulerRef.current.setInitialSavedPosition(initialProgress.blockId);
        }
    }, []);

    // Reset restoration when initialProgress changes (for search/highlight navigation)
    const lastInitialProgressRef = useRef(initialProgress);
    useEffect(() => {
        const lastProgress = lastInitialProgressRef.current;
        const progressChanged = 
            (lastProgress?.blockId !== initialProgress?.blockId) ||
            (lastProgress?.chapterIndex !== initialProgress?.chapterIndex);
        
        if (progressChanged && initialProgress?.blockId) {
            console.log('[PagedReader] InitialProgress changed, resetting restoration');
            restoreAnchorRef.current = {
                blockId: initialProgress.blockId,
                chapterIndex: initialProgress.chapterIndex ?? initialChapter,
                chapterCharOffset: initialProgress.chapterCharOffset,
            };
            lastRestoreKeyRef.current = '';
            restorePendingRef.current = false;
        }
        
        lastInitialProgressRef.current = initialProgress;
    }, [initialProgress?.blockId, initialProgress?.chapterIndex, initialProgress?.chapterCharOffset, initialChapter]);

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

    // Update save scheduler when bookId changes
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

    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [currentSection, setCurrentSection] = useState(initialChapter);
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [totalPages, setTotalPages] = useState(1);
    const [contentReady, setContentReady] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [measuredPageSize, setMeasuredPageSize] = useState<number>(0);
    const [currentProgress, setCurrentProgress] = useState(initialProgress?.totalProgress || 0);
    const [currentPosition, setCurrentPosition] = useState<SaveablePosition | null>(null);
    const [renderPhase, setRenderPhase] = useState<'measuring' | 'ready'>('measuring');
    const [chunkPages, setChunkPages] = useState<{ startPage: number, endPage: number, startOffset: number, html: string }[]>([]);
    const [disableChunkTransition, setDisableChunkTransition] = useState(false);
    
    const currentHtml = useMemo(() => chapters[currentSection] || '', [chapters, currentSection]);

    // Apply highlights to the HTML
    const highlightedHtml = useMemo(() => {
        if (!highlights || highlights.length === 0) return currentHtml;
        
        const chapterHighlights = highlights.filter(h => h.chapterIndex === currentSection);
        if (chapterHighlights.length === 0) return currentHtml;
        
        return applyHighlightsToHtml(currentHtml, chapterHighlights, currentSection);
    }, [currentHtml, highlights, currentSection]);

    
    // ========================================================================
    // Simple Derived Values
    // ========================================================================

    const theme = useMemo(
        () => getReaderTheme(settings.lnTheme),
        [settings.lnTheme]
    );

    const navOptions = useMemo(
        () => ({ isVertical, isRTL, isPaged: true }),
        [isVertical, isRTL]
    );

    const safeInsets = useMemo(
        () => ({
            top: safeAreaInsetsPx?.top ?? safeAreaTopOffsetPx,
            right: safeAreaInsetsPx?.right ?? 0,
            bottom: safeAreaInsetsPx?.bottom ?? 0,
            left: safeAreaInsetsPx?.left ?? 0,
        }),
        [safeAreaInsetsPx?.bottom, safeAreaInsetsPx?.left, safeAreaInsetsPx?.right, safeAreaInsetsPx?.top, safeAreaTopOffsetPx],
    );

    const { tryLookup } = useTextLookup();

    // ========================================================================
    // Layout Key (Detects when layout changes require restore)
    // ========================================================================

    const layoutKey = useMemo(() => {
        return JSON.stringify({
            isVertical,
            isRTL,
            fontSize: settings.lnFontSize,
            lineHeight: settings.lnLineHeight,
            letterSpacing: settings.lnLetterSpacing,
            fontFamily: settings.lnFontFamily,
            textAlign: settings.lnTextAlign,
            furigana: settings.lnEnableFurigana,
            pageMargin: settings.lnPageMargin,
            marginTop: settings.lnMarginTop,
            marginBottom: settings.lnMarginBottom,
            marginLeft: settings.lnMarginLeft,
            marginRight: settings.lnMarginRight,
        });
    }, [
        isVertical, isRTL,
        settings.lnFontSize, settings.lnLineHeight, settings.lnLetterSpacing,
        settings.lnFontFamily, settings.lnTextAlign, settings.lnEnableFurigana,
        settings.lnPageMargin, settings.lnMarginTop, settings.lnMarginBottom,
        settings.lnMarginLeft, settings.lnMarginRight,
    ]);
 useEffect(() => {
        setRenderPhase('measuring');
    }, [currentSection, layoutKey]);
    // ========================================================================
    // Layout Calculation
    // ========================================================================

    const layout = useMemo(() => {
        if (dimensions.width === 0 || dimensions.height === 0) return null;

        const gap = 40;

        const marginTop = settings.lnMarginTop ?? 0;
        const marginBottom = settings.lnMarginBottom ?? 0;
        const marginLeft = settings.lnMarginLeft ?? 0;
        const marginRight = settings.lnMarginRight ?? 0;

        // Calculate available space AFTER margins
        const totalHorizontalMargin = marginLeft + marginRight + safeInsets.left + safeInsets.right;
        const totalVerticalMargin = marginTop + marginBottom + safeInsets.top + safeInsets.bottom;

        const contentW = dimensions.width - totalHorizontalMargin;
        const contentH = dimensions.height - totalVerticalMargin;

        const columnWidth = isVertical ? contentH : contentW;

        return {
            gap,
            contentW,
            contentH,
            columnWidth,
            margins: {
                top: marginTop,
                right: marginRight,
                bottom: marginBottom,
                left: marginLeft,
            },
        };
    }, [
    dimensions, 
    settings.lnMarginTop, 
    settings.lnMarginBottom, 
    settings.lnMarginLeft, 
    settings.lnMarginRight,
    isVertical, 
    safeInsets.top,
    safeInsets.right,
    safeInsets.bottom,
    safeInsets.left,
]);

    
  const isImageOnly = useMemo(() => {
        if (!highlightedHtml) return false;
        const text = highlightedHtml.replace(/<[^>]*>/g, '').trim();
        return text.length < 5 && /<img|<svg/i.test(highlightedHtml);
    }, [highlightedHtml]);
    const typographyStyles = useMemo(
        () => buildTypographyStyles(settings, isVertical),
        [settings, isVertical]
    );


    // ========================================================================
    // Register Save Function with Parent
    // ========================================================================

    useEffect(() => {
        const saveNow = saveSchedulerRef.current.saveNow;
        onRegisterSaveRef.current?.(saveNow);
    }, []);

    // ========================================================================
    // Resize Observer
    // ========================================================================

    useEffect(() => {
        const updateDimensions = () => {
            if (wrapperRef.current) {
                const rect = wrapperRef.current.getBoundingClientRect();
                // iOS Safari fix
                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                const height = isSafari ? window.innerHeight : rect.height;

                setDimensions({
                    width: Math.floor(rect.width),
                    height: Math.floor(height),
                });
            }
        };

        updateDimensions();

        const resizeObserver = new ResizeObserver(updateDimensions);
        if (wrapperRef.current) {
            resizeObserver.observe(wrapperRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    // Update dimensions on direction change
    useEffect(() => {
        if (wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            setDimensions({
                width: Math.floor(rect.width),
                height: Math.floor(rect.height),
            });
        }
    }, [isVertical]);

    // ========================================================================
    // Page Calculation and Restoration
    // ========================================================================

    useLayoutEffect(() => {
    if (!contentRef.current || !layout) return;
    if (renderPhase === 'ready') return;

    let cancelled = false;

    const calculatePages = async () => {
        setContentReady(false);

        const content = contentRef.current;
        if (!content || cancelled) return;

        // Wait for fonts
        if (document.fonts) {
            try { await document.fonts.ready; } catch (error) {}
        }
        if (cancelled) return;

        // Wait for images
        const images = content.querySelectorAll('img');
        const imagePromises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>(resolve => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(resolve, 100);
            });
        });
        await Promise.all(imagePromises);
        if (cancelled) return;

        // Wait for layout to settle
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (cancelled) return;

        const currentContent = contentRef.current;
        if (!currentContent) return;

        void currentContent.offsetHeight;
        void currentContent.scrollWidth;

        const computedStyle = window.getComputedStyle(currentContent);
        const actualColumnWidth = parseFloat(computedStyle.columnWidth) || layout.columnWidth;
        const actualGap = parseFloat(computedStyle.columnGap) || layout.gap;
        const actualPageSize = actualColumnWidth + actualGap;

        setMeasuredPageSize(actualPageSize);

        const containerRect = currentContent.getBoundingClientRect();

        // Calculate total pages
        const scrollSize = isVertical ? currentContent.scrollHeight : currentContent.scrollWidth;
        let calculatedPages = 1;
        if (scrollSize > actualColumnWidth && !isImageOnly) {
            let pages = Math.ceil(scrollSize / actualPageSize);
            
            if (scrollSize % actualPageSize < 5 && pages > 1) {
                pages -= 1;
            }
            
            calculatedPages = Math.max(1, pages);
        }

        // ====================================================================
        // NEW: Build page map by measuring where the browser placed each block
        // ====================================================================
        
        const innerContainer = currentContent.querySelector('.paged-content-inner');
        const newPageMap: { startPage: number; endPage: number; startOffset: number; html: string }[] = [];

        if (innerContainer && !isImageOnly) {
            const allBlocks = Array.from(innerContainer.querySelectorAll('[data-block-id]'));
            
            if (allBlocks.length > 0) {
                // Step 1: Map each block to its actual page (as determined by the browser)
                const blockPageMap = new Map<Element, number>();

                allBlocks.forEach(block => {
                    const rect = block.getBoundingClientRect();
                    const offset = isVertical 
                        ? rect.top - containerRect.top 
                        : rect.left - containerRect.left;
                    
                    const pageIndex = Math.floor(Math.abs(offset) / actualPageSize);
                    blockPageMap.set(block, Math.min(pageIndex, calculatedPages - 1));
                });

                // Step 2: Group blocks by page and extract HTML
                for (let page = 0; page < calculatedPages; page++) {
    const blocksOnPage = allBlocks.filter(b => blockPageMap.get(b) === page);
    
    // Only create a page entry if there are blocks on it
    if (blocksOnPage.length > 0) {
        const pageHtml = blocksOnPage.map(b => b.outerHTML).join('');
        
        newPageMap.push({
            startPage: page,
            endPage: page,
            startOffset: page * actualPageSize,
            html: pageHtml
        });
    }
}

// Update calculatedPages to match actual pages with content
if (newPageMap.length > 0) {
    calculatedPages = newPageMap.length;
    
    // Renumber pages sequentially (in case we skipped empty ones)
    newPageMap.forEach((entry, index) => {
        entry.startPage = index;
        entry.endPage = index;
        entry.startOffset = index * actualPageSize;
    });
}
            } else {
                // No blocks found - treat entire content as one page
                newPageMap.push({
                    startPage: 0,
                    endPage: calculatedPages - 1,
                    startOffset: 0,
                    html: highlightedHtml
                });
            }
        } else {
            // Image-only or no inner container - single entry for all pages
            newPageMap.push({
                startPage: 0,
                endPage: calculatedPages - 1,
                startOffset: 0,
                html: highlightedHtml
            });
        }

        setChunkPages(newPageMap);
        setTotalPages(calculatedPages);

        // ====================================================================
        // RESTORATION LOGIC 
        // ====================================================================
        
        const restoreKey = `${currentSection}|${layoutKey}|${actualPageSize}|${calculatedPages}`;
        const anchor = restoreAnchorRef.current;
        const intent = navigationIntentRef.current;
        
        if (intent) {
            navigationIntentRef.current = null;
            
            if (intent.goToLastPage) {
                setCurrentPage(calculatedPages - 1);
            } else {
                setCurrentPage(0);
            }
            
            lastRestoreKeyRef.current = restoreKey;
            saveLockUntilRef.current = Date.now() + SAVE_LOCK_DURATION_MS;
            restorePendingRef.current = false;
        }
        else if (restoreKey !== lastRestoreKeyRef.current) {
            restorePendingRef.current = true;
            const anchorBlockId = anchor?.blockId;
            let restored = false;

            if (anchorBlockId && anchor?.chapterIndex === currentSection) {
                let blockEl = currentContent.querySelector(`[data-block-id="${anchorBlockId}"]`) as HTMLElement | null;

                if (!blockEl && stats?.blockMaps && anchor?.chapterCharOffset) {
                    const chapterLookup = createChapterBlockLookup(stats.blockMaps, currentSection);
                    const pos = getPositionFromCharOffset(chapterLookup, anchor.chapterCharOffset);
                    if (pos) {
                        blockEl = currentContent.querySelector(`[data-block-id="${pos.blockId}"]`) as HTMLElement | null;
                    }
                }

                if (blockEl) {
                    const blockRect = blockEl.getBoundingClientRect();
                    const contentRect = currentContent.getBoundingClientRect();
                    const offset = isVertical ? (blockRect.top - contentRect.top) : (blockRect.left - contentRect.left);
                    const targetPage = Math.floor(Math.abs(offset) / actualPageSize);
                    
                    setCurrentPage(Math.max(0, Math.min(targetPage, calculatedPages - 1)));
                    saveLockUntilRef.current = Date.now() + SAVE_LOCK_DURATION_MS;
                    restored = true;
                }
            }
            
            if (!restored) {
                setCurrentPage(0);
            }

            lastRestoreKeyRef.current = restoreKey;
            requestAnimationFrame(() => { restorePendingRef.current = false; });
        } 
        else {
            setCurrentPage(p => Math.min(p, calculatedPages - 1));
        }

        // Switch to ready phase
        requestAnimationFrame(() => {
            if (cancelled) return;
            setIsTransitioning(false);
            setRenderPhase('ready');
            setContentReady(true);
        });
    };

    calculatePages();
    return () => { cancelled = true; };
}, [highlightedHtml, layout, isVertical, typographyStyles, renderPhase, isImageOnly, currentSection, layoutKey, stats]);
    // ========================================================================
    // --- ADD THE VIRTUALIZATION LOGIC RIGHT HERE ---
    // ========================================================================
   const activeChunk = useMemo(() => {
    if (renderPhase !== 'ready' || chunkPages.length === 0 || isImageOnly) return null;
    
    // For image-only or single-entry fallback, return the single entry
    if (chunkPages.length === 1 && chunkPages[0].endPage > chunkPages[0].startPage) {
        return chunkPages[0];
    }

    // Create a 3-page window: current page ± 1 buffer
    const bufferSize = 1;
    const startPage = Math.max(0, currentPage - bufferSize);
    const endPage = Math.min(totalPages - 1, currentPage + bufferSize);

    // Get pages in the window range
    const pagesInWindow = chunkPages.filter(
        p => p.startPage >= startPage && p.startPage <= endPage
    );

    if (pagesInWindow.length === 0) {
        // Fallback: find closest page
        const closest = chunkPages.reduce((prev, curr) => {
            const prevDist = Math.abs(prev.startPage - currentPage);
            const currDist = Math.abs(curr.startPage - currentPage);
            return currDist < prevDist ? curr : prev;
        });
        return closest;
    }

    // Combine the HTML of all pages in the window
    const combinedHtml = pagesInWindow.map(p => p.html).join('');
    
    return {
        startPage,
        endPage,
        startOffset: startPage * (measuredPageSize > 0 ? measuredPageSize : (layout?.columnWidth || 0) + (layout?.gap || 40)),
        html: combinedHtml
    };
}, [renderPhase, chunkPages, currentPage, totalPages, isImageOnly, measuredPageSize, layout?.columnWidth, layout?.gap]);

    const prevChunkRef = useRef(activeChunk);
    useEffect(() => {
        if (activeChunk !== prevChunkRef.current) {
            setDisableChunkTransition(true);
            const timer = setTimeout(() => setDisableChunkTransition(false), 50);
            prevChunkRef.current = activeChunk;
            return () => clearTimeout(timer);
        }
    }, [activeChunk]);

    const displayHtml = activeChunk ? activeChunk.html : highlightedHtml;
    const displayLocalPage = activeChunk ? Math.max(0, currentPage - activeChunk.startPage) : currentPage;
const transform = useMemo(() => {
        const effectivePageSize = measuredPageSize > 0 ? measuredPageSize : (layout?.columnWidth || 0) + (layout?.gap || 80);
        
        let pageOffset = 0;
        
        if (activeChunk) {
         
            const globalPos = currentPage * effectivePageSize;
            pageOffset = globalPos - activeChunk.startOffset;
        } else {
            pageOffset = currentPage * effectivePageSize;
        }

        // Round to prevent sub-pixel blurring
        pageOffset = Math.round(pageOffset);

        return isVertical ? `translateY(-${pageOffset}px)` : `translateX(-${pageOffset}px)`;
    }, [currentPage, activeChunk, measuredPageSize, layout?.columnWidth, layout?.gap, isVertical]);
    
    const contentStyle = useMemo(() => {
        const brightness = settings.lnTextBrightness ?? 100;
        const textColor = brightness === 100 ? theme.fg : adjustBrightness(theme.fg, brightness);
        
        return {
            ...typographyStyles,
            color: textColor,
            columnWidth: `${layout?.columnWidth}px`,
            columnGap: `${layout?.gap}px`,
            columnFill: 'auto' as any,
            boxSizing: 'border-box' as any,
            overflowWrap: 'break-word' as any,
            wordBreak: 'break-word' as any,
            transform: renderPhase === 'measuring' ? 'none' : transform,
            scrollbarWidth: 'none' as any,
            '--ln-highlight-bg': (theme as any).highlight || 'rgba(255, 235, 59, 0.45)', // Pass theme highlight
        msOverflowStyle: 'none' as any,
            transition: (settings.lnDisableAnimations || disableChunkTransition || renderPhase === 'measuring')
                ? 'none'
                : 'transform 0.3s ease-out',
            willChange: 'transform',
            ...(isVertical
                ? {
                    writingMode: 'vertical-rl' as any,
                    textOrientation: 'mixed' as any,
                    width: `${layout?.contentW}px`,
                    height: 'auto',
                    minHeight: `${layout?.contentH}px`,
                }
                : {
                    height: `${layout?.contentH}px`,
                    width: 'auto',
                    minWidth: `${layout?.contentW}px`,
                }
            ),
        };
    },[typographyStyles, layout, transform, settings.lnDisableAnimations, disableChunkTransition, renderPhase, settings.lnTextBrightness, theme.fg, isVertical]);

    // ========================================================================
    // Position Detection
    // ========================================================================

    const detectAndReportPosition = useCallback(() => {
        // GUARD: Don't save position if a restore is pending
        if (restorePendingRef.current) return;

        // GUARD: Don't save if save is locked (after restoration)
        if (Date.now() < saveLockUntilRef.current) {
            console.log('[PagedReader] Save locked, skipping detection');
            return;
        }

        if (!contentReady || !viewportRef.current || !stats) return;

       const pageSize = measuredPageSize > 0
            ? measuredPageSize
            : (layout?.columnWidth || 0) + (layout?.gap || 80);

        if (pageSize <= 0) return;

       
        let localPageIndex = 0;
        if (activeChunk) {
             const globalPos = currentPage * pageSize;
             const localPos = globalPos - activeChunk.startOffset;
             localPageIndex = localPos / pageSize;
        } else {
             localPageIndex = currentPage;
        }

        const detected = detectVisibleBlockPaged(
            viewportRef.current,
            localPageIndex,
            pageSize,
            isVertical,
            currentSection,
            stats?.blockMaps
        );

        // Update the anchor for future restores
        restoreAnchorRef.current = {
            blockId: detected.blockId,
            chapterIndex: currentSection,
            chapterCharOffset: detected.chapterCharOffset,
        };

        // Extract context for restoration
        const contextSnippet = extractContextSnippet(
            detected.element as Element,
            detected.blockLocalOffset,
            20
        );

        // Calculate progress
        const progressCalc = calculateProgress(
            currentSection,
            detected.chapterCharOffset,
            stats
        );

        // Build position object
        const position: SaveablePosition = {
            blockId: detected.blockId,
            blockLocalOffset: detected.blockLocalOffset,
            contextSnippet,
            chapterIndex: currentSection,
            pageIndex: currentPage,
            chapterCharOffset: detected.chapterCharOffset,
            totalCharsRead: progressCalc.totalCharsRead,
            chapterProgress: progressCalc.chapterProgress,
            totalProgress: progressCalc.totalProgress,
            sentenceText: contextSnippet,
        };

        // Update local state
        setCurrentProgress(progressCalc.totalProgress);
        setCurrentPosition(position);

        // Schedule save
        saveSchedulerRef.current.scheduleSave(position);

        // Notify parent (via ref to prevent loops)
        onPositionUpdateRef.current?.({
            chapterIndex: currentSection,
            pageIndex: currentPage,
            chapterCharOffset: detected.chapterCharOffset,
            sentenceText: contextSnippet,
            totalProgress: progressCalc.totalProgress,
            blockId: detected.blockId,
        });

    }, [contentReady, stats, measuredPageSize, layout, currentPage, currentSection, isVertical, activeChunk]);

    // Detect position after page/chapter changes
    useEffect(() => {
        if (contentReady && !isTransitioning) {
            // Clear previous timer
            if (positionDetectTimerRef.current) {
                clearTimeout(positionDetectTimerRef.current);
            }

            // Delay to ensure transform has been applied
            positionDetectTimerRef.current = window.setTimeout(() => {
                detectAndReportPosition();
            }, POSITION_DETECT_DELAY_MS);

            return () => {
                if (positionDetectTimerRef.current) {
                    clearTimeout(positionDetectTimerRef.current);
                }
            };
        }
    }, [contentReady, isTransitioning, currentPage, currentSection, detectAndReportPosition]);

    
  
    // ========================================================================
    // Navigation
    // ========================================================================

    const goToPage = useCallback((page: number) => {
        const clamped = Math.max(0, Math.min(page, totalPages - 1));
        if (clamped !== currentPage) {
            setCurrentPage(clamped);
        }
    }, [totalPages, currentPage]);

    const goToSection = useCallback((section: number, goToLastPage = false) => {
        const clamped = Math.max(0, Math.min(section, chapters.length - 1));
        if (clamped === currentSection) return;

        // Save current position before switching
        saveSchedulerRef.current.saveNow();

        setIsTransitioning(true);
        setContentReady(false);
        // Clear restore key so we restore again in new chapter if needed
        lastRestoreKeyRef.current = '';
        navigationIntentRef.current = { goToLastPage };
        setCurrentSection(clamped);
        setCurrentPage(0);
    }, [chapters.length, currentSection]);

    const goNext = useCallback(() => {
        if (!contentReady || isTransitioning) return;

        if (currentPage < totalPages - 1) {
            goToPage(currentPage + 1);
        } else if (currentSection < chapters.length - 1) {
            goToSection(currentSection + 1, false);
        }
    }, [currentPage, totalPages, currentSection, chapters.length, goToPage, goToSection, contentReady, isTransitioning]);

    const goPrev = useCallback(() => {
        if (!contentReady || isTransitioning) return;

        if (currentPage > 0) {
            goToPage(currentPage - 1);
        } else if (currentSection > 0) {
            goToSection(currentSection - 1, true);
        }
    }, [currentPage, currentSection, goToPage, goToSection, contentReady, isTransitioning]);

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

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            touchStartRef.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
                time: Date.now(),
            };
        }
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        if (!contentReady || isTransitioning) return;
        if (!(settings.lnEnableSwipe ?? true)) return;

        const touch = touchStartRef.current;
        
        // Ignore swipes starting from bottom edge (system gesture area)
        const BOTTOM_EDGE_THRESHOLD = 100;
        if (touch.y > window.innerHeight - BOTTOM_EDGE_THRESHOLD) {
            touchStartRef.current = null;
            return;
        }
        
        touchStartRef.current = null;

        // Don't handle swipe if touching UI elements
        const target = e.target as HTMLElement;
        if (target.closest('.reader-progress-bar, .nav-btn, .dict-popup, .click-zone')) {
            return;
        }

        const deltaX = e.changedTouches[0].clientX - touch.x;
        const deltaY = e.changedTouches[0].clientY - touch.y;
        const deltaTime = Date.now() - touch.time;

        if (deltaTime > SWIPE_MAX_TIME) return;

        // VERTICAL SWIPE: Works in BOTH modes
        // Swipe UP = next, Swipe DOWN = prev
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > SWIPE_MIN_DISTANCE) {
            if (deltaY > 0) {
                goPrev(); // Swipe down = back
            } else {
                goNext(); // Swipe up = forward
            }
            return;
        }

        // HORIZONTAL SWIPE: Works in BOTH modes with inverted logic
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_MIN_DISTANCE) {
            if (isVertical) {
                // Vertical text mode: swipe right = next, swipe left = prev 
                if (deltaX > 0) {
                    goNext(); // Swipe right = forward
                } else {
                    goPrev(); // Swipe left = back
                }
            } else {
                // Horizontal text mode: swipe left = next, swipe right = prev 
                if (deltaX > 0) {
                    goPrev(); // Swipe right = back
                } else {
                    goNext(); // Swipe left = forward
                }
            }
        }
    }, [contentReady, isTransitioning, isVertical, isRTL, goNext, goPrev, settings.lnEnableSwipe]);

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

        // Try text lookup first (highest priority)
        const lookupSuccess = await tryLookup(e);
        if (lookupSuccess) return;

        // Check if click zones are enabled and detect zone click
        if (settings.lnEnableClickZones && wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            const zone = getClickZone(
                e.clientX,
                e.clientY,
                rect,
                isVertical,
                settings.lnClickZonePlacement ?? 'vertical',
                settings.lnClickZoneSize ?? 10,
                settings.lnClickZonePosition ?? 'full',
                settings.lnClickZoneCoverage ?? 60
            );
            
            if (zone === 'prev') {
                goPrev();
                return;
            }
            if (zone === 'next') {
                goNext();
                return;
            }
        }

        // Otherwise toggle UI
        onToggleUIRef.current?.();
    }, [tryLookup, settings.lnEnableClickZones, settings.lnClickZonePlacement, settings.lnClickZoneSize, settings.lnClickZonePosition, settings.lnClickZoneCoverage, isVertical, goPrev, goNext]);

    const navCallbacks: NavigationCallbacks = useMemo(() => ({
        goNext,
        goPrev,
        goToStart: () => goToPage(0),
        goToEnd: () => goToPage(totalPages - 1),
    }), [goNext, goPrev, goToPage, totalPages]);

    const handleSaveNow = useCallback(async (): Promise<boolean> => {
        return await saveSchedulerRef.current.saveNow();
    }, []);

    // ========================================================================
    // Keyboard Navigation
    // ========================================================================

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            if (!contentReady || isTransitioning) return;
            if (handleKeyNavigation(e, navOptions, navCallbacks)) {
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navOptions, navCallbacks, contentReady, isTransitioning]);

    // ========================================================================
    // EPUB Link Handler
    // ========================================================================

    useEffect(() => {
        const container = wrapperRef.current;
        if (!container) return;

        const handleEpubLink = (event: Event) => {
            const customEvent = event as CustomEvent<{ href: string }>;
            const href = customEvent.detail.href;
            const [filename, anchor] = href.split('#');

            // Find chapter by filename
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

            if (chapterIndex !== -1 && chapterIndex < chapters.length) {
                if (chapterIndex === currentSection && anchor) {
                    // Same chapter, scroll to anchor
                    setTimeout(() => {
                        const element = document.getElementById(anchor);
                        if (element && contentRef.current && measuredPageSize > 0) {
                            const rect = element.getBoundingClientRect();
                            const contentRect = contentRef.current.getBoundingClientRect();
                            const offset = isVertical
                                ? rect.top - contentRect.top
                                : rect.left - contentRect.left;
                            const targetPage = Math.floor(Math.abs(offset) / measuredPageSize);
                            goToPage(Math.max(0, Math.min(targetPage, totalPages - 1)));
                        }
                    }, 100);
                } else {
                    // Different chapter
                    goToSection(chapterIndex, false);

                    if (anchor) {
                        setTimeout(() => {
                            const element = document.getElementById(anchor);
                            if (element && contentRef.current && measuredPageSize > 0) {
                                const rect = element.getBoundingClientRect();
                                const contentRect = contentRef.current.getBoundingClientRect();
                                const offset = isVertical
                                    ? rect.top - contentRect.top
                                    : rect.left - contentRect.left;
                                const targetPage = Math.floor(Math.abs(offset) / measuredPageSize);
                                goToPage(Math.max(0, Math.min(targetPage, totalPages - 1)));
                            }
                        }, 500);
                    }
                }
            }
        };

        container.addEventListener('epub-link-clicked', handleEpubLink);
        return () => container.removeEventListener('epub-link-clicked', handleEpubLink);
    }, [chapters.length, goToSection, chapterFilenames, currentSection, goToPage, isVertical, measuredPageSize, totalPages]);

    // ========================================================================
    // Wheel Handler
    // ========================================================================

    
useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let lastWheelTime = 0;
    const wheelDebounce = 300;

    const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        
        if (isTransitioning || !contentReady) return;

        const now = Date.now();
        if (now - lastWheelTime < wheelDebounce) return;

        const delta = e.deltaY;
        
        if (Math.abs(delta) > 20) {
            lastWheelTime = now;
            
            
            if (delta > 0) {
                goNext();
            } else {
                goPrev();
            }
        }
    };

    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
        wrapper.removeEventListener('wheel', handleWheel);
    };
}, [goNext, goPrev, isTransitioning, contentReady]);

    // ========================================================================
    // Visibility Change Handler (Save on Hide)
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
            // Cancel pending timers
            if (positionDetectTimerRef.current) {
                clearTimeout(positionDetectTimerRef.current);
            }
            if (wheelTimeoutRef.current) {
                clearTimeout(wheelTimeoutRef.current);
            }

            // Force save on unmount
            saveSchedulerRef.current.saveNow();
        };
    }, []);

    // ========================================================================
    // Early Return
    // ========================================================================

    if (!layout) {
        return (
            <div
                ref={wrapperRef}
                className="paged-reader-wrapper"
                style={{ backgroundColor: theme.bg }}
            />
        );
    }

    // ========================================================================
    // Render
    // ========================================================================

    // Calculate derived values for rendering
    const effectivePageSize = measuredPageSize > 0
        ? measuredPageSize
        : (layout?.columnWidth || 0) + (layout?.gap || 80);

    const pageProgressPercent = totalPages > 0
        ? ((currentPage + 1) / totalPages) * 100
        : 0;

    const handleUpdateSettings = onUpdateSettings ?? (() => {});

    const wrapperStyle = {
        backgroundColor: theme.bg,
        color: theme.fg,
    };

    return (
        <div
    ref={wrapperRef}
    className="paged-reader-wrapper"
    style={wrapperStyle}
    data-dark-mode={settings.lnTheme === 'dark' || settings.lnTheme === 'black'}
>
            {/* Dynamic image sizing */}
            <style>{`
                .paged-content img {
                    max-width: 100vw !important;
                    max-height: ${layout ? layout.contentH : 1000}px;
                    width: auto;
                    height: auto;
                    display: block;
                    object-fit: contain;
                }
            `}</style>

            {/* Outer margin container - STATIC */}
            <div
    className="paged-margin-container"
    style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        paddingTop: `${(isImageOnly ? 0 : layout?.margins.top ?? 0) + safeInsets.top}px`,
        paddingRight: `${(isImageOnly ? 0 : layout?.margins.right ?? 0) + safeInsets.right}px`,
        paddingBottom: `${(isImageOnly ? 0 : layout?.margins.bottom ?? 0) + safeInsets.bottom}px`,
        paddingLeft: `${(isImageOnly ? 0 : layout?.margins.left ?? 0) + safeInsets.left}px`,
    }}
    onClick={handleContentClick}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onTouchStart={handleTouchStart}
    onTouchEnd={handleTouchEnd}
>
    {/* Viewport - no handlers needed here now */}
    <div
        ref={viewportRef}
        className="paged-viewport"
    >
        {/* Content */}
        <div
            ref={contentRef}
            className={`paged-content ${!settings.lnEnableFurigana ? 'furigana-hidden' : ''} ${isImageOnly ? 'image-only-chapter' : ''}`}
            style={{ ...contentStyle, opacity: renderPhase === 'measuring' ? 0 : 1 }}
        >
            {css && <style>{`@scope { \n${css}\n }`}</style>}
            <div className="paged-content-inner" dangerouslySetInnerHTML={{ __html: displayHtml }} />
        </div>
    </div>
</div>

            {/* Loading Overlay */}
            {(!contentReady || isTransitioning) && (
                <div
                    className="paged-loading"
                    style={{ backgroundColor: theme.bg, color: theme.fg }}
                >
                    <div className="loading-spinner" />
                </div>
            )}

            <SelectionHandles 
                containerRef={contentRef}
                enabled={contentReady && !isTransitioning}
                theme={(settings.lnTheme as 'light' | 'sepia' | 'dark' | 'black') || 'dark'}
                onSelectionComplete={(text, startOffset, endOffset, blockId) => {
                    if (onAddHighlight && currentSection && blockId) {
                        onAddHighlight(currentSection, blockId, text, startOffset, endOffset);
                    }
                }}
            />

            {/* Click Zones - Visual Debug Only */}
            {contentReady && (
                <ClickZones
                    isVertical={isVertical}
                    canGoNext={currentPage < totalPages - 1 || currentSection < chapters.length - 1}
                    canGoPrev={currentPage > 0 || currentSection > 0}
                    zoneSize={settings.lnClickZoneSize ?? 10}
                    zonePosition={settings.lnClickZonePosition ?? 'full'}
                    zoneCoverage={settings.lnClickZoneCoverage ?? 60}
                    zonePlacement={settings.lnClickZonePlacement ?? 'vertical'}
                    visible={showNavigation}
                    debugMode={settings.debugMode}
                />
            )}

            {contentReady && (
                <ReaderNavigationUI
                    visible={showNavigation}
                    onNext={goNext}
                    onPrev={goPrev}
                    canGoNext={currentPage < totalPages - 1 || currentSection < chapters.length - 1}
                    canGoPrev={currentPage > 0 || currentSection > 0}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    currentChapter={currentSection}
                    totalChapters={chapters.length}
                    progress={pageProgressPercent}
                    totalBookProgress={currentProgress}
                    showSlider={totalPages > 1}
                    onPageChange={goToPage}
                    theme={theme}
                    isVertical={isVertical}
                    mode="paged"
                    currentPosition={currentPosition ?? undefined}
                    bookStats={stats ?? undefined}
                    settings={settings}
                    onUpdateSettings={onUpdateSettings}
                    isSaved={isSaved}
                    onSaveNow={handleSaveNow}
                />
            )}
        </div>
    );
};
