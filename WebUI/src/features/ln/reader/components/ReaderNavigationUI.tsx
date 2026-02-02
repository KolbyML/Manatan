import React, { useState, useEffect } from 'react';
import './ReaderNavigationUI.css';
import { ReadingPosition, BookStats } from '../types/progress';

interface ReaderNavigationUIProps {
    visible: boolean;
    onNext: () => void;
    onPrev: () => void;
    canGoNext: boolean;
    canGoPrev: boolean;
    currentPage: number;
    totalPages: number;
    currentChapter: number;
    totalChapters: number;
    progress: number;
    totalBookProgress?: number;
    showSlider?: boolean;
    onPageChange?: (page: number) => void;
    theme: { bg: string; fg: string };
    isVertical: boolean;
    mode: 'paged' | 'continuous';
    currentPosition?: ReadingPosition;
    bookStats?: BookStats;
    settings?: any;
    onUpdateSettings: (key: string, value: any) => void;
}

export const ReaderNavigationUI: React.FC<ReaderNavigationUIProps> = ({
    visible,
    onNext,
    onPrev,
    canGoNext,
    canGoPrev,
    currentPage,
    totalPages,
    currentChapter,
    totalChapters,
    progress,
    totalBookProgress,
    showSlider = false,
    onPageChange,
    theme,
    isVertical,
    mode,
    currentPosition,
    bookStats,
    settings,
    onUpdateSettings,
}) => {
    const [isLocked, setIsLocked] = useState(settings?.lnLockProgressBar ?? false);

    useEffect(() => {
        setIsLocked(settings?.lnLockProgressBar ?? false);
    }, [settings?.lnLockProgressBar]);

    const toggleLock = () => {
        const newLocked = !isLocked;
        setIsLocked(newLocked);
        onUpdateSettings('lnLockProgressBar', newLocked);
    };

    if (!visible && !isLocked) return null;

    const displayProgress = totalBookProgress !== undefined ? totalBookProgress : progress;

    const charsRead = currentPosition?.totalCharsRead || 0;
    const totalChars = bookStats?.totalLength || 0;

    const chapterCharsRead = currentPosition?.chapterCharOffset || 0;
    const currentChapterLength = bookStats?.chapterLengths[currentChapter] || 0;
    const chapterProgress = currentPosition?.chapterProgress || 0;

    const showPageSlider = showSlider && mode === 'paged' && totalPages && totalPages > 1 && onPageChange && currentPage !== undefined;
    const showCharProgress = settings?.lnShowCharProgress ?? false;

    return (
        <div className="reader-navigation-ui">
            {visible && (
                <>
                    <button
                        className={`nav-btn prev ${isVertical ? 'vertical' : 'horizontal'}`}
                        onClick={(e) => { e.stopPropagation(); onPrev(); }}
                        disabled={!canGoPrev}
                    >
                        {isVertical ? '›' : '‹'}
                    </button>

                    <button
                        className={`nav-btn next ${isVertical ? 'vertical' : 'horizontal'}`}
                        onClick={(e) => { e.stopPropagation(); onNext(); }}
                        disabled={!canGoNext}
                    >
                        {isVertical ? '‹' : '›'}
                    </button>
                </>
            )}

            <div
                className={`reader-progress-bar ${showPageSlider ? 'with-slider' : ''} ${isLocked ? 'locked' : ''}`}
                style={{
                    backgroundColor: `${theme.bg}ee`,
                    borderTopColor: `${theme.fg}20`
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="progress-bar-fill"
                    style={{
                        width: `${displayProgress}%`,
                        backgroundColor: theme.fg
                    }}
                />

                <div
                    className="progress-info"
                    style={{ color: theme.fg }}
                >
                    <div className="progress-left">
                        {totalChars > 0 && (
                            <>
                                <span className="progress-chars">
                                    {charsRead.toLocaleString()} / {totalChars.toLocaleString()} chars
                                </span>
                                <span className="progress-separator">•</span>
                            </>
                        )}

                        {showCharProgress ? (
                            // Show character count and percentage
                            <span className="progress-page-info">
                                {chapterCharsRead.toLocaleString()} / {currentChapterLength.toLocaleString()} ({chapterProgress.toFixed(1)}%)
                            </span>
                        ) : (
                            // Show page number or chapter
                            mode === 'paged' && currentPage !== undefined && totalPages !== undefined ? (
                                <span className="progress-page-info">
                                    Page {currentPage + 1} / {totalPages}
                                </span>
                            ) : (
                                <span className="progress-page-info">
                                    Ch {currentChapter + 1} / {totalChapters}
                                </span>
                            )
                        )}
                    </div>

                    {showPageSlider && (
                        <div className="progress-slider-inline">
                            <input
                                type="range"
                                className={`reader-slider ${isVertical ? 'vertical' : 'horizontal'}`}
                                min={0}
                                max={totalPages - 1}
                                value={currentPage}
                                onChange={(e) => onPageChange(parseInt(e.target.value, 10))}
                                style={{ color: theme.fg }}
                            />
                        </div>
                    )}

                    <div className="progress-right">
                        <button
                            className="progress-lock-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleLock();
                            }}
                            aria-label={isLocked ? "Unlock progress bar" : "Lock progress bar"}
                            style={{ color: theme.fg }}
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                {isLocked ? (
                                    <>
                                        <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </>
                                ) : (
                                    <>
                                        <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                                    </>
                                )}
                            </svg>
                        </button>

                        <span className="progress-percent">
                            {displayProgress.toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};