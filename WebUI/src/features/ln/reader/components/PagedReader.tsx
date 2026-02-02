import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Settings } from '@/Manatan/types';
import { ReaderNavigationUI } from './ReaderNavigationUI';
import { useReaderCore } from '../hooks/useReaderCore';
import { buildTypographyStyles } from '../utils/styles';
import { handleKeyNavigation, NavigationCallbacks } from '../utils/navigation';
import { PagedReaderProps } from '../types/reader';
import './PagedReader.css';

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
    onPositionUpdate,
    onRegisterSave,
    onUpdateSettings,
    chapterFilenames = [],
}) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const wheelTimeoutRef = useRef<number | null>(null);

    // --- State ---
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [currentSection, setCurrentSection] = useState(initialChapter);
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [totalPages, setTotalPages] = useState(1);
    const [contentReady, setContentReady] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [effectivePageSize, setEffectivePageSize] = useState(0);

    // --- 1. UNIFIED CALCULATION SOURCE ---
    const layout = useMemo(() => {
        if (dimensions.width === 0 || dimensions.height === 0) return null;

        const gap = 80;
        const padding = settings.lnPageMargin || 24;

        const contentW = dimensions.width - (padding * 2);
        const contentH = dimensions.height - (padding * 2);

        const columnWidth = isVertical ? contentH : contentW;

        // Keep original pageSize calculation
        const pageSize = columnWidth + gap;

        return {
            gap,
            padding,
            width: dimensions.width,
            height: dimensions.height,
            contentW,
            contentH,
            columnWidth,
            pageSize
        };
    }, [dimensions, settings.lnPageMargin, isVertical]);

    const currentHtml = useMemo(
        () => chapters[currentSection] || '',
        [chapters, currentSection]
    );

    const typographyStyles = useMemo(() =>
        buildTypographyStyles(settings, isVertical),
        [settings, isVertical]);

    const {
        theme,
        navOptions,
        currentProgress,
        currentPosition,
        reportChapterChange,
        reportPageChange,
        handleContentClick,
        touchHandlers,
    } = useReaderCore({
        bookId,
        chapters,
        stats,
        settings,
        containerRef: wrapperRef,
        isVertical,
        isRTL,
        isPaged: true,
        currentChapter: currentSection,
        currentPage,
        totalPages,
        initialProgress,
        onToggleUI,
        onPositionUpdate,
        onRegisterSave,
    });

    // --- Resize Observer ---
    useEffect(() => {
        const updateDimensions = () => {
            if (wrapperRef.current) {
                const rect = wrapperRef.current.getBoundingClientRect();

                // iOS Safari fix: account for dynamic UI bars
                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                const height = isSafari
                    ? window.innerHeight
                    : rect.height;

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

    // Calculate total pages
    const navigationIntentRef = useRef<{ goToLastPage: boolean } | null>(null);

    // --- Page Calculation Logic ---
    useEffect(() => {
        if (!contentRef.current || !layout) return;

        let cancelled = false;

        const calculatePages = async () => {
            setContentReady(false);

            const content = contentRef.current;
            if (!content || cancelled) return;

            // Wait for fonts to be ready
            if (document.fonts) {
                try {
                    await document.fonts.ready;
                } catch (error) {
                    console.warn('Font loading check failed:', error);
                }
            }

            if (cancelled) return;

            const images = content.querySelectorAll('img');

            const imagePromises = Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise<void>(resolve => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                    setTimeout(resolve, 50);
                });
            });

            await Promise.all(imagePromises);

            if (cancelled) return;

            requestAnimationFrame(() => {
                const currentContent = contentRef.current;
                if (cancelled || !currentContent) return;

                // Force Reflow
                void currentContent.offsetHeight;

                const scrollSize = isVertical ? currentContent.scrollHeight : currentContent.scrollWidth;
                const computedStyle = window.getComputedStyle(currentContent);

                // Get the ACTUAL column width from browser
                const actualColumnWidth = parseFloat(computedStyle.columnWidth) || layout.columnWidth;
                const actualGap = parseFloat(computedStyle.columnGap) || layout.gap;
                const actualPageSize = actualColumnWidth + actualGap;

                // Store the browser's actual page size for transform calculations
                setEffectivePageSize(actualPageSize);

                // Smarter page calculation to avoid ghost pages
                let calculatedPages = 1;
                const threshold = actualPageSize * 0.1; // Need 10% overhang for new page

                if (scrollSize > actualPageSize + threshold) {
                    const rawPages = scrollSize / actualPageSize;
                    const lastPageFill = rawPages % 1; // Fraction of last page used

                    // If last page is less than 5% full, it's likely a rounding artifact
                    if (lastPageFill > 0 && lastPageFill < 0.05) {
                        calculatedPages = Math.max(1, Math.floor(rawPages));
                    } else {
                        calculatedPages = Math.max(1, Math.ceil(rawPages));
                    }
                }

                setTotalPages(calculatedPages);

                const intent = navigationIntentRef.current;
                navigationIntentRef.current = null;

                if (intent?.goToLastPage) {
                    setCurrentPage(calculatedPages - 1);
                } else {
                    setCurrentPage(p => Math.min(p, calculatedPages - 1));
                }

                requestAnimationFrame(() => {
                    if (cancelled) return;
                    setIsTransitioning(false);
                    setContentReady(true);
                });
            });
        };

        calculatePages();

        return () => {
            cancelled = true;
        };
    }, [currentHtml, layout, isVertical, typographyStyles, settings]);

    useEffect(() => {
        if (wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            setDimensions({
                width: Math.floor(rect.width),
                height: Math.floor(rect.height),
            });
        }
    }, [isVertical]);

    // --- Reporting ---
    useEffect(() => {
        if (contentReady && !isTransitioning) {
            reportPageChange(currentPage, totalPages);
        }
    }, [currentPage, totalPages, contentReady, isTransitioning, reportPageChange]);

    // --- Navigation ---
    const goToPage = useCallback((page: number) => {
        const clamped = Math.max(0, Math.min(page, totalPages - 1));
        if (clamped !== currentPage) setCurrentPage(clamped);
    }, [totalPages, currentPage]);

    const goToSection = useCallback((section: number, goToLastPage = false) => {
        const clamped = Math.max(0, Math.min(section, chapters.length - 1));
        if (clamped === currentSection) return;

        setIsTransitioning(true);
        setContentReady(false);
        navigationIntentRef.current = { goToLastPage };
        setCurrentSection(clamped);
        setCurrentPage(0);
        reportChapterChange(clamped, goToLastPage ? -1 : 0);
    }, [chapters.length, currentSection, reportChapterChange]);

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

    // Keyboard navigation
    const navCallbacks: NavigationCallbacks = useMemo(() => ({
        goNext,
        goPrev,
        goToStart: () => goToPage(0),
        goToEnd: () => goToPage(totalPages - 1),
    }), [goNext, goPrev, goToPage, totalPages]);

    // --- Inputs ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            if (!contentReady || isTransitioning) return;
            if (handleKeyNavigation(e, navOptions, navCallbacks)) e.preventDefault();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navOptions, navCallbacks, contentReady, isTransitioning]);
    useEffect(() => {
        const container = wrapperRef.current;
        if (!container) return;

        const handleEpubLink = (event: Event) => {
            const customEvent = event as CustomEvent<{ href: string }>;
            const href = customEvent.detail.href;

            const [filename, anchor] = href.split('#');

            let chapterIndex = chapterFilenames.indexOf(filename);

            if (chapterIndex === -1) {
                chapterIndex = chapterFilenames.findIndex(fn => {
                    return fn.endsWith(filename) || fn.endsWith('/' + filename);
                });
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
                    setTimeout(() => {
                        const element = document.getElementById(anchor);
                        if (element && contentRef.current && layout) {
                            const rect = element.getBoundingClientRect();
                            const contentRect = contentRef.current.getBoundingClientRect();

                            const offset = isVertical
                                ? rect.top - contentRect.top
                                : rect.left - contentRect.left;

                            const pageSize = effectivePageSize || layout.pageSize;
                            const targetPage = Math.floor(Math.abs(offset) / pageSize);

                            goToPage(Math.max(0, Math.min(targetPage, totalPages - 1)));
                        }
                    }, 100);
                } else {
                    goToSection(chapterIndex, false);

                    if (anchor) {
                        setTimeout(() => {
                            const element = document.getElementById(anchor);
                            if (element && contentRef.current && layout) {
                                const rect = element.getBoundingClientRect();
                                const contentRect = contentRef.current.getBoundingClientRect();

                                const offset = isVertical
                                    ? rect.top - contentRect.top
                                    : rect.left - contentRect.left;

                                const pageSize = effectivePageSize || layout.pageSize;
                                const targetPage = Math.floor(Math.abs(offset) / pageSize);

                                goToPage(Math.max(0, Math.min(targetPage, totalPages - 1)));
                            }
                        }, 500);
                    }
                }
            }
        };

        container.addEventListener('epub-link-clicked', handleEpubLink);

        return () => {
            container.removeEventListener('epub-link-clicked', handleEpubLink);
        };
    }, [chapters.length, goToSection, chapterFilenames, currentSection, goToPage, isVertical, layout, effectivePageSize, totalPages]);

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (wheelTimeoutRef.current || isTransitioning || !contentReady) return;
            const delta = isVertical ? e.deltaY : e.deltaX || e.deltaY;
            if (Math.abs(delta) > 20) {
                if (delta > 0) goNext();
                else goPrev();
                wheelTimeoutRef.current = window.setTimeout(() => wheelTimeoutRef.current = null, 200);
            }
        };
        wrapper.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            wrapper.removeEventListener('wheel', handleWheel);
            if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
        };
    }, [isVertical, goNext, goPrev, isTransitioning, contentReady]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (isTransitioning || !contentReady) return;
        touchHandlers.handleTouchEnd(e, navCallbacks);
    }, [touchHandlers, navCallbacks, isTransitioning, contentReady]);

    // --- Early Return ---
    if (!layout) {
        return <div ref={wrapperRef} className="paged-reader-wrapper" style={{ backgroundColor: theme.bg }} />;
    }

    // --- Render Logic ---
    // Use browser's actual page size, fallback to JS calculation
    const pageOffset = currentPage === -1
        ? 0
        : Math.round(currentPage * (effectivePageSize || layout.pageSize));

    const transform = isVertical
        ? `translateY(-${pageOffset}px)`
        : `translateX(-${pageOffset}px)`;

    const progressPercent = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0;

    return (
        <div
            ref={wrapperRef}
            className="paged-reader-wrapper"
            style={{ backgroundColor: theme.bg, color: theme.fg }}
        >
            <style>{`
                .paged-content img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                }
            `}</style>

            <div
                className="paged-viewport"
                style={{
                    position: 'absolute',
                    inset: 0,
                    overflow: 'hidden',
                    clipPath: 'inset(0px)',
                }}
                onClick={handleContentClick}
                onPointerDown={touchHandlers.handlePointerDown}
                onPointerMove={touchHandlers.handlePointerMove}
                onTouchStart={touchHandlers.handleTouchStart}
                onTouchMove={touchHandlers.handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div
                    ref={contentRef}
                    className={`paged-content ${!settings.lnEnableFurigana ? 'furigana-hidden' : ''}`}
                    style={{
                        ...typographyStyles,

                        padding: `${layout.padding}px`,
                        columnWidth: `${layout.columnWidth}px`,
                        columnGap: `${layout.gap}px`,
                        columnRule: `${layout.gap}px solid ${theme.bg}`,
                        columnFill: 'auto',

                        boxSizing: 'border-box',
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',

                        transform: transform,
                        transition: settings.lnDisableAnimations
                            ? 'none'
                            : 'transform 0.3s ease-out',
                        willChange: 'transform',

                        ...(isVertical
                            ? {
                                width: `${layout.width}px`,
                                height: 'auto',
                                minHeight: `${layout.height}px`,
                            }
                            : {
                                height: `${layout.height}px`,
                                width: 'auto',
                                minWidth: `${layout.width}px`,
                            }),
                    }}
                    dangerouslySetInnerHTML={{ __html: currentHtml }}
                />
            </div>

            {(!contentReady || isTransitioning) && (
                <div
                    className="paged-loading"
                    style={{ backgroundColor: theme.bg, color: theme.fg }}
                >
                    <div className="loading-spinner" />
                </div>
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
                    progress={progressPercent}
                    totalBookProgress={currentProgress}
                    showSlider={totalPages > 1}
                    onPageChange={goToPage}
                    theme={theme}
                    isVertical={isVertical}
                    mode="paged"
                    currentPosition={currentPosition}
                    bookStats={stats}
                    settings={settings}
                    onUpdateSettings={onUpdateSettings}
                />
            )}
        </div>
    );
};