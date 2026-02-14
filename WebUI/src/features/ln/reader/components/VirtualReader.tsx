

import React, { ReactNode, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Settings } from '@/Manatan/types';
import { PagedReader } from './PagedReader';
import { ContinuousReader } from './ContinuousReader';
import { useUIVisibility } from '../hooks/useUIVisibility';
import { injectHighlightsIntoHtml } from '../utils/injectHighlights';
import { BookStats, AppStorage, LNHighlight } from '@/lib/storage/AppStorage';

interface VirtualReaderProps {
    bookId: string;
    items: string[];
    stats: BookStats | null;
    settings: Settings;
    initialIndex?: number;
    initialPage?: number;
    initialProgress?: {
        sentenceText?: string;
        chapterIndex?: number;
        pageIndex?: number;
        chapterCharOffset?: number;
        totalProgress?: number;
        blockId?: string;
        blockLocalOffset?: number;
        contextSnippet?: string;
    };
    renderHeader?: (showUI: boolean, toggleUI: () => void) => ReactNode;
    onOpenToc?: () => void;
    onUpdateSettings?: (key: string, value: any) => void;
    chapterFilenames?: string[];
    onChapterChange?: (chapterIndex: number) => void;
    onPositionUpdate?: (position: {
        chapterIndex: number;
        pageIndex?: number;
        chapterCharOffset?: number;
        sentenceText: string;
        totalProgress: number;
        blockId?: string;
        blockLocalOffset?: number;
        contextSnippet?: string;
    }) => void;
    highlights?: LNHighlight[];
    onAddHighlight?: (chapterIndex: number, blockId: string, text: string, startOffset: number, endOffset: number) => void;
}

interface SharedPosition {
    chapterIndex: number;
    pageIndex: number;
    chapterCharOffset: number;
    sentenceText: string;
    totalProgress: number;
    timestamp: number;

    blockId?: string;
    blockLocalOffset?: number;
    contextSnippet?: string;
}

export const VirtualReader: React.FC<VirtualReaderProps> = ({
    bookId,
    items,
    stats,
    settings,
    initialIndex = 0,
    initialPage = 0,
    initialProgress: externalInitialProgress,
    renderHeader,
    onOpenToc,
    onUpdateSettings,
    chapterFilenames = [],
    onChapterChange,
    onPositionUpdate: externalPositionUpdate,
    highlights = [],
    onAddHighlight,

}) => {
    const { showUI, toggleUI } = useUIVisibility({
        autoHideDelay: 5000,
        initialVisible: false,
    });


    const sharedPositionRef = useRef<SharedPosition>({
        chapterIndex: externalInitialProgress?.chapterIndex ?? initialIndex,
        pageIndex: externalInitialProgress?.pageIndex ?? initialPage,
        chapterCharOffset: externalInitialProgress?.chapterCharOffset ?? 0,
        sentenceText: externalInitialProgress?.sentenceText ?? '',
        totalProgress: externalInitialProgress?.totalProgress ?? 0,
        timestamp: Date.now(),

        blockId: externalInitialProgress?.blockId,
        blockLocalOffset: externalInitialProgress?.blockLocalOffset,
        contextSnippet: externalInitialProgress?.contextSnippet,
    });



    const forceSaveRef = useRef<(() => Promise<void>) | null>(null);
    const prevSettingsRef = useRef({
        direction: settings.lnReadingDirection,
        mode: settings.lnPaginationMode,
    });

    const [readerKey, setReaderKey] = useState(0);
    const [activeProgress, setActiveProgress] = useState(externalInitialProgress);
    const [currentIndex, setCurrentIndex] = useState(
        externalInitialProgress?.chapterIndex ?? initialIndex
    );
    const [currentPage, setCurrentPage] = useState(
        externalInitialProgress?.pageIndex ?? initialPage
    );
    const [pendingRemount, setPendingRemount] = useState(false);

    const isPaged = settings.lnPaginationMode === 'paginated';
    const isVertical = settings.lnReadingDirection?.includes('vertical');
    const isRTL = settings.lnReadingDirection === 'vertical-rtl';

    const getHighlightsForChapter = useCallback((chapterIndex: number): LNHighlight[] => {
        return highlights?.filter(h => h.chapterIndex === chapterIndex) ?? [];
    }, [highlights]);

    const chaptersWithHighlights = useMemo(() => {
        return items.map((html, index) => {
            const chapterHighlights = getHighlightsForChapter(index);
            if (chapterHighlights.length === 0) {
                return html;
            }
            return injectHighlightsIntoHtml(html, chapterHighlights);
        });
    }, [items, highlights, getHighlightsForChapter]);


    const handlePositionUpdate = useCallback(
        (position: {
            chapterIndex: number;
            pageIndex?: number;
            chapterCharOffset?: number;
            sentenceText: string;
            totalProgress: number;
            blockId?: string;
            blockLocalOffset?: number;
            contextSnippet?: string;
        }) => {
            if (position.chapterCharOffset || position.sentenceText) {
                const prevChapter = sharedPositionRef.current.chapterIndex;

                sharedPositionRef.current = {
                    chapterIndex: position.chapterIndex,
                    pageIndex: position.pageIndex ?? 0,
                    chapterCharOffset: position.chapterCharOffset ?? 0,
                    sentenceText: position.sentenceText,
                    totalProgress: position.totalProgress,
                    timestamp: Date.now(),

                    blockId: position.blockId,
                    blockLocalOffset: position.blockLocalOffset,
                    contextSnippet: position.contextSnippet,
                };

                if (onChapterChange && position.chapterIndex !== prevChapter) {
                    onChapterChange(position.chapterIndex);
                }
            }

            externalPositionUpdate?.(position);
        },
        [externalPositionUpdate, onChapterChange]
    );



    const handleRegisterSave = useCallback((saveFn: () => Promise<void>) => {
        forceSaveRef.current = saveFn;
    }, []);


    useEffect(() => {
        const prevDirection = prevSettingsRef.current.direction;
        const prevMode = prevSettingsRef.current.mode;

        const directionChanged = prevDirection !== settings.lnReadingDirection;
        const modeChanged = prevMode !== settings.lnPaginationMode;

        if (directionChanged || modeChanged) {
            console.log('[VirtualReader] Settings changed, triggering save before switch');

            prevSettingsRef.current = {
                direction: settings.lnReadingDirection,
                mode: settings.lnPaginationMode,
            };

            setPendingRemount(true);

            const doSaveAndSwitch = async () => {
                if (forceSaveRef.current) {
                    await forceSaveRef.current();
                }

                await new Promise(resolve => setTimeout(resolve, 50));
                const pos = sharedPositionRef.current;

                console.log('[VirtualReader] After save, position:', {
                    chapter: pos.chapterIndex,
                    page: pos.pageIndex,
                    charOffset: pos.chapterCharOffset,
                    blockId: pos.blockId,
                });

                if (pos.sentenceText || pos.chapterCharOffset > 0) {
                    const existing = await AppStorage.getLnProgress(bookId);
                    await AppStorage.saveLnProgress(bookId, {
                        chapterIndex: pos.chapterIndex,
                        pageNumber: pos.pageIndex,
                        chapterCharOffset: pos.chapterCharOffset,
                        totalCharsRead: 0,
                        sentenceText: pos.sentenceText,
                        chapterProgress: 0,
                        totalProgress: pos.totalProgress,

                        blockId: pos.blockId,
                        blockLocalOffset: pos.blockLocalOffset,
                        contextSnippet: pos.contextSnippet,
                        highlights: existing?.highlights ?? [],
                    });
                }

                setActiveProgress({
                    chapterIndex: pos.chapterIndex,
                    pageIndex: pos.pageIndex,
                    chapterCharOffset: pos.chapterCharOffset,
                    sentenceText: pos.sentenceText,
                    totalProgress: pos.totalProgress,

                    blockId: pos.blockId,
                    blockLocalOffset: pos.blockLocalOffset,
                    contextSnippet: pos.contextSnippet,
                });
                setCurrentIndex(pos.chapterIndex);
                setCurrentPage(pos.pageIndex);

                setReaderKey((k) => k + 1);
                setPendingRemount(false);
            };

            doSaveAndSwitch();
        }
    }, [settings.lnReadingDirection, settings.lnPaginationMode, bookId]);



    if (pendingRemount) {
        return (
            <div style={{
                backgroundColor: '#2B2B2B',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>

            </div>
        );
    }

    const commonProps = {
        bookId,
        chapters: chaptersWithHighlights,
        stats,
        settings,
        isVertical: !!isVertical,
        isRTL: !!isRTL,
        onToggleUI: toggleUI,
        showNavigation: showUI,
        initialChapter: currentIndex,
        initialProgress: activeProgress,
        onPositionUpdate: handlePositionUpdate,
        onRegisterSave: handleRegisterSave,
        onOpenToc: onOpenToc,
        onUpdateSettings,
        chapterFilenames,
        highlights,
        onAddHighlight,
    };

    return (
        <>
            {isPaged ? (
                <PagedReader
                    key={`paged-${readerKey}`}
                    {...commonProps}
                    initialPage={currentPage}
                />
            ) : (
                <ContinuousReader key={`continuous-${readerKey}`} {...commonProps} />
            )}
            {renderHeader?.(showUI, toggleUI)}
        </>
    );
};