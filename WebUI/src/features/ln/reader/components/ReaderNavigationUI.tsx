import React, { useState, useEffect, useCallback } from 'react';
import './ReaderNavigationUI.css';
import { BookStats } from '@/lib/storage/AppStorage';
import { SaveablePosition } from '../utils/readerSave';

interface ReaderNavigationUIProps {
    visible: boolean;
    onNext: () => void;
    onPrev: () => void;
    canGoNext: boolean;
    canGoPrev: boolean;
    currentPage?: number;
    totalPages?: number;
    currentChapter: number;
    totalChapters: number;
    progress: number;
    totalBookProgress?: number;
    showSlider?: boolean;
    onPageChange?: (page: number) => void;
    theme: { bg: string; fg: string };
    isVertical: boolean;
    mode: 'paged' | 'continuous';
    currentPosition?: SaveablePosition | null;
    bookStats?: BookStats | null;
    settings?: any;
    onUpdateSettings: (key: string, value: any) => void;
    // Save status props
    isSaved: boolean;
    onSaveNow: () => Promise<boolean>;
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
    isSaved,
    onSaveNow,
}) => {
    const [isLocked, setIsLocked] = useState(settings?.lnLockProgressBar ?? false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setIsLocked(settings?.lnLockProgressBar ?? false);
    }, [settings?.lnLockProgressBar]);

    const toggleLock = () => {
        const newLocked = !isLocked;
        setIsLocked(newLocked);
        onUpdateSettings('lnLockProgressBar', newLocked);
    };

    const handleSaveNow = useCallback(async () => {
        if (isSaving) return;
        
        setIsSaving(true);
        try {
            await onSaveNow();
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, onSaveNow]);

    const isVisible = visible || isLocked;

    const displayProgress = totalBookProgress !== undefined ? totalBookProgress : progress;

    const charsRead = currentPosition?.totalCharsRead || 0;
    const totalChars = bookStats?.totalLength || 0;

    const chapterCharsRead = currentPosition?.chapterCharOffset || 0;
    const currentChapterLength = bookStats?.chapterLengths?.[currentChapter] || 0;
    const chapterProgress = currentPosition?.chapterProgress || 0;

    const showPageSlider = showSlider && mode === 'paged' && totalPages && totalPages > 1 && onPageChange && currentPage !== undefined;
    const showCharProgress = settings?.lnShowCharProgress ?? false;
    const showNavButtons = visible && !(settings?.lnHideNavButtons ?? false);

    return (
        <div className={`reader-navigation-ui ${isVisible ? 'visible' : 'hidden'}`}>
            {showNavButtons && (
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
                            <span className="progress-page-info">
                                {chapterCharsRead.toLocaleString()} / {currentChapterLength.toLocaleString()} ({chapterProgress.toFixed(1)}%)
                            </span>
                        ) : (
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
                                onChange={(e) => onPageChange?.(parseInt(e.target.value, 10))}
                                style={{ color: theme.fg }}
                            />
                        </div>
                    )}

                    <div className="progress-right">
                        {/* Bookmark/Save Button */}
                        <button
                            className={`progress-bookmark-btn ${isSaved ? 'saved' : 'unsaved'} ${isSaving ? 'saving' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSaveNow();
                            }}
                            disabled={isSaving}
                            aria-label={isSaved ? "Position saved" : "Save position now"}
                            title={isSaved ? "Position saved" : "Click to save position"}
                            style={{ color: isSaved ? '#4CAF50' : theme.fg }}
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill={isSaved ? 'currentColor' : 'none'}
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={isSaving ? 'spin' : ''}
                            >
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                            </svg>
                        </button>

                        {/* Lock Button */}
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