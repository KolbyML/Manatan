import { useEffect } from 'react';
import { useReaderSettingsStore, useReaderPagesStore } from '@/features/reader/stores/ReaderStore.ts';
import { useMangaObserver } from './hooks/useMangaObserver';
import { ImageOverlay } from './components/ImageOverlay';
import { SettingsModal } from './components/SettingsModal';
import { SettingsInjector } from './components/SettingsInjector';
import { YomitanPopup } from './components/YomitanPopup'; 
import { useOCR } from './context/OCRContext';
import { GlobalDialog } from './components/GlobalDialog';
import { SetupWizard } from './components/SetupWizard';
import { getAppVersion, checkForUpdates, triggerAppUpdate } from './utils/api';
import { ReadingDirection, ReadingMode } from '@/features/reader/Reader.types.ts';

export const OCRManager = () => {
    const images = useMangaObserver(); 
    const { showDialog, showAlert, isSettingsOpen, closeSettings } = useOCR();    
    
    // FIX: Removed 'refreshKey' state and resize listener.
    // This stops the app from destroying/recreating overlays every time you scroll (URL bar resize).
    // ImageOverlay now handles resizing internally via ResizeObserver.

    const pages = useReaderPagesStore((state) => state.pages.pages);
    const { readingMode, readingDirection } = useReaderSettingsStore((state) => ({
        readingMode: state.settings.readingMode.value,
        readingDirection: state.settings.readingDirection.value
    }));

    const getSpreadData = (imgSrc: string) => {
        if (!pages || pages.length === 0) return undefined;
        if (readingMode !== ReadingMode.DOUBLE_PAGE) return undefined;

        const page = pages.find(p =>
            imgSrc.includes(p.primary.url) || (p.secondary && imgSrc.includes(p.secondary.url))
        );

        if (!page || !page.secondary) return undefined;

        const p1 = page.primary; 
        const p2 = page.secondary; 

        const isRTL = readingDirection === ReadingDirection.RTL;

        if (isRTL) {
            return { leftSrc: p2.url, rightSrc: p1.url };
        } else {
            return { leftSrc: p1.url, rightSrc: p2.url };
        }
    };

    // --- AUTO-UPDATE CHECK (Android Only) ---
    useEffect(() => {
        const check = async () => {
            const isAndroid = /Android/i.test(navigator.userAgent);
            if (!isAndroid) return;

            const info = await getAppVersion();
            if (!info || info.version === '0.0.0' || info.variant === 'unknown') return; 

            const update = await checkForUpdates(info.version, info.variant);
            
            if (update.hasUpdate) {
                showDialog({
                    type: 'confirm',
                    title: 'Update Available',
                    message: (
                        <div>
                            <p>Version <b>{update.version}</b> is available.</p>
                            <p style={{ margin: '15px 0', fontSize: '0.9em' }}>
                                <a 
                                    href={update.releaseUrl} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    style={{ color: 'var(--ocr-accent)', textDecoration: 'underline' }}
                                >
                                    View Change Log (GitHub)
                                </a>
                            </p>
                        </div>
                    ),
                    // @ts-ignore 
                    confirmText: 'Download',
                    cancelText: 'Cancel',
                    onConfirm: async () => {
                        try {
                            if (update.url && update.name) {
                                await triggerAppUpdate(update.url, update.name);
                                showAlert('Downloading', 'The update is downloading in the background.\nPlease check your notification tray.');
                            }
                        } catch (e) {
                            showAlert('Error', 'Failed to start download.');
                        }
                    }
                });
            }
        };
        
        check();
    }, [showDialog, showAlert]);

    useEffect(() => {
        const checkUrl = () => {
            const isReader = window.location.href.includes('/chapter/');
            if (isReader) {
                document.documentElement.classList.add('ocr-reader-mode');
            } else {
                document.documentElement.classList.remove('ocr-reader-mode');
            }
        };

        checkUrl();
        const interval = setInterval(checkUrl, 500);
        return () => {
            clearInterval(interval);
            document.documentElement.classList.remove('ocr-reader-mode');
        };
    }, []);

    return (
        <>
            <SettingsInjector />
            <GlobalDialog />
            <SetupWizard />
            
            {images.map(img => (
                <ImageOverlay key={img.src} img={img} spreadData={getSpreadData(img.src)} />
            ))}
            
            <YomitanPopup />

            {isSettingsOpen && <SettingsModal onClose={closeSettings} />}
        </>
    );
};
