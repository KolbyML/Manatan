import { useState, useCallback, useEffect } from 'react';
import { AppStorage, LNHighlight } from '@/lib/storage/AppStorage';

function generateId(): string {
    return `hl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useHighlights(bookId: string) {
    const [highlights, setHighlights] = useState<LNHighlight[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const progress = await AppStorage.getLnProgress(bookId);
            setHighlights(progress?.highlights ?? []);
        } catch (e) {
            console.warn('[useHighlights] Failed to load:', e);
            setHighlights([]);
        } finally {
            setLoading(false);
        }
    }, [bookId]);

    useEffect(() => {
        load();
    }, [load]);

    const saveHighlights = useCallback(async (newHighlights: LNHighlight[]) => {
        try {
            const existing = await AppStorage.getLnProgress(bookId);
            await AppStorage.saveLnProgress(bookId, {
                chapterIndex: existing?.chapterIndex ?? 0,
                pageNumber: existing?.pageNumber,
                chapterCharOffset: existing?.chapterCharOffset ?? 0,
                totalCharsRead: existing?.totalCharsRead ?? 0,
                sentenceText: existing?.sentenceText ?? '',
                chapterProgress: existing?.chapterProgress ?? 0,
                totalProgress: existing?.totalProgress ?? 0,
                blockId: existing?.blockId,
                blockLocalOffset: existing?.blockLocalOffset,
                contextSnippet: existing?.contextSnippet,
                highlights: newHighlights,
            });
        } catch (e) {
            console.warn('[useHighlights] Failed to save:', e);
        }
    }, [bookId]);

    const addHighlight = useCallback(async (
        chapterIndex: number,
        blockId: string,
        text: string,
        startOffset: number,
        endOffset: number
    ) => {
        // Check for duplicate or overlapping highlight in the same block
        const hasOverlap = highlights.some(h => 
            h.chapterIndex === chapterIndex &&
            h.blockId === blockId &&
            !(endOffset <= h.startOffset || startOffset >= h.endOffset)
        );
        
        if (hasOverlap) {
            console.warn('[useHighlights] Overlapping highlight ignored');
            return null;
        }

        const newHighlight: LNHighlight = {
            id: generateId(),
            chapterIndex,
            blockId,
            text,
            startOffset,
            endOffset,
            createdAt: Date.now(),
        };

        const updated = [...highlights, newHighlight];
        setHighlights(updated);
        await saveHighlights(updated);
        return newHighlight;
    }, [highlights, saveHighlights]);

    const removeHighlight = useCallback(async (highlightId: string) => {
        const updated = highlights.filter(h => h.id !== highlightId);
        setHighlights(updated);
        await saveHighlights(updated);
    }, [highlights, saveHighlights]);

    const getHighlightsForChapter = useCallback((chapterIndex: number): LNHighlight[] => {
        return highlights.filter(h => h.chapterIndex === chapterIndex);
    }, [highlights]);

    const exportToTxt = useCallback((chapterTitles: string[]): string => {
        const lines: string[] = [];
        
        const byChapter = new Map<number, LNHighlight[]>();
        for (const h of highlights) {
            const list = byChapter.get(h.chapterIndex) ?? [];
            list.push(h);
            byChapter.set(h.chapterIndex, list);
        }

        const sortedChapters = Array.from(byChapter.keys()).sort((a, b) => a - b);

        for (const chIdx of sortedChapters) {
            const chHighlights = byChapter.get(chIdx) ?? [];
            const title = chapterTitles[chIdx] ?? `Chapter ${chIdx + 1}`;
            
            lines.push(`【${title}】`);
            lines.push('');

            const sorted = [...chHighlights].sort((a, b) => a.createdAt - b.createdAt);
            for (const h of sorted) {
                const date = new Date(h.createdAt).toLocaleDateString();
                lines.push(`${h.text} (${date})`);
                lines.push('');
            }
            lines.push('');
        }

        return lines.join('\n');
    }, [highlights]);

    const exportToJson = useCallback((): string => {
        return JSON.stringify(highlights, null, 2);
    }, [highlights]);

    const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    return {
        highlights,
        loading,
        addHighlight,
        removeHighlight,
        getHighlightsForChapter,
        exportToTxt,
        exportToJson,
        downloadFile,
        refresh: load,
    };
}
