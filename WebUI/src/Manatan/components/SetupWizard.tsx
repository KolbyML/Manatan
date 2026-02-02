import { useEffect, useState } from 'react';

import { AppStorage } from '@/lib/storage/AppStorage.ts';
import { useOCR } from '@/Manatan/context/OCRContext';
import { apiRequest } from '@/Manatan/utils/api';
import type { YomitanLanguage } from '@/Manatan/types';

const SETUP_KEY = 'manatan_setup_complete_v1';

type SetupStep = 'dictionary' | 'language' | 'jimaku';
type DictionaryChoice = 'builtin' | 'custom';

const languageOptions: { value: YomitanLanguage; label: string }[] = [
    { value: 'japanese', label: 'Japanese' },
    { value: 'english', label: 'English' },
    { value: 'chinese', label: 'Chinese' },
    { value: 'korean', label: 'Korean' },
    { value: 'arabic', label: 'Arabic' },
    { value: 'spanish', label: 'Spanish' },
    { value: 'french', label: 'French' },
    { value: 'german', label: 'German' },
    { value: 'portuguese', label: 'Portuguese' },
    { value: 'bulgarian', label: 'Bulgarian' },
    { value: 'cantonese', label: 'Cantonese' },
    { value: 'czech', label: 'Czech' },
    { value: 'danish', label: 'Danish' },
    { value: 'estonian', label: 'Estonian' },
    { value: 'finnish', label: 'Finnish' },
    { value: 'georgian', label: 'Georgian' },
    { value: 'greek', label: 'Greek' },
    { value: 'hebrew', label: 'Hebrew' },
    { value: 'hindi', label: 'Hindi' },
    { value: 'hungarian', label: 'Hungarian' },
    { value: 'indonesian', label: 'Indonesian' },
    { value: 'italian', label: 'Italian' },
    { value: 'kannada', label: 'Kannada' },
    { value: 'khmer', label: 'Khmer' },
    { value: 'lao', label: 'Lao' },
    { value: 'latin', label: 'Latin' },
    { value: 'latvian', label: 'Latvian' },
    { value: 'maltese', label: 'Maltese' },
    { value: 'mongolian', label: 'Mongolian' },
    { value: 'dutch', label: 'Dutch' },
    { value: 'norwegian', label: 'Norwegian' },
    { value: 'persian', label: 'Persian' },
    { value: 'polish', label: 'Polish' },
    { value: 'romanian', label: 'Romanian' },
    { value: 'russian', label: 'Russian' },
    { value: 'swedish', label: 'Swedish' },
    { value: 'tagalog', label: 'Tagalog' },
    { value: 'thai', label: 'Thai' },
    { value: 'turkish', label: 'Turkish' },
    { value: 'ukrainian', label: 'Ukrainian' },
    { value: 'vietnamese', label: 'Vietnamese' },
    { value: 'welsh', label: 'Welsh' },
];

export const SetupWizard = () => {
    const { settings, setSettings, isSetupOpen, closeSetup, showProgress, closeDialog, showAlert } = useOCR();

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isNativeApp = ua.includes('MangatanNative') || ua.includes('ManatanNative');
    const isAndroidBrowser = isAndroid && !isNativeApp;
    const showFirstPage = !isIOS && (isAndroidBrowser || (!isAndroid && !isIOS));

    const [isFirstRun, setIsFirstRun] = useState(() => !AppStorage.local.getItem(SETUP_KEY));

    const [step, setStep] = useState<SetupStep>('dictionary');
    const [dictionaryChoice, setDictionaryChoice] = useState<DictionaryChoice>('builtin');
    const [language, setLanguage] = useState<YomitanLanguage>(settings.yomitanLanguage || 'japanese');
    const [initialLanguage, setInitialLanguage] = useState<YomitanLanguage>(settings.yomitanLanguage || 'japanese');
    const [jimakuKey, setJimakuKey] = useState(settings.jimakuApiKey ?? '');
    const [isInstalling, setIsInstalling] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!isSetupOpen) return;
        setDictionaryChoice(showFirstPage ? 'builtin' : (settings.enableYomitan ? 'builtin' : 'custom'));
        const currentLanguage = settings.yomitanLanguage || 'japanese';
        setLanguage(currentLanguage);
        setInitialLanguage(currentLanguage);
        setJimakuKey(settings.jimakuApiKey ?? '');
        setErrorMessage(null);
        setIsFirstRun(!AppStorage.local.getItem(SETUP_KEY));
        setStep(showFirstPage ? 'dictionary' : 'language');
    }, [isSetupOpen, settings.enableYomitan, settings.jimakuApiKey, settings.yomitanLanguage, showFirstPage]);

    if (!isSetupOpen) return null;

    const shouldEnableBuiltIn = !showFirstPage || dictionaryChoice === 'builtin';

    const finalizeSetup = async () => {
        setErrorMessage(null);
        const shouldReset = shouldEnableBuiltIn && !isFirstRun && initialLanguage !== language;
        setSettings((prev) => ({
            ...prev,
            enableYomitan: shouldEnableBuiltIn,
            yomitanLanguage: language,
            jimakuApiKey: jimakuKey,
        }));

        if (shouldEnableBuiltIn) {
            try {
                setIsInstalling(true);
                const progressMessage = shouldReset
                    ? 'Resetting dictionary database...'
                    : 'Downloading and installing dictionary...';
                showProgress(progressMessage);
                const res = await apiRequest<{ status: string; message?: string }>(
                    shouldReset ? '/api/yomitan/reset' : '/api/yomitan/install-language',
                    { method: 'POST', body: { language } },
                );
                if (res.status !== 'ok') {
                    throw new Error(res.message || 'Dictionary install failed.');
                }
            } catch (e) {
                setIsInstalling(false);
                const message = e instanceof Error ? e.message : 'Dictionary install failed.';
                setErrorMessage(message);
                showAlert('Dictionary Error', message);
                return;
            } finally {
                closeDialog();
            }
            setIsInstalling(false);
        }

        AppStorage.local.setItem(SETUP_KEY, 'true');
        setIsFirstRun(false);
        closeSetup();
    };

    const handleNext = async () => {
        if (step === 'dictionary') {
            if (dictionaryChoice === 'custom') {
                await finalizeSetup();
                return;
            }
            setStep('language');
            return;
        }

        if (step === 'language') {
            if (language === 'japanese') {
                setStep('jimaku');
                return;
            }
            await finalizeSetup();
            return;
        }

        if (step === 'jimaku') {
            await finalizeSetup();
        }
    };

    const handleBack = () => {
        if (step === 'jimaku') {
            setStep('language');
            return;
        }
        if (step === 'language' && showFirstPage) {
            setStep('dictionary');
        }
    };

    const isFinalStep =
        (step === 'dictionary' && dictionaryChoice === 'custom') ||
        (step === 'language' && language !== 'japanese') ||
        step === 'jimaku';

    return (
        <div className="ocr-modal-overlay">
            <div className="ocr-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ocr-modal-header">
                    <h2>Welcome to Manatan</h2>
                </div>
                <div className="ocr-modal-content">
                    {step === 'dictionary' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ fontSize: '0.95em', color: '#bbb' }}>
                                Choose how you want to handle dictionary lookups.
                            </div>
                            <div style={{ display: 'grid', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setDictionaryChoice('builtin')}
                                    style={{
                                        textAlign: 'left',
                                        padding: '14px 16px',
                                        borderRadius: '10px',
                                        border: dictionaryChoice === 'builtin' ? '2px solid var(--ocr-accent)' : '1px solid #3a3a3a',
                                        background: dictionaryChoice === 'builtin' ? 'rgba(39, 174, 96, 0.08)' : '#1b1b1f',
                                        color: 'white',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>Use built-in Manatan Popup Dictionary</div>
                                    <div style={{ fontSize: '0.85em', color: '#aaa', marginTop: '6px' }}>
                                        Installs a dictionary automatically and enables popups.
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDictionaryChoice('custom')}
                                    style={{
                                        textAlign: 'left',
                                        padding: '14px 16px',
                                        borderRadius: '10px',
                                        border: dictionaryChoice === 'custom' ? '2px solid var(--ocr-accent)' : '1px solid #3a3a3a',
                                        background: dictionaryChoice === 'custom' ? 'rgba(39, 174, 96, 0.08)' : '#1b1b1f',
                                        color: 'white',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>Bring your own dictionary</div>
                                    <div style={{ fontSize: '0.85em', color: '#aaa', marginTop: '6px' }}>
                                        Skip auto-install and manage dictionaries manually.
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'language' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ fontSize: '0.95em', color: '#bbb' }}>
                                Which language are you learning?
                            </div>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value as YomitanLanguage)}
                                style={{
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #444',
                                    background: '#222',
                                    color: 'white',
                                }}
                            >
                                {languageOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <div style={{ fontSize: '0.85em', color: '#aaa' }}>
                                We will install the dictionary for this language.
                            </div>
                        </div>
                    )}

                    {step === 'jimaku' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ fontSize: '0.95em', color: '#bbb' }}>
                                Jimaku API Key (Optional)
                            </div>
                            <input
                                type="password"
                                value={jimakuKey}
                                onChange={(e) => setJimakuKey(e.target.value)}
                                placeholder="Paste Jimaku API key"
                            />
                            <div style={{ fontSize: '0.85em', color: '#aaa' }}>
                                Optional, but required to auto fetch Japanese subtitles.
                                <div>
                                    Get an API key from{' '}
                                    <a href="https://jimaku.cc" target="_blank" rel="noreferrer">jimaku.cc</a>
                                </div>
                                <div>
                                    1. Sign up here: <a href="https://jimaku.cc/account" target="_blank" rel="noreferrer">https://jimaku.cc/account</a>
                                </div>
                                <div>2. Generate an API key under the "API" heading and copy it</div>
                            </div>
                        </div>
                    )}

                    {errorMessage && (
                        <div style={{ marginTop: '12px', color: '#e74c3c', fontSize: '0.9em' }}>
                            {errorMessage}
                        </div>
                    )}
                </div>
                <div className="ocr-modal-footer">
                    {(step === 'language' && showFirstPage) || step === 'jimaku' ? (
                        <button type="button" onClick={handleBack} disabled={isInstalling}>Back</button>
                    ) : (
                        <div />
                    )}
                    {!isFirstRun && (
                        <button type="button" onClick={closeSetup} disabled={isInstalling}>Close</button>
                    )}
                    <button
                        type="button"
                        className="primary"
                        onClick={handleNext}
                        disabled={isInstalling}
                    >
                        {isInstalling ? 'Installing...' : isFinalStep ? 'Finish' : 'Continue'}
                    </button>
                </div>
            </div>
        </div>
    );
};
