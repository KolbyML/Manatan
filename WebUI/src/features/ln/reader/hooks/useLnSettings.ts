import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    LNReaderSettings,
    getDefaultLnSettings,
    getLnSettingsAsFullSettings,
    mergeWithDefaultLnSettings,
    normalizeLnSettingsLanguage,
    readLegacyLnSettingsFromLocalStorage,
    saveLegacyLnSettingsToLocalStorage,
} from '../utils/lnSettings';
import { MANATAN_LN_SETTINGS_META_KEY, getServerMetaJson, setServerMetaJson } from '@/Manatan/services/ServerMetaStorage.ts';

export function useLnSettings(language: string | undefined) {
    const effectiveLanguage = normalizeLnSettingsLanguage(language);
    const [settings, setSettingsState] = useState<LNReaderSettings>(() => getDefaultLnSettings());
    const settingsByLanguageRef = useRef<Record<string, LNReaderSettings>>({});
    const effectiveLanguageRef = useRef(effectiveLanguage);
    const hasLoadedInitialSettingsRef = useRef(false);
    const saveTimeoutRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        effectiveLanguageRef.current = effectiveLanguage;
    }, [effectiveLanguage]);

    useEffect(() => {
        let cancelled = false;

        const loadSettings = async () => {
            const legacySettings = readLegacyLnSettingsFromLocalStorage();
            try {
                const serverSettingsRaw = await getServerMetaJson<Record<string, Partial<LNReaderSettings>> | null>(
                    MANATAN_LN_SETTINGS_META_KEY,
                    null,
                );
                if (cancelled) {
                    return;
                }

                const serverSettings = Object.entries(serverSettingsRaw ?? {}).reduce<Record<string, LNReaderSettings>>(
                    (acc, [lang, langSettings]) => ({
                        ...acc,
                        [normalizeLnSettingsLanguage(lang)]: mergeWithDefaultLnSettings(langSettings),
                    }),
                    {},
                );

                const mergedSettings = { ...legacySettings, ...serverSettings };
                settingsByLanguageRef.current = mergedSettings;
                setSettingsState(mergedSettings[effectiveLanguageRef.current] ?? getDefaultLnSettings());
                hasLoadedInitialSettingsRef.current = true;

                const shouldMigrateLegacy = Object.keys(legacySettings).some((lang) => !serverSettings[lang]);
                if (shouldMigrateLegacy) {
                    await setServerMetaJson(MANATAN_LN_SETTINGS_META_KEY, mergedSettings);
                }
            } catch (error) {
                console.error('[LNSettings] Failed to load settings from server metadata:', error);
                settingsByLanguageRef.current = legacySettings;
                setSettingsState(legacySettings[effectiveLanguageRef.current] ?? getDefaultLnSettings());
                hasLoadedInitialSettingsRef.current = true;
            }
        };

        loadSettings();

        return () => {
            cancelled = true;
            if (saveTimeoutRef.current !== undefined) {
                window.clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!hasLoadedInitialSettingsRef.current) {
            return;
        }
        setSettingsState(settingsByLanguageRef.current[effectiveLanguage] ?? getDefaultLnSettings());
    }, [effectiveLanguage]);

    // Get settings as full Settings object for compatibility
    const fullSettings = useMemo(() => getLnSettingsAsFullSettings(settings), [settings]);

    const schedulePersist = useCallback((settingsByLanguage: Record<string, LNReaderSettings>) => {
        if (saveTimeoutRef.current !== undefined) {
            window.clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = window.setTimeout(() => {
            setServerMetaJson(MANATAN_LN_SETTINGS_META_KEY, settingsByLanguage).catch((error) => {
                console.error('[LNSettings] Failed to persist settings to server metadata:', error);
            });
        }, 300);

        // Keep legacy local cache in sync for backward compatibility and migration safety.
        saveLegacyLnSettingsToLocalStorage(settingsByLanguage);
    }, []);

    const saveLanguageSettings = useCallback((nextSettings: LNReaderSettings) => {
        const nextByLanguage = {
            ...settingsByLanguageRef.current,
            [effectiveLanguage]: nextSettings,
        };
        settingsByLanguageRef.current = nextByLanguage;

        if (hasLoadedInitialSettingsRef.current) {
            schedulePersist(nextByLanguage);
        }
    }, [effectiveLanguage, schedulePersist]);

    const setSettings = useCallback((updates: Partial<LNReaderSettings>) => {
        setSettingsState(prev => {
            const updated = { ...prev, ...updates };
            saveLanguageSettings(updated);
            return updated;
        });
    }, [saveLanguageSettings]);

    // Update a single setting
    const updateSetting = useCallback(<K extends keyof LNReaderSettings>(
        key: K,
        value: LNReaderSettings[K]
    ) => {
        setSettingsState(prev => {
            const updated = { ...prev, [key]: value };
            saveLanguageSettings(updated);
            return updated;
        });
    }, [saveLanguageSettings]);

    return {
        settings,
        setSettings,
        updateSetting,
        fullSettings,
        language: effectiveLanguage,
    };
}
