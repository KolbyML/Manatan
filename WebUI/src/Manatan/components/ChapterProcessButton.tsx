import React, { useEffect, useState, useRef } from 'react';
import { checkChapterStatus, preprocessChapter, ChapterStatus, AuthCredentials } from '@/Manatan/utils/api';
import { YomitanLanguage } from '@/Manatan/types';

interface ChapterProcessButtonProps {
    chapterPath: string; 
    creds?: AuthCredentials;
    language?: YomitanLanguage;
}

export const ChapterProcessButton: React.FC<ChapterProcessButtonProps> = ({
    chapterPath,
    creds,
    language,
}) => {
    const [status, setStatus] = useState<ChapterStatus>({ status: 'idle', cached: 0, total: 0 });
    const apiBaseUrl = `${window.location.origin}/api/v1${chapterPath}/page/`;
    const startingRef = useRef(false);

    useEffect(() => {
        let mounted = true;
        let intervalId: number | null = null;

        const check = async () => {
            if (status.status === 'processed') return;

            const res = await checkChapterStatus(apiBaseUrl, creds, language);
            
            if (mounted) {
                if (startingRef.current && res.status === 'idle') {
                    if (!intervalId) intervalId = window.setInterval(check, 500); 
                    return;
                }

                let hasChanged = false;

                if (status.status !== res.status) {
                    hasChanged = true;
                } else {
                    if (status.status === 'processing' && res.status === 'processing') {
                        if (status.progress !== res.progress || status.total !== res.total) {
                            hasChanged = true;
                        }
                    } else if (status.status === 'idle' && res.status === 'idle') {
                        if (status.cached !== res.cached || status.total !== res.total) {
                            hasChanged = true;
                        }
                    }
                }

                if (hasChanged) {
                    setStatus(res);
                }
                
                const isProcessing = (res.status === 'processing');

                if (isProcessing || startingRef.current) {
                    if (!intervalId) {
                        intervalId = window.setInterval(check, 500);
                    }
                } else {
                    if (intervalId) {
                        clearInterval(intervalId);
                        intervalId = null;
                    }
                }
            }
        };

        check();

        return () => { 
            mounted = false; 
            if (intervalId) clearInterval(intervalId);
        };
    }, [apiBaseUrl, status, creds, language]); 

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (status.status !== 'idle') return;

        startingRef.current = true;
        setStatus({ status: 'processing', progress: 0, total: 0 }); 
        
        try {
            await preprocessChapter(apiBaseUrl, chapterPath, creds, language);
            
            setTimeout(() => {
                startingRef.current = false;
            }, 2000);

        } catch (err) {
            console.error(err);
            startingRef.current = false;
            setStatus({ status: 'idle', cached: 0, total: 0 });
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
