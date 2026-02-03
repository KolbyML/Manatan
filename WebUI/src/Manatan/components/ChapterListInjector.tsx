import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ChapterProcessButton } from './ChapterProcessButton';
import { useOCR } from '@/Manatan/context/OCRContext';
import { AuthCredentials, ChapterStatus, buildChapterBaseUrl, checkChaptersStatus } from '@/Manatan/utils/api';

export const ChapterListInjector: React.FC = () => {
    const { serverSettings, settings } = useOCR();
    
    const credsRef = useRef<AuthCredentials | undefined>(undefined);
    const languageRef = useRef(settings.yomitanLanguage);
    const statusCacheRef = useRef<Map<string, ChapterStatus>>(new Map());
    const rootsRef = useRef<Map<string, ReturnType<typeof createRoot>>>(new Map());
    const pendingRef = useRef<Set<string>>(new Set());
    const fetchTimerRef = useRef<number | null>(null);
    const inFlightRef = useRef(false);

    // Keep the ref updated whenever serverSettings changes
    useEffect(() => {
        if (serverSettings) {
            credsRef.current = {
                user: serverSettings.authUsername,
                pass: serverSettings.authPassword
            };
        } else {
            credsRef.current = undefined;
        }
    }, [serverSettings]);

    useEffect(() => {
        languageRef.current = settings.yomitanLanguage;
    }, [settings.yomitanLanguage]);

    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                m.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement) {
                        checkForChapters(node);
                    }
                });
            });
            checkForChapters(document.body);
        });

        observer.observe(document.body, { childList: true, subtree: true });
        checkForChapters(document.body);

        return () => observer.disconnect();
    }, []);

    const scheduleBatchFetch = () => {
        if (fetchTimerRef.current) {
            clearTimeout(fetchTimerRef.current);
        }
        fetchTimerRef.current = window.setTimeout(async () => {
            if (inFlightRef.current) return;
            const pending = Array.from(pendingRef.current);
            pendingRef.current.clear();
            if (!pending.length) return;

            inFlightRef.current = true;
            try {
                const baseUrls = pending.map(buildChapterBaseUrl);
                const statuses = await checkChaptersStatus(
                    baseUrls,
                    credsRef.current,
                    languageRef.current,
                );
                pending.forEach((path, index) => {
                    const baseUrl = baseUrls[index];
                    const status = statuses[baseUrl] || { status: 'idle', cached: 0, total: 0 };
                    statusCacheRef.current.set(path, status);
                    const root = rootsRef.current.get(path);
                    if (root) {
                        root.render(
                            <ChapterProcessButton 
                                chapterPath={path} 
                                creds={credsRef.current} 
                                language={languageRef.current}
                                initialStatus={status}
                            />
                        );
                    }
                });
            } finally {
                inFlightRef.current = false;
                if (pendingRef.current.size > 0) {
                    scheduleBatchFetch();
                }
            }
        }, 0);
    };

    const checkForChapters = (root: HTMLElement) => {
        const links = root.querySelectorAll('a[href*="/manga/"][href*="/chapter/"]');
        links.forEach((link) => {
            if (link instanceof HTMLAnchorElement) {
                injectButton(link);
            }
        });
    };

    const injectButton = (link: HTMLAnchorElement) => {
        const moreButton = link.parentElement?.querySelector('button[aria-label="more"]') 
                        || link.closest('tr')?.querySelector('button[aria-label="more"]')
                        || link.parentElement?.parentElement?.querySelector('button[aria-label="more"]');

        if (!moreButton || !moreButton.parentElement) return;

        const container = moreButton.parentElement;

        if (container.querySelector('.ocr-chapter-btn-wrapper')) return;

        // --- CSS FIX START ---
        container.style.display = 'flex';
        container.style.flexDirection = 'row';
        container.style.alignItems = 'center';
        container.style.gap = '10px';
        // --- CSS FIX END ---

        const wrapper = document.createElement('div');
        wrapper.className = 'ocr-chapter-btn-wrapper';
        
        container.insertBefore(wrapper, moreButton);

        const root = createRoot(wrapper);
        const urlPath = new URL(link.href).pathname;

        rootsRef.current.set(urlPath, root);
        const initialStatus = statusCacheRef.current.get(urlPath);

        root.render(
            <ChapterProcessButton 
                chapterPath={urlPath} 
                creds={credsRef.current} 
                language={languageRef.current}
                initialStatus={initialStatus}
            />
        );

        if (!statusCacheRef.current.has(urlPath)) {
            pendingRef.current.add(urlPath);
            scheduleBatchFetch();
        }
    };

    useEffect(() => {
        statusCacheRef.current.clear();
        const pending = new Set<string>();
        rootsRef.current.forEach((_root, path) => {
            pending.add(path);
        });
        pendingRef.current = pending;
        if (pendingRef.current.size > 0) {
            scheduleBatchFetch();
        }
    }, [settings.yomitanLanguage]);

    return null;
};
