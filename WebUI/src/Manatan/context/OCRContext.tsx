import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback, useRef } from 'react';
import { Settings, DEFAULT_SETTINGS, MergeState, OcrBlock, COLOR_THEMES, ServerSettingsData, DictPopupState, OcrStatus, DialogState } from '@/Manatan/types';
import { useLocation } from 'react-router-dom';
import {
    AuthCredentials,
    ChapterStatus,
    buildChapterBaseUrl,
    checkChapterStatus,
    preprocessChapter,
    deleteChapterOcr as deleteChapterOcrRequest,
} from '@/Manatan/utils/api';
import { requestManager } from '@/lib/requests/RequestManager';
import { AppStorage } from '@/lib/storage/AppStorage.ts';
import { normalizeLookupTrigger } from '@/Manatan/utils/lookupTrigger';
import {
    normalizeLegacyTextBoxContextMenuTrigger,
    normalizeTextBoxContextMenuHotkeys,
} from '@/Manatan/utils/contextMenuTrigger';
import { MANATAN_SETTINGS_META_KEY, getServerMetaJson, setServerMetaJson } from '@/Manatan/services/ServerMetaStorage.ts';

interface OCRContextType {
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    serverSettings: ServerSettingsData | null;
    // Settings UI State
    isSettingsOpen: boolean;
    openSettings: () => void;
    closeSettings: () => void;
    isSetupOpen: boolean;
    openSetup: () => void;
    closeSetup: () => void;

    ocrCache: Map<string, OcrBlock[]>;
    updateOcrData: (imgSrc: string, data: OcrBlock[]) => void;
    ocrStatusMap: Map<string, OcrStatus>;
    setOcrStatus: (imgSrc: string, status: OcrStatus) => void;    

    chapterOcrStatusMap: Map<string, ChapterStatus>;
    refreshChapterOcrStatus: (chapterPath: string) => Promise<ChapterStatus>;
    startChapterOcr: (chapterPath: string) => Promise<void>;
    deleteChapterOcr: (chapterPath: string, deleteData?: boolean) => Promise<void>;

    mergeAnchor: MergeState;
    setMergeAnchor: React.Dispatch<React.SetStateAction<MergeState>>;
    activeImageSrc: string | null;
    setActiveImageSrc: React.Dispatch<React.SetStateAction<string | null>>;
    
    // Dictionary State
    dictPopup: DictPopupState;
    setDictPopup: React.Dispatch<React.SetStateAction<DictPopupState>>;

    // Popup Interaction Helpers
    notifyPopupClosed: () => void;
    wasPopupClosedRecently: () => boolean;

    // Global Dialog State
    dialogState: DialogState;
    showDialog: (config: Partial<DialogState>) => void;
    closeDialog: () => void;
    showConfirm: (title: string, message: React.ReactNode, onConfirm: () => void) => void;
    showAlert: (title: string, message: React.ReactNode) => void;
    showProgress: (message: string) => void;

    debugLog: string[];
    addLog: (msg: string) => void;
}

const OCRContext = createContext<OCRContextType | undefined>(undefined);

const LEGACY_MANATAN_SETTINGS_KEY = 'mangatan_settings_v3';

const isMobileUserAgent = (): boolean => {
    if (typeof navigator === 'undefined') {
        return false;
    }

    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const normalizeSavedSettings = (savedSettings?: Partial<Settings> | null): Partial<Settings> => {
    if (!savedSettings) {
        return {};
    }

    const normalizedSettings = { ...savedSettings };
    if ('brightnessMode' in normalizedSettings) {
        delete (normalizedSettings as Partial<Record<'brightnessMode', unknown>>).brightnessMode;
    }

    const legacySettings = normalizedSettings as Partial<Settings> & {
        textBoxContextMenuHotkey?: string;
        textBoxContextMenuTrigger?: string;
    };

    normalizedSettings.yomitanLookupTrigger = normalizeLookupTrigger(normalizedSettings.yomitanLookupTrigger);
    const normalizedContextMenuHotkeys = normalizeTextBoxContextMenuHotkeys(
        normalizedSettings.textBoxContextMenuHotkeys ?? legacySettings.textBoxContextMenuHotkey,
    );
    normalizedSettings.textBoxContextMenuHotkeys = normalizedContextMenuHotkeys.length
        ? normalizedContextMenuHotkeys
        : [normalizeLegacyTextBoxContextMenuTrigger(legacySettings.textBoxContextMenuTrigger)];

    if (normalizedSettings.ankiFieldMap) {
        normalizedSettings.ankiFieldMap = Object.fromEntries(
            Object.entries(normalizedSettings.ankiFieldMap).map(([key, value]) => [
                key,
                value === 'Definition' ? 'Glossary' : value,
            ]),
        );
    }

    return normalizedSettings;
};

const getDefaultSettings = (): Settings => ({
    ...DEFAULT_SETTINGS,
    mobileMode: isMobileUserAgent(),
});

const getSettingsWithDefaults = (settings?: Partial<Settings> | null): Settings => ({
    ...getDefaultSettings(),
    ...normalizeSavedSettings(settings),
});

const readLegacyManatanSettings = (): Partial<Settings> | null => {
    try {
        const saved = AppStorage.local.getItem(LEGACY_MANATAN_SETTINGS_KEY);
        if (!saved) {
            return null;
        }

        return JSON.parse(saved);
    } catch (error) {
        console.error('Failed to load legacy Manatan settings', error);
        return null;
    }
};

export const OCRProvider = ({ children }: { children: ReactNode }) => {
    const location = useLocation();
    const { data: serverSettingsData } = requestManager.useGetServerSettings();
    const serverSettings: ServerSettingsData | null = serverSettingsData?.settings || null;

    const [settings, setSettings] = useState<Settings>(() => getSettingsWithDefaults(readLegacyManatanSettings()));
    const hasHydratedServerSettingsRef = useRef(false);
    const saveServerSettingsTimeoutRef = useRef<number | undefined>(undefined);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const openSettings = useCallback(() => setIsSettingsOpen(true), []);
    const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

    const [isSetupOpen, setIsSetupOpen] = useState(() => {
        try {
            return !AppStorage.local.getItem('manatan_setup_complete_v1');
        } catch (e) {
            console.error('Failed to read setup flag', e);
            return false;
        }
    });
    const openSetup = useCallback(() => setIsSetupOpen(true), []);
    const closeSetup = useCallback(() => setIsSetupOpen(false), []);

    const [ocrCache, setOcrCache] = useState<Map<string, OcrBlock[]>>(new Map());
    const [ocrStatusMap, setOcrStatusMap] = useState<Map<string, OcrStatus>>(new Map());    
    const [chapterOcrStatusMap, setChapterOcrStatusMap] = useState<Map<string, ChapterStatus>>(new Map());

    const chapterPollTimeoutsRef = useRef<Map<string, number>>(new Map());
    const chapterPollInFlightRef = useRef<Set<string>>(new Set());
    const chapterStartingUntilRef = useRef<Map<string, number>>(new Map());
    const prevPathnameRef = useRef<string>('');

    const stopChapterPolling = useCallback((chapterPath: string) => {
        const timeout = chapterPollTimeoutsRef.current.get(chapterPath);
        if (timeout != null) {
            clearTimeout(timeout);
            chapterPollTimeoutsRef.current.delete(chapterPath);
        }
    }, []);

    const stopAllChapterPolling = useCallback(() => {
        chapterPollTimeoutsRef.current.forEach((timeout) => {
            clearTimeout(timeout);
        });
        chapterPollTimeoutsRef.current.clear();
        chapterPollInFlightRef.current.clear();
        chapterStartingUntilRef.current.clear();
    }, []);

    const creds = useMemo<AuthCredentials | undefined>(() => {
        if (!serverSettings?.authUsername) return undefined;
        return {
            user: serverSettings.authUsername,
            pass: serverSettings.authPassword,
        };
    }, [serverSettings?.authPassword, serverSettings?.authUsername]);
    const [mergeAnchor, setMergeAnchor] = useState<MergeState>(null);
    const [activeImageSrc, setActiveImageSrc] = useState<string | null>(null);
    const [debugLog, setDebugLog] = useState<string[]>([]);

    const [dictPopup, setDictPopup] = useState<DictPopupState>({
        visible: false, x: 0, y: 0, results: [], isLoading: false, systemLoading: false
    });

    // --- POPUP COORDINATION ---
    const lastPopupCloseRef = useRef<number>(0);

    const notifyPopupClosed = useCallback(() => {
        lastPopupCloseRef.current = Date.now();
    }, []);

    const wasPopupClosedRecently = useCallback(() => {
        return Date.now() - lastPopupCloseRef.current < 1000;
    }, []);

    const [dialogState, setDialogState] = useState<DialogState>({
        isOpen: false, type: 'alert', message: ''
    });

    const addLog = useCallback((msg: string) => {
        if (!settings.debugMode) return;
        const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
        setDebugLog((prev) => [...prev.slice(-99), entry]);
        console.log(`[OCR] ${entry}`);
    }, [settings.debugMode]);

    const updateOcrData = useCallback((imgSrc: string, data: OcrBlock[]) => {
        setOcrCache((prev) => new Map(prev).set(imgSrc, data));
    }, []);

    const setOcrStatus = useCallback((imgSrc: string, status: OcrStatus) => {
         setOcrStatusMap((prev) => new Map(prev).set(imgSrc, status));
    }, []);

    const refreshChapterOcrStatus = useCallback(
        async (chapterPath: string): Promise<ChapterStatus> => {
            const baseUrl = buildChapterBaseUrl(chapterPath);
            const res = await checkChapterStatus(baseUrl, creds, settings.yomitanLanguage);
            setChapterOcrStatusMap((prev) => new Map(prev).set(chapterPath, res));
            return res;
        },
        [creds, settings.yomitanLanguage],
    );

    const scheduleChapterPoll = useCallback(
        (chapterPath: string, fn: () => void, delayMs: number) => {
            stopChapterPolling(chapterPath);
            const timeout = window.setTimeout(fn, delayMs);
            chapterPollTimeoutsRef.current.set(chapterPath, timeout);
        },
        [stopChapterPolling],
    );

    const pollChapterUntilDone = useCallback(
        async (chapterPath: string) => {
            if (chapterPollInFlightRef.current.has(chapterPath)) {
                scheduleChapterPoll(chapterPath, () => {
                    void pollChapterUntilDone(chapterPath);
                }, 250);
                return;
            }

            chapterPollInFlightRef.current.add(chapterPath);
            try {
                const res = await refreshChapterOcrStatus(chapterPath);
                if (res.status === 'processed') {
                    stopChapterPolling(chapterPath);
                    chapterStartingUntilRef.current.delete(chapterPath);
                    return;
                }

                const now = Date.now();
                const startingUntil = chapterStartingUntilRef.current.get(chapterPath) ?? 0;
                const shouldKeepPolling = res.status === 'processing' || (startingUntil > 0 && now < startingUntil);

                if (shouldKeepPolling) {
                    scheduleChapterPoll(chapterPath, () => {
                        void pollChapterUntilDone(chapterPath);
                    }, 500);
                } else {
                    stopChapterPolling(chapterPath);
                    chapterStartingUntilRef.current.delete(chapterPath);
                }
            } finally {
                chapterPollInFlightRef.current.delete(chapterPath);
            }
        },
        [refreshChapterOcrStatus, scheduleChapterPoll, stopChapterPolling],
    );

    const startChapterOcr = useCallback(
        async (chapterPath: string) => {
            // Give immediate UI feedback and keep polling briefly even if the server still reports idle.
            chapterStartingUntilRef.current.set(chapterPath, Date.now() + 10_000);
            setChapterOcrStatusMap((prev) => {
                const next = new Map(prev);
                const existing = next.get(chapterPath);
                const optimisticTotal = (() => {
                    if (!existing) return 0;
                    if (existing.status === 'processing') return existing.total;
                    if (existing.status === 'idle') return existing.total;
                    return 0;
                })();
                next.set(chapterPath, { status: 'processing', progress: 0, total: optimisticTotal });
                return next;
            });

            void pollChapterUntilDone(chapterPath);

            const baseUrl = buildChapterBaseUrl(chapterPath);
            const current = await checkChapterStatus(baseUrl, creds, settings.yomitanLanguage);
            setChapterOcrStatusMap((prev) => new Map(prev).set(chapterPath, current));

            if (current.status === 'processed') {
                stopChapterPolling(chapterPath);
                chapterStartingUntilRef.current.delete(chapterPath);
                return;
            }

            if (current.status === 'processing') {
                // Job already running, polling will pick it up.
                return;
            }

            try {
                await preprocessChapter(baseUrl, chapterPath, creds, settings.yomitanLanguage);
            } catch (err) {
                // If enqueue failed, reset status to idle snapshot.
                console.error(err);
                chapterStartingUntilRef.current.delete(chapterPath);
                stopChapterPolling(chapterPath);
                setChapterOcrStatusMap((prev) => new Map(prev).set(chapterPath, current));
            }
        },
        [creds, pollChapterUntilDone, settings.yomitanLanguage, stopChapterPolling],
    );

    const deleteChapterOcr = useCallback(
        async (chapterPath: string, deleteData: boolean = true) => {
            stopChapterPolling(chapterPath);
            chapterStartingUntilRef.current.delete(chapterPath);

            const baseUrl = buildChapterBaseUrl(chapterPath);
            await deleteChapterOcrRequest(baseUrl, creds, settings.yomitanLanguage, deleteData);

            setChapterOcrStatusMap((prev) => {
                const next = new Map(prev);
                next.set(chapterPath, { status: 'idle', cached: 0, total: 0 });
                return next;
            });
        },
        [creds, settings.yomitanLanguage, stopChapterPolling],
    );

    // --- Dialog Helpers ---
    
    const showDialog = useCallback((config: Partial<DialogState>) => {
        setDialogState(prev => ({ 
            ...prev, 
            isOpen: true, 
            onConfirm: undefined, 
            onCancel: undefined,
            ...({ confirmText: undefined, cancelText: undefined, extraAction: undefined } as any),
            ...config 
        }));
    }, []);

    const closeDialog = useCallback(() => {
        setDialogState(prev => ({ ...prev, isOpen: false }));
    }, []);

    const showConfirm = useCallback((title: string, message: React.ReactNode, onConfirm: () => void) => {
        showDialog({ type: 'confirm', title, message, onConfirm });
    }, [showDialog]);

    const showAlert = useCallback((title: string, message: React.ReactNode) => {
        showDialog({ type: 'alert', title, message });
    }, [showDialog]);

    const showProgress = useCallback((message: string) => {
        showDialog({ type: 'progress', title: 'Processing', message });
    }, [showDialog]);

    useEffect(() => {
        let cancelled = false;

        const loadSettingsFromServer = async () => {
            const legacySettings = readLegacyManatanSettings();
            try {
                const serverSettings = await getServerMetaJson<Partial<Settings> | null>(MANATAN_SETTINGS_META_KEY, null);
                if (cancelled) {
                    return;
                }

                if (serverSettings && typeof serverSettings === 'object') {
                    setSettings(getSettingsWithDefaults(serverSettings));
                } else if (legacySettings) {
                    const migratedSettings = getSettingsWithDefaults(legacySettings);
                    setSettings(migratedSettings);
                    await setServerMetaJson(MANATAN_SETTINGS_META_KEY, migratedSettings);
                }
            } catch (error) {
                console.error('[Manatan Settings] Failed to load server settings metadata:', error);
            } finally {
                if (!cancelled) {
                    hasHydratedServerSettingsRef.current = true;
                }
            }
        };

        void loadSettingsFromServer();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!hasHydratedServerSettingsRef.current) {
            return;
        }

        if (saveServerSettingsTimeoutRef.current !== undefined) {
            window.clearTimeout(saveServerSettingsTimeoutRef.current);
        }

        saveServerSettingsTimeoutRef.current = window.setTimeout(() => {
            void setServerMetaJson(MANATAN_SETTINGS_META_KEY, settings).catch((error) => {
                console.error('[Manatan Settings] Failed to persist settings to server metadata:', error);
            });
        }, 300);

        return () => {
            if (saveServerSettingsTimeoutRef.current !== undefined) {
                window.clearTimeout(saveServerSettingsTimeoutRef.current);
            }
        };
    }, [settings]);

    useEffect(() => {
        const theme = COLOR_THEMES[settings.colorTheme] || COLOR_THEMES.blue;
        document.documentElement.style.setProperty('--ocr-accent', theme.accent);

        // Updated Dark Mode Logic to use Theme instead of Brightness
        if (settings.colorTheme === 'dark') {
            document.documentElement.style.setProperty('--ocr-bg', '#1a1d21');
            document.documentElement.style.setProperty('--ocr-text-color', '#eaeaea');
        } else {
            document.documentElement.style.setProperty('--ocr-bg', '#ffffff');
            document.documentElement.style.setProperty('--ocr-text-color', '#000000');
        }

        document.documentElement.style.setProperty('--ocr-opacity', settings.dimmedOpacity.toString());
        document.documentElement.style.setProperty('--ocr-scale', settings.focusScaleMultiplier.toString());

        if (settings.mobileMode) document.body.classList.add('mobile-mode');
        else document.body.classList.remove('mobile-mode');
    }, [settings]);

    useEffect(() => {
        // OCR cache keys are language-scoped; invalidate chapter statuses when language changes.
        setChapterOcrStatusMap(new Map());
        stopAllChapterPolling();
    }, [settings.yomitanLanguage, stopAllChapterPolling]);

    useEffect(() => {
        const prevPathname = prevPathnameRef.current;
        const nextPathname = location.pathname;
        prevPathnameRef.current = nextPathname;

        // When leaving the reader, chapter OCR statuses become stale because pages may have been
        // OCR'd on-demand. Invalidate that manga's chapter statuses so the manga page re-fetches.
        const prevReaderMatch = prevPathname.match(/^\/manga\/(\d+)\/chapter\//);
        const nextIsReader = /^\/manga\/\d+\/chapter\//.test(nextPathname);
        if (prevReaderMatch && !nextIsReader) {
            const mangaId = prevReaderMatch[1];
            const prefix = `/manga/${mangaId}/chapter/`;
            setChapterOcrStatusMap((prev) => {
                const next = new Map(prev);
                Array.from(next.keys()).forEach((key) => {
                    if (key.startsWith(prefix)) next.delete(key);
                });
                return next;
            });
        }
    }, [location.pathname]);

    const contextValue = useMemo(
        () => ({
            settings, setSettings, serverSettings,
            isSettingsOpen, openSettings, closeSettings,
            isSetupOpen, openSetup, closeSetup,
            ocrCache, updateOcrData, ocrStatusMap, setOcrStatus,
            chapterOcrStatusMap, refreshChapterOcrStatus, startChapterOcr, deleteChapterOcr,
            mergeAnchor, setMergeAnchor, activeImageSrc, setActiveImageSrc,
            dictPopup, setDictPopup, notifyPopupClosed, wasPopupClosedRecently,
            debugLog, addLog,
            dialogState, showDialog, closeDialog, showConfirm, showAlert, showProgress
        }),
        [
            settings, serverSettings, 
            isSettingsOpen, openSettings, closeSettings,
            isSetupOpen, openSetup, closeSetup,
            ocrCache, updateOcrData, ocrStatusMap, setOcrStatus, 
            chapterOcrStatusMap, refreshChapterOcrStatus, startChapterOcr, deleteChapterOcr,
            mergeAnchor, activeImageSrc, dictPopup, notifyPopupClosed, wasPopupClosedRecently,
            debugLog, addLog,
            dialogState, showDialog, closeDialog, showConfirm, showAlert, showProgress
        ],
    );

    return <OCRContext.Provider value={contextValue}>{children}</OCRContext.Provider>;
};

export const useOCR = () => {
    const context = useContext(OCRContext);
    if (!context) throw new Error('useOCR must be used within OCRProvider');
    return context;
};
