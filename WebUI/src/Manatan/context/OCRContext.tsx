import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback, useRef } from 'react';
import { Settings, DEFAULT_SETTINGS, MergeState, OcrBlock, COLOR_THEMES, ServerSettingsData, DictPopupState, OcrStatus, DialogState } from '@/Manatan/types';
import { requestManager } from '@/lib/requests/RequestManager';
import { AppStorage } from '@/lib/storage/AppStorage.ts';

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

export const OCRProvider = ({ children }: { children: ReactNode }) => {
    const { data: serverSettingsData } = requestManager.useGetServerSettings();
    const serverSettings: ServerSettingsData | null = serverSettingsData?.settings || null;

    const [settings, setSettings] = useState<Settings>(() => {
        try {
            const saved = AppStorage.local.getItem('mangatan_settings_v3');
            if (saved) {
                // Ensure legacy settings are cleaned up if necessary
                const parsed = JSON.parse(saved);
                if ('brightnessMode' in parsed) delete parsed.brightnessMode;
                if (parsed.ankiFieldMap) {
                    parsed.ankiFieldMap = Object.fromEntries(
                        Object.entries(parsed.ankiFieldMap).map(([key, value]) => [
                            key,
                            value === 'Definition' ? 'Glossary' : value,
                        ]),
                    );
                }
                return { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (e) { console.error("Failed to load settings", e); }
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        return { 
            ...DEFAULT_SETTINGS, 
            mobileMode: isMobile, 
        };
    });

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
        AppStorage.local.setItem('mangatan_settings_v3', JSON.stringify(settings));
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

    const contextValue = useMemo(
        () => ({
            settings, setSettings, serverSettings,
            isSettingsOpen, openSettings, closeSettings,
            isSetupOpen, openSetup, closeSetup,
            ocrCache, updateOcrData, ocrStatusMap, setOcrStatus,
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
