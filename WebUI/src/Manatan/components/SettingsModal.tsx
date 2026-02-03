import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { bindTrigger, usePopupState } from 'material-ui-popup-state/hooks';
import { useOCR } from '@/Manatan/context/OCRContext';
import { AppStorage } from '@/lib/storage/AppStorage.ts';
import { COLOR_THEMES, DEFAULT_SETTINGS } from '@/Manatan/types';
import { apiRequest, getAppVersion, checkForUpdates, triggerAppUpdate, installAppUpdate, getFrequencyDictionaries, getDictionaries } from '@/Manatan/utils/api';
import { DictionaryManager } from './DictionaryManager';
import { getAnkiVersion, getDeckNames, getModelNames, getModelFields } from '@/Manatan/utils/anki';
import { ResetButton } from '@/base/components/buttons/ResetButton.tsx';
import { Hotkey } from '@/features/reader/hotkeys/settings/components/Hotkey.tsx';
import { RecordHotkey } from '@/features/reader/hotkeys/settings/components/RecordHotkey.tsx';
import { AnimeHotkey, ANIME_HOTKEYS, ANIME_HOTKEY_LABELS, DEFAULT_ANIME_HOTKEYS } from '@/Manatan/hotkeys/AnimeHotkeys.ts';

const checkboxLabelStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer', textAlign: 'left', 
};

const checkboxInputStyle: React.CSSProperties = {
    width: 'auto', marginRight: '10px', flexShrink: 0, cursor: 'pointer',
};

const sectionBoxStyle: React.CSSProperties = {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 'var(--settings-section-padding, 15px)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    marginBottom: 'var(--settings-section-margin, 20px)',
};

const statusDotStyle = (connected: boolean): React.CSSProperties => ({
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: connected ? '#2ecc71' : '#e74c3c',
    display: 'inline-block',
    marginRight: '8px',
    boxShadow: connected ? '0 0 5px #2ecc71' : 'none'
});

const hotkeyRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
};

const inlineInputWrapperStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
};

const inlineInputActionsStyle: React.CSSProperties = {
    position: 'absolute',
    right: 6,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
};

const inlineInputStyle: React.CSSProperties = {
    paddingRight: '94px',
};

const inlineInputCompactStyle: React.CSSProperties = {
    paddingRight: '42px',
};

const unitToggleStyle = (active: boolean): React.CSSProperties => ({
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid #444',
    background: active ? '#444' : '#222',
    color: '#fff',
    fontSize: '0.75em',
    cursor: 'pointer',
});

const AnimeHotkeyRow = ({
    hotkey,
    keys,
    existingKeys,
    onChange,
}: {
    hotkey: AnimeHotkey;
    keys: string[];
    existingKeys: string[];
    onChange: (keys: string[]) => void;
}) => {
    const popupState = usePopupState({ popupId: `manatan-record-hotkey-${hotkey}`, variant: 'dialog' });

    return (
        <div style={hotkeyRowStyle}>
            <Typography variant="body2" sx={{ minWidth: 200, flexGrow: 1 }}>
                {ANIME_HOTKEY_LABELS[hotkey]}
            </Typography>
            <Hotkey
                keys={keys}
                removeKey={(keyToRemove) => onChange(keys.filter((key) => key !== keyToRemove))}
            />
            <IconButton {...bindTrigger(popupState)} size="small" color="inherit" aria-label="Add hotkey">
                <AddIcon fontSize="small" />
            </IconButton>
            <ResetButton asIconButton onClick={() => onChange(DEFAULT_ANIME_HOTKEYS[hotkey])} />
            {popupState.isOpen && (
                <RecordHotkey
                    onClose={popupState.close}
                    onCreate={(recordedKeys) => onChange([...keys, ...recordedKeys])}
                    existingKeys={existingKeys}
                    disablePortal
                />
            )}
        </div>
    );
};

const BASE_MAPPING_OPTIONS = [
    'None',
    'Sentence',
    'Sentence Furigana',
    'Sentence Audio',
    'Word Audio',
    'Image',
    'Furigana',
    'Reading',
    'Target Word',
    'Glossary',
    'Frequency',
];

const SINGLE_GLOSSARY_PREFIX = 'Single Glossary ';

const getSingleGlossaryName = (value: string): string | null => {
    if (value.startsWith(SINGLE_GLOSSARY_PREFIX)) {
        const name = value.slice(SINGLE_GLOSSARY_PREFIX.length).trim();
        return name ? name : null;
    }
    if (value.startsWith('Single Glossary:')) {
        const name = value.replace('Single Glossary:', '').trim();
        return name ? name : null;
    }
    return null;
};
export const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { settings, setSettings, showConfirm, showAlert, showProgress, closeDialog, showDialog, openSetup } = useOCR();
    const [localSettings, setLocalSettings] = useState(settings);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dictManagerKey, setDictManagerKey] = useState(0);
    const [dictionaryNames, setDictionaryNames] = useState<string[]>([]);
    const popupWidthUnit = localSettings.animePopupWidthUnit ?? 'percent';
    const popupHeightUnit = localSettings.animePopupHeightUnit ?? 'percent';
    const popupTopUnit = localSettings.animePopupTopOffsetUnit ?? 'percent';
    const popupLeftUnit = localSettings.animePopupLeftOffsetUnit ?? 'percent';
    const popupWidthValue = popupWidthUnit === 'px'
        ? localSettings.animePopupWidthPx
        : localSettings.animePopupWidthPercent;
    const popupHeightValue = popupHeightUnit === 'px'
        ? localSettings.animePopupHeightPx
        : localSettings.animePopupHeightPercent;
    const popupTopValue = popupTopUnit === 'px'
        ? localSettings.animePopupTopOffsetPx
        : localSettings.animePopupTopOffsetPercent;
    const popupLeftValue = popupLeftUnit === 'px'
        ? localSettings.animePopupLeftOffsetPx
        : localSettings.animePopupLeftOffsetPercent;
    const yomitanPopupWidthValue = Number.isFinite(localSettings.yomitanPopupWidthPx)
        ? localSettings.yomitanPopupWidthPx
        : DEFAULT_SETTINGS.yomitanPopupWidthPx;
    const yomitanPopupHeightValue = Number.isFinite(localSettings.yomitanPopupHeightPx)
        ? localSettings.yomitanPopupHeightPx
        : DEFAULT_SETTINGS.yomitanPopupHeightPx;
    const yomitanPopupScaleValue = Number.isFinite(localSettings.yomitanPopupScalePercent)
        ? localSettings.yomitanPopupScalePercent
        : DEFAULT_SETTINGS.yomitanPopupScalePercent;
    const persistSettings = useCallback((nextSettings: typeof settings) => {
        AppStorage.local.setItem('mangatan_settings_v3', JSON.stringify(nextSettings));
        setSettings(nextSettings);
    }, [setSettings]);
    const animeHotkeys = useMemo(
        () => ({
            ...DEFAULT_ANIME_HOTKEYS,
            ...(localSettings.animeHotkeys ?? {}),
        }),
        [localSettings.animeHotkeys],
    );
    const existingAnimeHotkeys = useMemo(() => Object.values(animeHotkeys).flat(), [animeHotkeys]);

    useEffect(() => {
        let cancelled = false;
        const fetchDictionaries = async () => {
            const list = await getDictionaries();
            if (!list || cancelled) {
                if (!cancelled) {
                    setTimeout(fetchDictionaries, 1000);
                }
                return;
            }
            const names = Array.from(new Set(list.map((dict) => dict.name).filter(Boolean)));
            setDictionaryNames(names);
            setLocalSettings((prev) => {
                if (!prev.ankiFieldMap) {
                    return prev;
                }
                let changed = false;
                const nextMap = { ...prev.ankiFieldMap };
                Object.entries(nextMap).forEach(([field, value]) => {
                    if (typeof value !== 'string') {
                        return;
                    }
                    const name = getSingleGlossaryName(value);
                    if (name && !names.includes(name)) {
                        nextMap[field] = 'None';
                        changed = true;
                    }
                });
                if (!changed) {
                    return prev;
                }
                const next = { ...prev, ankiFieldMap: nextMap };
                persistSettings(next);
                return next;
            });
        };
        fetchDictionaries();
        return () => {
            cancelled = true;
        };
    }, [dictManagerKey, persistSettings]);

    const mappingOptions = useMemo(() => {
        const baseOptions = BASE_MAPPING_OPTIONS.map((option) => ({ value: option, label: option }));
        const glossaryOptions = dictionaryNames.map((name) => ({
            value: `${SINGLE_GLOSSARY_PREFIX}${name}`,
            label: `${SINGLE_GLOSSARY_PREFIX}${name}`,
        }));

        return [...baseOptions, ...glossaryOptions];
    }, [dictionaryNames, localSettings.ankiFieldMap]);
    const [availableFreqDicts, setAvailableFreqDicts] = useState<string[]>([]);

    const updateAnimeHotkey = useCallback((hotkey: AnimeHotkey, keys: string[]) => {
        setLocalSettings((prev) => {
            const next = {
                ...prev,
                animeHotkeys: {
                    ...DEFAULT_ANIME_HOTKEYS,
                    ...(prev.animeHotkeys ?? {}),
                    [hotkey]: keys,
                },
            };
            persistSettings(next);
            return next;
        });
    }, [persistSettings]);

    // --- ANKI STATE ---
    const [ankiStatus, setAnkiStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
    const [ankiDecks, setAnkiDecks] = useState<string[]>([]);
    const [ankiModels, setAnkiModels] = useState<string[]>([]);
    const [currentModelFields, setCurrentModelFields] = useState<string[]>([]);

    // --- DICT INSTALL STATE ---
    const [isInstalling, setIsInstalling] = useState(false);
    const [installMessage, setInstallMessage] = useState('');

    // --- UPDATE STATE ---
    const [appVersion, setAppVersion] = useState<string>('...');
    const [updateAvailable, setUpdateAvailable] = useState<any>(null);
    const [updateStatus, setUpdateStatus] = useState<string>('idle');

    useEffect(() => {
        const fetchFreqDicts = async () => {
            const dicts = await getFrequencyDictionaries();
            setAvailableFreqDicts(dicts);
        };
        fetchFreqDicts();
    }, []);
    // --- ANKI EFFECT ---
    const fetchAnkiData = async () => {
        if (!localSettings.ankiConnectEnabled) return;
        
        const url = localSettings.ankiConnectUrl || 'http://127.0.0.1:8765';
        setAnkiStatus('loading');
        
        const status = await getAnkiVersion(url);
        if (status.ok) {
            setAnkiStatus('connected');
            try {
                const [d, m] = await Promise.all([
                    getDeckNames(url),
                    getModelNames(url)
                ]);
                setAnkiDecks(d);
                setAnkiModels(m);
            } catch (e) {
                console.error("Failed to fetch anki metadata", e);
            }
        } else {
            setAnkiStatus('error');
        }
    };

    useEffect(() => {
        if (localSettings.ankiConnectEnabled) {
            fetchAnkiData();
        }
    }, [localSettings.ankiConnectEnabled]); 

    // Fetch fields when model changes or when connection is established with a pre-selected model
    useEffect(() => {
        const fetchFields = async () => {
             const url = localSettings.ankiConnectUrl || 'http://127.0.0.1:8765';
             if (ankiStatus === 'connected' && localSettings.ankiModel) {
                 try {
                     const f = await getModelFields(url, localSettings.ankiModel);
                     setCurrentModelFields(f);
                 } catch(e) { console.error(e); }
             }
        };
        fetchFields();
    }, [localSettings.ankiModel, ankiStatus]);


    // --- POLL STATUS ---
    useEffect(() => {
        let isMounted = true;

        const checkStatus = async () => {
            try {
                const info = await getAppVersion();
                if (!isMounted) return;

                if (info.version !== '0.0.0') {
                    setAppVersion(`${info.version} (${info.variant})`);
                }

                if (info.update_status && info.update_status !== 'idle') {
                    setUpdateStatus(info.update_status);
                } 
                else if (info.variant !== 'unknown' && info.variant !== 'desktop' && info.variant !== 'ios') {
                    if (!updateAvailable) {
                        const update = await checkForUpdates(info.version, info.variant);
                        if (isMounted && update.hasUpdate) setUpdateAvailable(update);
                    }
                    if (updateStatus !== 'downloading' && updateStatus !== 'ready') {
                        setUpdateStatus('idle');
                    }
                }
            } catch (e) { console.error(e); }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 2000); 
        return () => { isMounted = false; clearInterval(interval); };
    }, [updateStatus, updateAvailable]); 

    // --- ACTIONS ---

    const handleDownload = () => {
        if (!updateAvailable) return;
        showDialog({
            type: 'confirm',
            title: 'Download Update',
            message: 'Version ' + updateAvailable.version + ' will download in the background.',
            // @ts-ignore
            confirmText: 'Start',
            cancelText: 'Cancel',
            onConfirm: async () => {
                await triggerAppUpdate(updateAvailable.url, updateAvailable.name);
                setUpdateStatus('downloading'); 
            }
        });
    };

    const handleInstall = async () => {
        try {
            await installAppUpdate();
        } catch (e) {
            showAlert('Error', 'Failed to launch installer.');
        }
    };

    // --- SETTINGS LOGIC ---
    const installDictionary = async (language: string) => {
        try {
            setIsInstalling(true);
            setInstallMessage('Checking dictionaries...');

            const res = await apiRequest<{status: string, message: string}>(
                '/api/yomitan/install-language',
                { method: 'POST', body: { language } },
            );

            if (res.status === 'ok' && res.message?.includes('Imported')) {
                setDictManagerKey(prev => prev + 1);
            }
        } catch (e) {
            console.error("Failed to install dictionary", e);
        } finally {
            setIsInstalling(false);
            setInstallMessage('');
        }
    };

    const handleChange = async (key: keyof typeof settings | string, value: any) => {
        setLocalSettings((prev) => {
            const next = { ...prev, [key]: value };
            persistSettings(next);
            return next;
        });

        if (key === 'enableYomitan' && value === true) {
            const language = (key === 'yomitanLanguage' ? value : localSettings.yomitanLanguage) || 'japanese';
            await installDictionary(language);
        }
    };

    const resetPopupWidth = () => {
        handleChange('animePopupWidthUnit', DEFAULT_SETTINGS.animePopupWidthUnit);
        handleChange('animePopupWidthPercent', DEFAULT_SETTINGS.animePopupWidthPercent);
        handleChange('animePopupWidthPx', DEFAULT_SETTINGS.animePopupWidthPx);
    };

    const resetPopupHeight = () => {
        handleChange('animePopupHeightUnit', DEFAULT_SETTINGS.animePopupHeightUnit);
        handleChange('animePopupHeightPercent', DEFAULT_SETTINGS.animePopupHeightPercent);
        handleChange('animePopupHeightPx', DEFAULT_SETTINGS.animePopupHeightPx);
    };

    const resetPopupTop = () => {
        handleChange('animePopupTopOffsetUnit', DEFAULT_SETTINGS.animePopupTopOffsetUnit);
        handleChange('animePopupTopOffsetPercent', DEFAULT_SETTINGS.animePopupTopOffsetPercent);
        handleChange('animePopupTopOffsetPx', DEFAULT_SETTINGS.animePopupTopOffsetPx);
    };

    const resetPopupLeft = () => {
        handleChange('animePopupLeftOffsetUnit', DEFAULT_SETTINGS.animePopupLeftOffsetUnit);
        handleChange('animePopupLeftOffsetPercent', DEFAULT_SETTINGS.animePopupLeftOffsetPercent);
        handleChange('animePopupLeftOffsetPx', DEFAULT_SETTINGS.animePopupLeftOffsetPx);
    };

    const resetYomitanPopupWidth = () => {
        handleChange('yomitanPopupWidthPx', DEFAULT_SETTINGS.yomitanPopupWidthPx);
    };

    const resetYomitanPopupHeight = () => {
        handleChange('yomitanPopupHeightPx', DEFAULT_SETTINGS.yomitanPopupHeightPx);
    };

    const resetYomitanPopupScale = () => {
        handleChange('yomitanPopupScalePercent', DEFAULT_SETTINGS.yomitanPopupScalePercent);
    };

    const handleFieldMapChange = (ankiField: string, mapValue: string) => {
        const currentMap = (localSettings.ankiFieldMap as Record<string, string>) || {};
        const newMap = { ...currentMap, [ankiField]: mapValue };

        // Ensure "Target Word" is unique
        if (mapValue === 'Target Word') {
            Object.keys(newMap).forEach(key => {
                if (key !== ankiField && newMap[key] === 'Target Word') {
                    newMap[key] = 'None';
                }
            });
        }

        handleChange('ankiFieldMap', newMap);
    };

    // New helper to handle the inverted selection (Content -> Field)
    const handleContentToFieldChange = (contentType: string, targetField: string) => {
        const newMap = { ...localSettings.ankiFieldMap };

        // 1. Remove this content type from any other fields to prevent duplicates
        Object.keys(newMap).forEach(key => {
            if (newMap[key] === contentType) {
                delete newMap[key]; 
            }
        });

        // 2. Assign the content type to the new target field
        if (targetField) {
            newMap[targetField] = contentType;
        }

        handleChange('ankiFieldMap', newMap);
    };

    // Helper to find the field currently mapped to a specific content type
    const getFieldForContent = (contentType: string) => {
        return Object.keys(localSettings.ankiFieldMap || {}).find(key => localSettings.ankiFieldMap?.[key] === contentType) || '';
    };

    const resetToDefaults = () => {
        showConfirm('Reset?', 'Revert to defaults?', () => {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const next = { ...DEFAULT_SETTINGS, mobileMode: isMobile };
            setLocalSettings(next);
            persistSettings(next);
            closeDialog();
        });
    };

    const purgeCache = () => {
        showConfirm('Purge Cache?', 'Delete server cache?', async () => {
            try {
                showProgress('Purging...');
                await apiRequest(`/api/ocr/purge-cache`, { method: 'POST' });
                closeDialog(); 
                showAlert('Success', 'Cache deleted.');
            } catch (e) { closeDialog(); showAlert('Error', 'Failed.'); }
        });
    };

    const resetYomitanDB = () => {
        showConfirm('Reset DB?', 'Delete all dictionaries?', async () => {
            try {
                showProgress('Resetting...');
                const res = await apiRequest<{status: string}>(`/api/yomitan/reset`, {
                    method: 'POST',
                    body: { language: localSettings.yomitanLanguage || 'japanese' },
                });
                if (res.status === 'ok') {
                    closeDialog(); 
                    showAlert('Success', 'Reset complete.');
                    setDictManagerKey(p => p + 1);
                } else throw new Error();
            } catch (e) { closeDialog(); showAlert('Error', 'Failed.'); }
        });
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (!files.length) {
            return;
        }

        let successCount = 0;
        let failCount = 0;
        const failureMessages: string[] = [];

        for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            const formData = new FormData();
            formData.append('file', file);
            try {
                showProgress(`Importing ${i + 1}/${files.length}...`);
                const res = await fetch('/api/yomitan/import', { method: 'POST', body: formData });
                const json = await res.json();
                if (json.status === 'ok') {
                    successCount += 1;
                } else {
                    failCount += 1;
                    const message = json.message ? String(json.message) : 'Unknown error.';
                    failureMessages.push(`${file.name}: ${message}`);
                }
            } catch (err) {
                failCount += 1;
                failureMessages.push(`${file.name}: ${String(err)}`);
            }
        }

        closeDialog();
        if (successCount > 0) {
            setDictManagerKey((p) => p + 1);
        }
        if (failCount === 0) {
            showAlert('Success', `Imported ${successCount} dictionaries.`);
        } else if (successCount === 0) {
            showAlert('Failed', failureMessages.join('\n') || 'No dictionaries were imported.');
        } else {
            const detail = failureMessages.length
                ? `Failed dictionaries:\n${failureMessages.join('\n')}`
                : 'Some dictionaries failed to import.';
            showAlert(
                'Partial Import',
                `Imported ${successCount} dictionary${successCount === 1 ? '' : 'ies'}.
Failed ${failCount}.
${detail}`,
            );
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const isNativeApp = typeof navigator !== 'undefined'
        && (navigator.userAgent.includes('MangatanNative') || navigator.userAgent.includes('ManatanNative'));
    const isiOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

    const showDicts = isNativeApp || localSettings.enableYomitan;

    return (
        <div
            className="ocr-modal-overlay"
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="ocr-modal settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ocr-modal-content">
                    <h2>Settings</h2>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".zip" multiple onChange={handleFileChange} />

                    {/* --- UPDATE BANNER --- */}
                    {updateStatus === 'downloading' && (
                        <div style={{ backgroundColor: '#f39c12', color: 'white', padding: '15px', borderRadius: '5px', marginBottom: '15px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                <div style={{
                                    width: '18px', height: '18px', 
                                    border: '3px solid rgba(255,255,255,0.3)', 
                                    borderTop: '3px solid white', 
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                <b>Downloading Update...</b>
                            </div>
                            <small style={{opacity: 0.9}}>Please check your notification tray.</small>
                            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                        </div>
                    )}
                    {updateStatus === 'ready' && (
                        <div style={{ backgroundColor: '#27ae60', color: 'white', padding: '10px', borderRadius: '5px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span><b>Download Complete</b></span>
                            <button type="button" onClick={handleInstall} style={{ backgroundColor: 'white', color: '#27ae60', border: 'none', fontWeight: 'bold', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                Install Now
                            </button>
                        </div>
                    )}
                    {updateStatus === 'idle' && updateAvailable && (
                        <div style={{ backgroundColor: '#3498db', color: 'white', padding: '10px', borderRadius: '5px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span><b>New Version:</b> {updateAvailable.version}</span>
                            <button type="button" onClick={handleDownload} style={{ backgroundColor: 'white', color: '#2980b9', border: 'none', fontWeight: 'bold', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                Download
                            </button>
                        </div>
                    )}
                    <div style={{ textAlign: 'center', marginBottom: '10px', color: '#666', fontSize: '0.9em' }}>
                        Version: {appVersion}
                    </div>

                    {/* --- POPUP DICTIONARY SECTION --- */}
                    <h3>Popup Dictionary</h3>
                    <div style={sectionBoxStyle}>
                        <label style={checkboxLabelStyle}>
                            <input 
                                type="checkbox" 
                                checked={localSettings.enableYomitan} 
                                onChange={e => handleChange('enableYomitan', e.target.checked)} 
                                style={checkboxInputStyle} 
                            />
                            <div>
                                Enable Popup Dictionary
                                <div style={{ opacity: 0.6, fontSize: '0.85em' }}>
                                    Shows dictionary popups on hover or tap.
                                </div>
                            </div>
                        </label>

                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label htmlFor="yomitanLanguage" style={{fontSize: '0.9em', color: '#ccc'}}>Dictionary Language</label>
                            <select
                                id="yomitanLanguage"
                                value={localSettings.yomitanLanguage || 'japanese'}
                                onChange={(e) => handleChange('yomitanLanguage', e.target.value)}
                                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white' }}
                            >
                                <option value="japanese">Japanese</option>
                                <option value="english">English</option>
                                <option value="chinese">Chinese</option>
                                <option value="korean">Korean</option>
                                <option value="arabic">Arabic</option>
                                <option value="spanish">Spanish</option>
                                <option value="french">French</option>
                                <option value="german">German</option>
                                <option value="portuguese">Portuguese</option>
                                <option value="bulgarian">Bulgarian</option>
                                <option value="cantonese">Cantonese</option>
                                <option value="czech">Czech</option>
                                <option value="danish">Danish</option>
                                <option value="estonian">Estonian</option>
                                <option value="finnish">Finnish</option>
                                <option value="georgian">Georgian</option>
                                <option value="greek">Greek</option>
                                <option value="hebrew">Hebrew</option>
                                <option value="hindi">Hindi</option>
                                <option value="hungarian">Hungarian</option>
                                <option value="indonesian">Indonesian</option>
                                <option value="italian">Italian</option>
                                <option value="kannada">Kannada</option>
                                <option value="khmer">Khmer</option>
                                <option value="lao">Lao</option>
                                <option value="latin">Latin</option>
                                <option value="latvian">Latvian</option>
                                <option value="maltese">Maltese</option>
                                <option value="mongolian">Mongolian</option>
                                <option value="dutch">Dutch</option>
                                <option value="norwegian">Norwegian</option>
                                <option value="persian">Persian</option>
                                <option value="polish">Polish</option>
                                <option value="romanian">Romanian</option>
                                <option value="russian">Russian</option>
                                <option value="swedish">Swedish</option>
                                <option value="tagalog">Tagalog</option>
                                <option value="thai">Thai</option>
                                <option value="turkish">Turkish</option>
                                <option value="ukrainian">Ukrainian</option>
                                <option value="vietnamese">Vietnamese</option>
                                <option value="welsh">Welsh</option>
                            </select>
                            <div style={{ fontSize: '0.85em', color: '#aaa' }}>
                                Used when installing or resetting default dictionaries.
                            </div>
                        </div>

                        <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label htmlFor="yomitanPopupWidthValue">Popup Width (px)</label>
                                <div style={inlineInputWrapperStyle}>
                                    <input
                                        id="yomitanPopupWidthValue"
                                        type="number"
                                        step="10"
                                        min="280"
                                        max="1920"
                                        value={yomitanPopupWidthValue}
                                        onChange={(e) => handleChange(
                                            'yomitanPopupWidthPx',
                                            parseInt(e.target.value, 10),
                                        )}
                                        style={inlineInputCompactStyle}
                                    />
                                    <div style={inlineInputActionsStyle}>
                                        <IconButton
                                            size="small"
                                            onClick={resetYomitanPopupWidth}
                                            aria-label="Reset popup dictionary width"
                                            style={{ padding: 4 }}
                                        >
                                            <RestartAltIcon fontSize="small" />
                                        </IconButton>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label htmlFor="yomitanPopupHeightValue">Popup Height (px)</label>
                                <div style={inlineInputWrapperStyle}>
                                    <input
                                        id="yomitanPopupHeightValue"
                                        type="number"
                                        step="10"
                                        min="200"
                                        max="1080"
                                        value={yomitanPopupHeightValue}
                                        onChange={(e) => handleChange(
                                            'yomitanPopupHeightPx',
                                            parseInt(e.target.value, 10),
                                        )}
                                        style={inlineInputCompactStyle}
                                    />
                                    <div style={inlineInputActionsStyle}>
                                        <IconButton
                                            size="small"
                                            onClick={resetYomitanPopupHeight}
                                            aria-label="Reset popup dictionary height"
                                            style={{ padding: 4 }}
                                        >
                                            <RestartAltIcon fontSize="small" />
                                        </IconButton>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label htmlFor="yomitanPopupScaleValue">Popup Scale (%)</label>
                            <div style={inlineInputWrapperStyle}>
                                <input
                                    id="yomitanPopupScaleValue"
                                    type="number"
                                    step="5"
                                    min="50"
                                    max="200"
                                    value={yomitanPopupScaleValue}
                                    onChange={(e) => handleChange(
                                        'yomitanPopupScalePercent',
                                        parseInt(e.target.value, 10),
                                    )}
                                    style={inlineInputCompactStyle}
                                />
                                <div style={inlineInputActionsStyle}>
                                    <IconButton
                                        size="small"
                                        onClick={resetYomitanPopupScale}
                                        aria-label="Reset popup dictionary scale"
                                        style={{ padding: 4 }}
                                    >
                                        <RestartAltIcon fontSize="small" />
                                    </IconButton>
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.85em', color: '#aaa', marginTop: '6px' }}>
                            Adjust the popup dictionary size and scale.
                        </div>
                        
                        <div style={{
                            maxHeight: showDicts ? '800px' : '0px',
                            opacity: showDicts ? 1 : 0,
                            overflow: 'hidden',
                            transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out',
                        }}>
                             <div style={{ paddingTop: '15px' }}>
                                 {/* Result Grouping Dropdown */}
                                 <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                     <label htmlFor="groupingMode" style={{fontSize: '0.9em', color: '#ccc'}}>Result Grouping</label>
                                      <select
                                          id="groupingMode"
                                          value={localSettings.resultGroupingMode || 'grouped'}
                                          onChange={(e) => handleChange('resultGroupingMode', e.target.value)}
                                          style={{ padding: '6px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white' }}
                                      >
                                          <option value="grouped">Group by Term</option>
                                          <option value="flat">No Grouping</option>
                                      </select>
                                      <div style={{ fontSize: '0.85em', color: '#aaa' }}>
                                          Group results by term or list every entry.
                                      </div>
                                   </div>
                                    <label style={checkboxLabelStyle}>
                                        <input
                                            type="checkbox"
                                            checked={localSettings.autoPlayWordAudio}
                                            onChange={(e) => handleChange('autoPlayWordAudio', e.target.checked)}
                                            style={checkboxInputStyle}
                                        />
                                        <div>
                                            Auto-play Word Audio
                                            <div style={{ opacity: 0.6, fontSize: '0.85em' }}>
                                                Plays word audio automatically when search results appear.
                                            </div>
                                        </div>
                                    </label>

                                <label style={checkboxLabelStyle}>
                                    <input
                                        type="checkbox"
                                        checked={localSettings.showHarmonicMeanFreq}
                                        onChange={e => handleChange('showHarmonicMeanFreq', e.target.checked)}
                                        style={checkboxInputStyle}
                                    />
                                    <div>
                                        Show Harmonic Mean Frequency
                                        <div style={{ opacity: 0.6, fontSize: '0.85em' }}>
                                            Displays a single harmonic mean value instead of individual frequency dictionaries.
                                        </div>
                                    </div>
                                </label>

                                {isInstalling && (
                                    <div style={{ fontSize: '0.9em', color: '#aaa', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{
                                            width: '12px', height: '12px', 
                                            border: '2px solid rgba(255,255,255,0.2)', 
                                            borderTop: '2px solid white', 
                                            borderRadius: '50%',
                                            animation: 'spin 1s linear infinite'
                                        }} />
                                        {installMessage}
                                    </div>
                                )}
                                <DictionaryManager key={dictManagerKey} onImportClick={handleImportClick} />
                            </div>
                        </div>
                    </div>

                    {/* --- ANKI CONNECT SECTION --- */}
                    {!isiOS && (
                        <>
                        <h3>AnkiConnect Integration</h3>
                        <div style={sectionBoxStyle}>
                            <label style={checkboxLabelStyle}>
                                <input 
                                    type="checkbox" 
                                    checked={localSettings.ankiConnectEnabled ?? false} 
                                    onChange={(e) => handleChange('ankiConnectEnabled', e.target.checked)} 
                                    style={checkboxInputStyle} 
                                />
                                <div>
                                    Enable AnkiConnect
                                    <div style={{ opacity: 0.5, fontSize: '0.9em' }}>
                                        {localSettings.enableYomitan 
                                            ? "Automatically add cards via the Popup Dictionary" 
                                            : "Right-click (desktop) or hold (mobile) to update the last card (useful for third-party dictionaries)"
                                        }
                                    </div>
                                </div>
                            </label>

                            {/* Collapsible Anki Settings */}
                            <div style={{
                                maxHeight: localSettings.ankiConnectEnabled ? 'none' : '0px',
                                opacity: localSettings.ankiConnectEnabled ? 1 : 0,
                                overflow: 'hidden',
                                transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out',
                            }}>
                                <div style={{ marginTop: '10px', paddingLeft: '5px' }}>
                                    {/* Connection Status & URL */}
                                    <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                        <div style={{display:'flex', alignItems:'center'}}>
                                            <span style={statusDotStyle(ankiStatus === 'connected')}></span>
                                            <span style={{color: ankiStatus === 'connected' ? '#2ecc71' : '#e74c3c', fontWeight: 'bold'}}>
                                                {ankiStatus === 'connected' ? 'Connected' : ankiStatus === 'loading' ? 'Connecting...' : 'Not Connected'}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={fetchAnkiData}
                                            disabled={ankiStatus === 'loading'}
                                            style={{
                                                padding: '5px 10px', fontSize: '0.85em', cursor: 'pointer',
                                                backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px'
                                            }}
                                        >
                                            Retry Connection
                                        </button>
                                    </div>

                                    <div className="grid">
                                        <label htmlFor="ankiUrl">AnkiConnect URL</label>
                                        <input 
                                            id="ankiUrl" 
                                            value={localSettings.ankiConnectUrl ?? 'http://127.0.0.1:8765'} 
                                            onChange={(e) => handleChange('ankiConnectUrl', e.target.value)} 
                                            placeholder="http://127.0.0.1:8765"
                                        />
                                        <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                            Address where AnkiConnect is listening.
                                        </div>
                                        
                                        <label htmlFor="ankiQuality">Image Quality</label>
                                        <input 
                                            id="ankiQuality" 
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="1"
                                            value={localSettings.ankiImageQuality ?? 0.92} 
                                            onChange={(e) => handleChange('ankiImageQuality', parseFloat(e.target.value))} 
                                            placeholder="0.92"
                                        />
                                        <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                            Image compression quality for screenshots sent to Anki (0-1).
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '15px', marginTop: '10px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        <label style={{ ...checkboxLabelStyle, marginBottom: '0' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={localSettings.ankiEnableCropper ?? false} 
                                                onChange={(e) => handleChange('ankiEnableCropper', e.target.checked)} 
                                                style={checkboxInputStyle} 
                                            />
                                            <div>
                                                Enable Image Cropper
                                                <div style={{ opacity: 0.5, fontSize: '0.9em' }}>
                                                    Allows you to crop the image before sending to Anki
                                                </div>
                                            </div>
                                        </label>
                                    </div>

                                    {!localSettings.enableYomitan && (
                                        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <label style={{ ...checkboxLabelStyle, marginBottom: '0' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={localSettings.skipAnkiUpdateConfirm ?? false}
                                                    onChange={(e) => handleChange('skipAnkiUpdateConfirm', e.target.checked)}
                                                    style={checkboxInputStyle}
                                                />
                                                <div>
                                                    Skip Update Anki Card confirmation
                                                    <div style={{ opacity: 0.5, fontSize: '0.9em' }}>
                                                        Updates the last card immediately when you use the right-click action.
                                                    </div>
                                                </div>
                                            </label>
                                        </div>
                                    )}

                                    {localSettings.enableYomitan && (
                                        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <label style={{ ...checkboxLabelStyle, marginBottom: '0' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={localSettings.ankiCheckDuplicates ?? true} 
                                                    onChange={(e) => handleChange('ankiCheckDuplicates', e.target.checked)} 
                                                    style={checkboxInputStyle} 
                                                />
                                                <div>
                                                    Check for Duplicates
                                                    <div style={{ opacity: 0.5, fontSize: '0.9em' }}>
                                                        Checks if the word already exists in the selected deck
                                                    </div>
                                                </div>
                                            </label>
                                        </div>
                                    )}

                                    {/* Deck & Model Selection */}
                                    {ankiStatus === 'connected' && (
                                        <>
                                            <div className="grid" style={{marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px'}}>
                                                <label htmlFor="ankiDeck">Target Deck</label>
                                                <select 
                                                    id="ankiDeck"
                                                    value={localSettings.ankiDeck || ''}
                                                    onChange={e => handleChange('ankiDeck', e.target.value)}
                                                >
                                                    <option value="">Select a Deck...</option>
                                                    {ankiDecks.map(d => <option key={d} value={d}>{d}</option>)}
                                                </select>
                                                <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                                    Deck where new cards will be added.
                                                </div>

                                                <label htmlFor="ankiModel">Card Type</label>
                                                <select 
                                                    id="ankiModel"
                                                    value={localSettings.ankiModel || ''}
                                                    onChange={e => {
                                                        const newVal = e.target.value;
                                                        setLocalSettings(prev => {
                                                            const next = {
                                                                ...prev,
                                                                ankiModel: newVal,
                                                                ankiFieldMap: {},
                                                            };
                                                            persistSettings(next);
                                                            return next;
                                                        });
                                                    }}
                                                >
                                                    <option value="">Select Card Type...</option>
                                                    {ankiModels.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                                <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                                    Note type used when creating cards.
                                                </div>
                                            </div>

                                            {/* Field Mapping Section */}
                                            {localSettings.ankiModel && currentModelFields.length > 0 && (
                                                <div style={{ marginTop: '20px' }}>
                                                    <h4 style={{marginBottom: '10px', color: '#ddd'}}>Field Mapping</h4>
                                                    <div style={{ fontSize: '0.85em', color: '#aaa', marginBottom: '10px' }}>
                                                        Map OCR and dictionary content to your Anki fields.
                                                    </div>
                                                    
                                                    {/* If built-in dictionary is enabled, show full table mapping */}
                                                    {localSettings.enableYomitan ? (
                                                        <div style={{overflowX: 'auto'}}>
                                                            <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.9em'}}>
                                                                <thead>
                                                                    <tr style={{borderBottom: '1px solid rgba(255,255,255,0.2)'}}>
                                                                        <th style={{textAlign: 'left', padding: '8px', color: '#aaa'}}>Anki Field</th>
                                                                        <th style={{textAlign: 'left', padding: '8px', color: '#aaa'}}>Content</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {currentModelFields.map(field => (
                                                                        <tr key={field} style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                                                                            <td style={{padding: '8px'}}>{field}</td>
                                                                            <td style={{padding: '8px'}}>
                                                                                <select
                                                                                    style={{width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white'}}
                                                                                    value={(localSettings.ankiFieldMap as any)?.[field] || 'None'}
                                                                                    onChange={e => handleFieldMapChange(field, e.target.value)}
                                                                                >
                                                                                    {mappingOptions.map((opt) => (
                                                                                        <option key={opt.value} value={opt.value}>
                                                                                            {opt.label}
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        // If built-in dictionary is disabled, show simple dropdowns for Sentence/Image
                                                        <div className="grid">
                                                            <label>Sentence Field</label>
                                                            <select
                                                                value={getFieldForContent('Sentence')}
                                                                onChange={(e) => handleContentToFieldChange('Sentence', e.target.value)}
                                                            >
                                                                <option value="">(None)</option>
                                                                {currentModelFields.map(f => <option key={f} value={f}>{f}</option>)}
                                                            </select>
                                                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                                                Field where the selected sentence will be stored.
                                                            </div>

                                                            <label>Image Field</label>
                                                            <select
                                                                value={getFieldForContent('Image')}
                                                                onChange={(e) => handleContentToFieldChange('Image', e.target.value)}
                                                            >
                                                                <option value="">(None)</option>
                                                                {currentModelFields.map(f => <option key={f} value={f}>{f}</option>)}
                                                            </select>
                                                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                                                Field where the screenshot image will be stored.
                                                            </div>

                                                            <label>Sentence Audio Field</label>
                                                            <select
                                                                value={getFieldForContent('Sentence Audio')}
                                                                onChange={(e) => handleContentToFieldChange('Sentence Audio', e.target.value)}
                                                            >
                                                                <option value="">(None)</option>
                                                                {currentModelFields.map(f => <option key={f} value={f}>{f}</option>)}
                                                            </select>
                                                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                                                Field where the sentence audio will be stored.
                                                            </div>
                                                        </div>
                                                    )}

                                                        {/* FREQUENCY MODE DROPDOWN - ADD THIS */}
                                                        {localSettings.enableYomitan &&
                                                            Object.values(localSettings.ankiFieldMap || {}).includes('Frequency') && (
                                                                <div style={{
                                                                    marginTop: '20px',
                                                                    paddingTop: '15px',
                                                                    borderTop: '1px solid rgba(255,255,255,0.1)'
                                                                }}>
                                                                    <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#ddd' }}>
                                                                        Frequency Export Mode
                                                                    </h4>
                                                                    <div className="grid">
                                                                        <label htmlFor="ankiFreqMode">Frequency Value</label>
                                                                        <select
                                                                            id="ankiFreqMode"
                                                                            value={localSettings.ankiFreqMode || 'lowest'}
                                                                            onChange={(e) => handleChange('ankiFreqMode', e.target.value)}
                                                                            style={{
                                                                                padding: '6px',
                                                                                borderRadius: '4px',
                                                                                border: '1px solid #444',
                                                                                background: '#222',
                                                                                color: 'white'
                                                                            }}
                                                                        >
                                                                            <option value="lowest">Lowest Frequency</option>
                                                                            <option value="harmonic">Harmonic Mean</option>
                                                                            {availableFreqDicts.map(dict => (
                                                                                <option key={dict} value={dict}>{dict}</option>
                                                                            ))}
                                                                        </select>
                                                                        <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                                                            Choose which frequency value to export to Anki.
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <h3>General Settings</h3>
                    <div style={sectionBoxStyle}>
                        <div className="checkboxes">
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" checked={localSettings.mobileMode} onChange={(e) => handleChange('mobileMode', e.target.checked)} style={checkboxInputStyle} />
                                <div>
                                    Mobile Mode
                                    <div style={{ opacity: 0.6, fontSize: '0.85em' }}>
                                        Optimizes layout and gestures for smaller screens.
                                    </div>
                                </div>
                            </label>
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" checked={localSettings.debugMode} onChange={(e) => handleChange('debugMode', e.target.checked)} style={checkboxInputStyle} />
                                <div>
                                    Debug Mode
                                    <div style={{ opacity: 0.6, fontSize: '0.85em' }}>
                                        Shows extra diagnostics and debug overlays.
                                    </div>
                                </div>
                            </label>
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" checked={localSettings.disableStatusIcon} onChange={(e) => handleChange('disableStatusIcon', e.target.checked)} style={checkboxInputStyle} />
                                <div>
                                    Disable Status Icon
                                    <div style={{ opacity: 0.6, fontSize: '0.85em' }}>
                                        Hides the floating status indicator in readers.
                                    </div>
                                </div>
                            </label>
                        </div>
                        {localSettings.debugMode && (
                            <div style={{ marginTop: '12px' }}>
                                <button
                                    type="button"
                                    onClick={openSetup}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '4px',
                                        border: '1px solid #444',
                                        background: '#2a2a2e',
                                        color: 'white',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Open Setup Wizard
                                </button>
                            </div>
                        )}
                    </div>

                    <h3>Anime Settings</h3>
                    <div style={sectionBoxStyle}>
                        <div className="grid" style={{ marginBottom: '10px' }}>
                            <label htmlFor="subtitleFontSize">Subtitle Font (px)</label>
                            <input
                                id="subtitleFontSize"
                                type="number"
                                step="1"
                                min="8"
                                max="64"
                                value={localSettings.subtitleFontSize}
                                onChange={(e) => handleChange('subtitleFontSize', parseInt(e.target.value, 10))}
                            />
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                Controls subtitle text size in the video player.
                            </div>
                            <label htmlFor="subtitleFontWeight">Subtitle Thickness</label>
                            <input
                                id="subtitleFontWeight"
                                type="number"
                                step="100"
                                min="100"
                                max="900"
                                value={localSettings.subtitleFontWeight ?? 600}
                                onChange={(e) => handleChange('subtitleFontWeight', parseInt(e.target.value, 10))}
                            />
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                Higher values make subtitles bolder and easier to read.
                            </div>
                            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label htmlFor="animePopupWidthValue">Width</label>
                                    <div style={inlineInputWrapperStyle}>
                                        <input
                                            id="animePopupWidthValue"
                                            type="number"
                                            step={popupWidthUnit === 'px' ? '10' : '1'}
                                            min={popupWidthUnit === 'px' ? '280' : '30'}
                                            max={popupWidthUnit === 'px' ? '1920' : '100'}
                                            value={popupWidthValue}
                                            onChange={(e) => handleChange(
                                                popupWidthUnit === 'px' ? 'animePopupWidthPx' : 'animePopupWidthPercent',
                                                parseInt(e.target.value, 10),
                                            )}
                                            style={inlineInputStyle}
                                        />
                                        <div style={inlineInputActionsStyle}>
                                            <button
                                                type="button"
                                                onClick={() => handleChange('animePopupWidthUnit', 'percent')}
                                                style={unitToggleStyle(popupWidthUnit === 'percent')}
                                            >
                                                %
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleChange('animePopupWidthUnit', 'px')}
                                                style={unitToggleStyle(popupWidthUnit === 'px')}
                                            >
                                                px
                                            </button>
                                            <IconButton
                                                size="small"
                                                onClick={resetPopupWidth}
                                                aria-label="Reset anime dictionary width"
                                                style={{ padding: 4 }}
                                            >
                                                <RestartAltIcon fontSize="small" />
                                            </IconButton>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label htmlFor="animePopupHeightValue">Height</label>
                                    <div style={inlineInputWrapperStyle}>
                                        <input
                                            id="animePopupHeightValue"
                                            type="number"
                                            step={popupHeightUnit === 'px' ? '10' : '1'}
                                            min={popupHeightUnit === 'px' ? '200' : '20'}
                                            max={popupHeightUnit === 'px' ? '1080' : '90'}
                                            value={popupHeightValue}
                                            onChange={(e) => handleChange(
                                                popupHeightUnit === 'px' ? 'animePopupHeightPx' : 'animePopupHeightPercent',
                                                parseInt(e.target.value, 10),
                                            )}
                                            style={inlineInputStyle}
                                        />
                                        <div style={inlineInputActionsStyle}>
                                            <button
                                                type="button"
                                                onClick={() => handleChange('animePopupHeightUnit', 'percent')}
                                                style={unitToggleStyle(popupHeightUnit === 'percent')}
                                            >
                                                %
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleChange('animePopupHeightUnit', 'px')}
                                                style={unitToggleStyle(popupHeightUnit === 'px')}
                                            >
                                                px
                                            </button>
                                            <IconButton
                                                size="small"
                                                onClick={resetPopupHeight}
                                                aria-label="Reset anime dictionary height"
                                                style={{ padding: 4 }}
                                            >
                                                <RestartAltIcon fontSize="small" />
                                            </IconButton>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label htmlFor="animePopupTopValue">Top Offset</label>
                                    <div style={inlineInputWrapperStyle}>
                                        <input
                                            id="animePopupTopValue"
                                            type="number"
                                            step={popupTopUnit === 'px' ? '10' : '1'}
                                            min={popupTopUnit === 'px' ? '0' : '0'}
                                            max={popupTopUnit === 'px' ? '1600' : '80'}
                                            value={popupTopValue}
                                            onChange={(e) => handleChange(
                                                popupTopUnit === 'px' ? 'animePopupTopOffsetPx' : 'animePopupTopOffsetPercent',
                                                parseInt(e.target.value, 10),
                                            )}
                                            style={inlineInputStyle}
                                        />
                                        <div style={inlineInputActionsStyle}>
                                            <button
                                                type="button"
                                                onClick={() => handleChange('animePopupTopOffsetUnit', 'percent')}
                                                style={unitToggleStyle(popupTopUnit === 'percent')}
                                            >
                                                %
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleChange('animePopupTopOffsetUnit', 'px')}
                                                style={unitToggleStyle(popupTopUnit === 'px')}
                                            >
                                                px
                                            </button>
                                            <IconButton
                                                size="small"
                                                onClick={resetPopupTop}
                                                aria-label="Reset anime dictionary top offset"
                                                style={{ padding: 4 }}
                                            >
                                                <RestartAltIcon fontSize="small" />
                                            </IconButton>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label htmlFor="animePopupLeftValue">Horizontal Offset</label>
                                    <div style={inlineInputWrapperStyle}>
                                        <input
                                            id="animePopupLeftValue"
                                            type="number"
                                            step={popupLeftUnit === 'px' ? '10' : '1'}
                                            min={popupLeftUnit === 'px' ? '-1600' : '-50'}
                                            max={popupLeftUnit === 'px' ? '1600' : '50'}
                                            value={popupLeftValue}
                                            onChange={(e) => handleChange(
                                                popupLeftUnit === 'px' ? 'animePopupLeftOffsetPx' : 'animePopupLeftOffsetPercent',
                                                parseInt(e.target.value, 10),
                                            )}
                                            style={inlineInputStyle}
                                        />
                                        <div style={inlineInputActionsStyle}>
                                            <button
                                                type="button"
                                                onClick={() => handleChange('animePopupLeftOffsetUnit', 'percent')}
                                                style={unitToggleStyle(popupLeftUnit === 'percent')}
                                            >
                                                %
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleChange('animePopupLeftOffsetUnit', 'px')}
                                                style={unitToggleStyle(popupLeftUnit === 'px')}
                                            >
                                                px
                                            </button>
                                            <IconButton
                                                size="small"
                                                onClick={resetPopupLeft}
                                                aria-label="Reset anime dictionary horizontal offset"
                                                style={{ padding: 4 }}
                                            >
                                                <RestartAltIcon fontSize="small" />
                                            </IconButton>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                Adjust the anime popup dictionary size and position. Each field has its own unit toggle and reset.
                            </div>
                            <label htmlFor="tapZonePercent">Video Tap Zone (%)</label>
                            <input
                                id="tapZonePercent"
                                type="number"
                                step="1"
                                min="10"
                                max="60"
                                value={localSettings.tapZonePercent}
                                onChange={(e) => handleChange('tapZonePercent', parseInt(e.target.value, 10))}
                            />
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                Controls the height of the top tap zone for play/pause.
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <div className="checkboxes">
                                    <label style={checkboxLabelStyle}>
                                        <input
                                            type="checkbox"
                                            checked={localSettings.animeSubtitleHoverLookup}
                                            onChange={(e) => handleChange('animeSubtitleHoverLookup', e.target.checked)}
                                            style={checkboxInputStyle}
                                        />
                                        <div>
                                            Pause on subtitle hover
                                            <div style={{ opacity: 0.6, fontSize: '0.85em' }}>
                                                Hovering subtitles pauses playback and opens the dictionary.
                                            </div>
                                        </div>
                                    </label>
                                    {localSettings.animeSubtitleHoverLookup && (
                                        <label style={checkboxLabelStyle}>
                                            <input
                                                type="checkbox"
                                                checked={localSettings.animeSubtitleHoverAutoResume}
                                                onChange={(e) => handleChange('animeSubtitleHoverAutoResume', e.target.checked)}
                                                style={checkboxInputStyle}
                                            />
                                            <div>
                                                Auto resume on hover exit
                                                <div style={{ opacity: 0.6, fontSize: '0.85em' }}>
                                                    Resume playback when you move the cursor off subtitles.
                                                </div>
                                            </div>
                                        </label>
                                    )}
                                </div>
                            </div>
                            <label htmlFor="jimakuApiKey">Jimaku API Key</label>
                            <input
                                id="jimakuApiKey"
                                type="password"
                                value={localSettings.jimakuApiKey ?? ''}
                                onChange={(e) => handleChange('jimakuApiKey', e.target.value)}
                                placeholder="Paste Jimaku API key"
                            />
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                Used to fetch Jimaku subtitles for the current episode.
                                <div>
                                    Get an API key from <a href="https://jimaku.cc" target="_blank" rel="noreferrer">jimaku.cc</a>
                                </div>
                                <div>
                                    1. You can get a free key by signing up on the site: <a href="https://jimaku.cc/account" target="_blank" rel="noreferrer">https://jimaku.cc/account</a>
                                </div>
                                <div>2. Generate an API key under the "API" heading and copy it</div>
                            </div>
                        </div>
                        <div style={{ marginTop: '16px' }}>
                            <h4 style={{ marginTop: 0 }}>Hotkeys</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ fontSize: '0.85em', color: '#aaa', textAlign: 'right' }}>
                                    Click a hotkey to remove it, or use + to add a new one.
                                </div>
                                {ANIME_HOTKEYS.map((hotkey) => (
                                    <AnimeHotkeyRow
                                        key={hotkey}
                                        hotkey={hotkey}
                                        keys={animeHotkeys[hotkey] ?? []}
                                        existingKeys={existingAnimeHotkeys}
                                        onChange={(keys) => updateAnimeHotkey(hotkey, keys)}
                                    />
                                ))}
                                <Stack sx={{ alignItems: 'flex-end' }}>
                                    <ResetButton onClick={() => handleChange('animeHotkeys', DEFAULT_ANIME_HOTKEYS)} variant="outlined" />
                                </Stack>
                            </div>
                        </div>
                    </div>

                    <h3>Manga Settings</h3>
                    <div style={sectionBoxStyle}>
                        <h4 style={{ marginTop: 0 }}>General</h4>
                        <div className="checkboxes">
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" checked={localSettings.enableOverlay} onChange={(e) => handleChange('enableOverlay', e.target.checked)} style={checkboxInputStyle} />
                                <div>
                                    Enable Text Overlay
                                    <div style={{ opacity: 0.6, fontSize: '0.85em' }}>
                                        Shows OCR text overlays while reading manga.
                                    </div>
                                </div>
                            </label>
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" checked={localSettings.soloHoverMode} onChange={(e) => handleChange('soloHoverMode', e.target.checked)} style={checkboxInputStyle} />
                                <div>
                                    Solo Hover
                                    <div style={{ opacity: 0.6, fontSize: '0.85em' }}>
                                        Only show the active hover box instead of all boxes.
                                    </div>
                                </div>
                            </label>
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" checked={localSettings.enableDoubleClickEdit} onChange={(e) => handleChange('enableDoubleClickEdit', e.target.checked)} style={checkboxInputStyle} />
                                <div>
                                    Enable Double-Click Edit
                                    <div style={{ opacity: 0.6, fontSize: '0.85em' }}>
                                        Allows double-click to edit OCR text boxes.
                                    </div>
                                </div>
                            </label>
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" checked={localSettings.enableDoubleTapZoom} onChange={(e) => handleChange('enableDoubleTapZoom', e.target.checked)} style={checkboxInputStyle} />
                                <div>
                                    Enable Double-Tap Zoom
                                    <div style={{ opacity: 0.6, fontSize: '0.85em' }}>
                                        Allows double-tap to zoom in the manga reader.
                                    </div>
                                </div>
                            </label>
                        </div>

                        <h4>Visuals</h4>
                        <div className="grid">
                            <label htmlFor="colorTheme">Theme</label>
                            <select id="colorTheme" value={localSettings.colorTheme} onChange={(e) => handleChange('colorTheme', e.target.value)}>
                                {Object.keys(COLOR_THEMES).map((k) => <option key={k} value={k}>{k}</option>)}
                            </select>
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                Controls overlay colors and highlight styling.
                            </div>
                        </div>

                        <h4>Fine Tuning</h4>
                        <div className="grid">
                            <label htmlFor="dimmedOpacity">Opacity</label>
                            <input id="dimmedOpacity" type="number" step="0.1" max="1" min="0" value={localSettings.dimmedOpacity} onChange={(e) => handleChange('dimmedOpacity', parseFloat(e.target.value))} />
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                Background dim amount for non-focused text.
                            </div>
                            <label htmlFor="focusScale">Scale</label>
                            <input id="focusScale" type="number" step="0.1" value={localSettings.focusScaleMultiplier} onChange={(e) => handleChange('focusScaleMultiplier', parseFloat(e.target.value))} />
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                Zoom multiplier for focused text.
                            </div>
                            <label htmlFor="fontMultH">H. Font Mult</label>
                            <input id="fontMultH" type="number" step="0.1" value={localSettings.fontMultiplierHorizontal} onChange={(e) => handleChange('fontMultiplierHorizontal', parseFloat(e.target.value))} />
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                Font size multiplier for horizontal text.
                            </div>
                            <label htmlFor="fontMultV">V. Font Mult</label>
                            <input id="fontMultV" type="number" step="0.1" value={localSettings.fontMultiplierVertical} onChange={(e) => handleChange('fontMultiplierVertical', parseFloat(e.target.value))} />
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                Font size multiplier for vertical text.
                            </div>
                            <label htmlFor="boxAdjust">Box Adjust (px)</label>
                            <input id="boxAdjust" type="number" step="1" value={localSettings.boundingBoxAdjustment} onChange={(e) => handleChange('boundingBoxAdjustment', parseInt(e.target.value, 10))} />
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                Expands or shrinks OCR bounding boxes.
                            </div>
                        </div>

                        <h4>Interaction</h4>
                        <div className="grid">
                            <label htmlFor="interactMode">Mode</label>
                            <select id="interactMode" value={localSettings.interactionMode} onChange={(e) => handleChange('interactionMode', e.target.value)}>
                                <option value="hover">Hover</option><option value="click">Click</option>
                            </select>
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                Choose how text boxes activate in the reader.
                            </div>
                            <label htmlFor="delKey">Delete Key</label>
                            <input id="delKey" value={localSettings.deleteModifierKey} onChange={(e) => handleChange('deleteModifierKey', e.target.value)} placeholder="Alt, Control, Shift..." />
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                Modifier key used to delete OCR boxes.
                            </div>
                            <label htmlFor="mergeKey">Merge Key</label>
                            <input id="mergeKey" value={localSettings.mergeModifierKey} onChange={(e) => handleChange('mergeModifierKey', e.target.value)} placeholder="Alt, Control, Shift..." />
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85em', color: '#aaa' }}>
                                Modifier key used to merge OCR boxes.
                            </div>
                        </div>
                    </div>

                    <h3>Maintenance</h3>
                    <div style={sectionBoxStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                <button
                                    type="button"
                                    onClick={resetYomitanDB}
                                    style={{
                                        textAlign: 'left',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: '1px solid #c0392b',
                                        background: 'rgba(192, 57, 43, 0.12)',
                                        color: '#f4d3cf',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        width: 'fit-content',
                                    }}
                                >
                                    Reinstall Dictionary Database
                                </button>
                                <div style={{ fontSize: '0.85em', color: '#aaa' }}>
                                    Deletes all dictionaries and reinstalls the selected language.
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                <button
                                    type="button"
                                    onClick={purgeCache}
                                    style={{
                                        textAlign: 'left',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: '1px solid #c0392b',
                                        background: 'rgba(192, 57, 43, 0.12)',
                                        color: '#f4d3cf',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        width: 'fit-content',
                                    }}
                                >
                                    Clear OCR Cache
                                </button>
                                <div style={{ fontSize: '0.85em', color: '#aaa' }}>
                                    Removes cached OCR results stored on the server.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="ocr-modal-footer">
                    <button type="button" className="warning" onClick={resetToDefaults} style={{ marginRight: 'auto', background: '#e67e22', borderColor: '#d35400' }}>Defaults</button>
                    <button type="button" className="primary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};
