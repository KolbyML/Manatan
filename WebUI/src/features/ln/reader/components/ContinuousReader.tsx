

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ReaderNavigationUI } from './ReaderNavigationUI';
import { ChapterBlock } from './ChapterBlock';
import { useReaderCore } from '../hooks/useReaderCore';
import { useChapterLoader } from '../hooks/useChapterLoader';
import { buildContainerStyles } from '../utils/styles';
import { calculateProgress } from '../utils/navigation';
import { ContinuousReaderProps } from '../types/reader';
import './ContinuousReader.css';

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
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const lastReportedChapter = useRef(initialChapter);

    const [currentChapter, setCurrentChapter] = useState(initialChapter);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [contentLoaded, setContentLoaded] = useState(false);


    const {
        theme,
        navOptions,
        isReady,
        currentProgress,
        currentPosition,
        reportScroll,
        reportChapterChange,
        handleContentClick,
        touchHandlers,
    } = useReaderCore({
        bookId,
        chapters,
        stats,
        settings,
        containerRef,
        isVertical,
        isRTL,
        isPaged: false,
        currentChapter,
        initialProgress,
        onToggleUI,
        onPositionUpdate,
        onRegisterSave,
        onRestoreComplete: () => {
            console.log('[Continuous] Position restored');
        },
    });


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


    const findCurrentChapter = useCallback((): number => {
        const content = contentRef.current;
        const container = containerRef.current;
        if (!content || !container) return 0;

        const chapterElements = content.querySelectorAll('[data-chapter]');
        const containerRect = container.getBoundingClientRect();

        let bestChapter = 0;
        let bestScore = -Infinity;

        const viewportCenter = isVertical
            ? containerRect.left + containerRect.width / 2
            : containerRect.top + containerRect.height / 2;

        chapterElements.forEach((el) => {
            const rect = el.getBoundingClientRect();
            const chapterIndex = parseInt(el.getAttribute('data-chapter') || '0', 10);

            const isVisible = isVertical
                ? rect.right > containerRect.left && rect.left < containerRect.right
                : rect.bottom > containerRect.top && rect.top < containerRect.bottom;

            if (!isVisible) return;

            const chapterCenter = isVertical
                ? rect.left + rect.width / 2
                : rect.top + rect.height / 2;
            const score = -Math.abs(viewportCenter - chapterCenter);

            if (score > bestScore) {
                bestScore = score;
                bestChapter = chapterIndex;
            }
        });

        return bestChapter;
    }, [isVertical]);


    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let rafId: number;
        let debounceTimer: number;

        const handleScroll = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const progress = calculateProgress(container, navOptions);
                setScrollProgress(progress);
            });

            clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(() => {
                const chapter = findCurrentChapter();

                if (chapter !== lastReportedChapter.current) {
                    lastReportedChapter.current = chapter;
                    setCurrentChapter(chapter);
                    reportChapterChange(chapter);
                    loadChaptersAround(chapter);
                } else {
                    reportScroll();
                }
            }, 150);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });

        const initialTimer = setTimeout(() => {
            reportScroll();
        }, 300);

        return () => {
            container.removeEventListener('scroll', handleScroll);
            cancelAnimationFrame(rafId);
            clearTimeout(debounceTimer);
            clearTimeout(initialTimer);
        };
    }, [
        navOptions,
        findCurrentChapter,
        reportScroll,
        reportChapterChange,
        loadChaptersAround,
    ]);

    useEffect(() => {
        const container = containerRef.current;
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

        return () => {
            container.removeEventListener('epub-link-clicked', handleEpubLink);
        };
    }, [chapterFilenames]);

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
        [isVertical, isRTL, settings.lnDisableAnimations]
    );

    const containerStyles = buildContainerStyles(settings, isVertical, isRTL);


    return (
        <div
            className={`continuous-reader-wrapper ${isRTL ? 'rtl-mode' : 'ltr-mode'}`}
            style={{
                backgroundColor: theme.bg,
                color: theme.fg,
                direction: isRTL ? 'rtl' : 'ltr',
            }}
        >
            <div
                ref={containerRef}
                className={`continuous-reader-container ${isVertical ? 'vertical' : 'horizontal'
                    }`}
                style={containerStyles}
                onClick={handleContentClick}
                onPointerDown={touchHandlers.handlePointerDown}
                onPointerMove={touchHandlers.handlePointerMove}
                onTouchStart={touchHandlers.handleTouchStart}
                onTouchMove={touchHandlers.handleTouchMove}
            >
                <div
                    ref={contentRef}
                    className={`continuous-content ${isVertical ? 'vertical' : 'horizontal'} ${!settings.lnEnableFurigana ? 'furigana-hidden' : ''
                        }`}
                    style={{
                        writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
                        textOrientation: isVertical ? 'mixed' : undefined,
                        direction: 'ltr',
                    }}
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
                currentChapter={currentChapter}
                totalChapters={chapters.length}
                progress={scrollProgress}
                totalBookProgress={currentProgress}
                theme={theme}
                isVertical={isVertical}
                mode="continuous"
                currentPosition={currentPosition}
                bookStats={stats}
                settings={settings}
                onUpdateSettings={onUpdateSettings}
            />
        </div>
    );
};
