import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildChapterBaseUrl, checkChapterStatus, preprocessChapter, ChapterStatus, AuthCredentials } from '@/Manatan/utils/api';
import { YomitanLanguage } from '@/Manatan/types';

interface ChapterProcessButtonProps {
    chapterPath: string; 
    creds?: AuthCredentials;
    language?: YomitanLanguage;
    initialStatus?: ChapterStatus;
}

export const ChapterProcessButton: React.FC<ChapterProcessButtonProps> = ({
    chapterPath,
    creds,
    language,
    initialStatus,
}) => {
    const [status, setStatus] = useState<ChapterStatus>(
        initialStatus ?? { status: 'idle', cached: 0, total: 0 }
    );
    const [statusEnabled, setStatusEnabled] = useState(false);
    const apiBaseUrl = useMemo(() => buildChapterBaseUrl(chapterPath), [chapterPath]);

    // Polling state that survives re-renders and avoids interval leaks.
    const pollTimeoutRef = useRef<number | null>(null);
    const pollInFlightRef = useRef(false);
    const isMountedRef = useRef(true);

    // Keep polling briefly after starting a job even if the server still reports idle.
    const startingUntilRef = useRef<number>(0);

    const stopPolling = useCallback(() => {
        if (pollTimeoutRef.current != null) {
            clearTimeout(pollTimeoutRef.current);
            pollTimeoutRef.current = null;
        }
    }, []);

    const schedulePoll = useCallback(
        (fn: () => void, delayMs: number) => {
            stopPolling();
            pollTimeoutRef.current = window.setTimeout(fn, delayMs);
        },
        [stopPolling],
    );

    useEffect(() => {
        if (!initialStatus) return;

        setStatus((prev) => {
            // Never clobber a local state that has progressed further than the initial snapshot.
            if (initialStatus.status === 'processed') return initialStatus;
            if (prev.status === 'processed') return prev;
            if (prev.status === 'processing' && initialStatus.status === 'idle') return prev;
            return initialStatus;
        });

        if (initialStatus.status === 'processing') setStatusEnabled(true);
    }, [initialStatus]);

    useEffect(() => {
        if (!statusEnabled) return;
        isMountedRef.current = true;
        let cancelled = false;

        const poll = async () => {
            if (cancelled) return;
            if (pollInFlightRef.current) {
                schedulePoll(() => {
                    void poll();
                }, 250);
                return;
            }
            pollInFlightRef.current = true;
            try {
                const res = await checkChapterStatus(apiBaseUrl, creds, language);
                if (cancelled || !isMountedRef.current) return;

                const now = Date.now();
                const isStarting = startingUntilRef.current > 0 && now < startingUntilRef.current;

                setStatus((prev) => {
                    // While starting, keep the button visually "busy" even if the server
                    // still reports idle (job enqueue / first progress update lag).
                    if (isStarting && res.status === 'idle') {
                        if (prev.status === 'processing') {
                            // Opportunistically learn the expected total if the idle response has it.
                            if (prev.total === 0 && res.total > 0) {
                                return { status: 'processing', progress: 0, total: res.total };
                            }
                            return prev;
                        }
                        return { status: 'processing', progress: 0, total: res.total };
                    }

                    // Avoid re-renders if nothing changed.
                    if (prev.status !== res.status) return res;
                    if (prev.status === 'processing' && res.status === 'processing') {
                        if (prev.progress !== res.progress || prev.total !== res.total) return res;
                    }
                    if (prev.status === 'idle' && res.status === 'idle') {
                        if (prev.cached !== res.cached || prev.total !== res.total) return res;
                    }
                    return prev;
                });

                if (res.status === 'processed') {
                    stopPolling();
                    setStatusEnabled(false);
                    startingUntilRef.current = 0;
                    return;
                }

                const shouldKeepPolling =
                    res.status === 'processing' || (startingUntilRef.current > 0 && now < startingUntilRef.current);

                if (shouldKeepPolling) {
                    schedulePoll(() => {
                        void poll();
                    }, 500);
                } else {
                    stopPolling();
                    setStatusEnabled(false);
                }
            } catch (err) {
                // Avoid a tight retry loop if the status endpoint errors.
                if (!cancelled) {
                    schedulePoll(() => {
                        void poll();
                    }, 1500);
                }
            } finally {
                pollInFlightRef.current = false;
            }
        };

        void poll();

        return () => {
            cancelled = true;
            isMountedRef.current = false;
            stopPolling();
        };
    }, [apiBaseUrl, creds, language, schedulePoll, statusEnabled, stopPolling]);

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (status.status !== 'idle') return;

        // Immediate UI feedback: switch to a busy state before any network requests.
        // We keep polling for a bit even if the server initially reports "idle".
        startingUntilRef.current = Date.now() + 10_000;
        setStatus({ status: 'processing', progress: 0, total: status.total ?? 0 });

        setStatusEnabled(true);

        const currentStatus = await checkChapterStatus(apiBaseUrl, creds, language);
        if (currentStatus.status !== 'idle') {
            setStatus(currentStatus);
            if (currentStatus.status === 'processed') {
                startingUntilRef.current = 0;
                setStatusEnabled(false);
            }
            return;
        }

        // Update the optimistic total based on the latest status snapshot.
        setStatus({ status: 'processing', progress: 0, total: currentStatus.total ?? status.total ?? 0 });
        
        try {
            await preprocessChapter(apiBaseUrl, chapterPath, creds, language);

            // After the job is enqueued we still expect a small delay before the status endpoint
            // reflects it. Polling is handled by the effect above.

        } catch (err) {
            console.error(err);
            startingUntilRef.current = 0;
            setStatus({ status: 'idle', cached: currentStatus.cached ?? 0, total: currentStatus.total ?? 0 });
            setStatusEnabled(false);
        }
    };

    const renderButtonContent = () => {
        if (status.status === 'processed') return "OCR Processed";
        
        if (status.status === 'processing') {
            if (status.total > 0) {
                return `Processing (${status.progress}/${status.total})`;
            }
            return "Processing...";
        }

        if (status.status === 'idle') {
            if (status.cached > 0) {
                return `Process OCR (${status.cached}/${status.total})`;
            }
        }

        return "Process OCR";
    };

    const isProcessing = status.status === 'processing';
    const isProcessed = status.status === 'processed';

    if (isProcessed) {
        return (
            <button className="ocr-chapter-btn done" disabled title="OCR already processed">
                {renderButtonContent()}
            </button>
        );
    }

    return (
        <button 
            className={`ocr-chapter-btn process ${isProcessing ? 'busy' : ''}`} 
            onClick={handleClick}
            disabled={isProcessing}
        >
            {renderButtonContent()}
        </button>
    );
};
