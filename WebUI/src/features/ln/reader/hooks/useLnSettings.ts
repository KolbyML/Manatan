import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LNReaderSettings, getLnSettings, saveLnSettings, getDefaultLnSettings, getLnSettingsAsFullSettings } from '../utils/lnSettings';
import { Settings } from '@/Manatan/types';

export function useLnSettings(language: string | undefined) {
    // Use 'default' if language is not yet available
    const effectiveLanguage = (!language || language === 'unknown') ? 'default' : language.toLowerCase();
    
    const [settings, setSettingsState] = useState<LNReaderSettings>(() => getLnSettings(effectiveLanguage));
    const [currentLanguage, setCurrentLanguage] = useState(effectiveLanguage);
    
    // Track if we've initialized
    const isInitializedRef = useRef(false);

    // Load settings when language changes
    useEffect(() => {
        const loaded = getLnSettings(effectiveLanguage);
        setSettingsState(loaded);
        setCurrentLanguage(effectiveLanguage);
        isInitializedRef.current = true;
    }, [effectiveLanguage]);

    // Get settings as full Settings object for compatibility
    const fullSettings = useMemo(() => {
        return getLnSettingsAsFullSettings(settings);
    }, [settings]);

    // Update settings and save to localStorage
    const setSettings = useCallback((updates: Partial<LNReaderSettings>) => {
        setSettingsState(prev => {
            const updated = { ...prev, ...updates };
            saveLnSettings(updated, currentLanguage);
            return updated;
        });
    }, [currentLanguage]);

    // Update a single setting
    const updateSetting = useCallback(<K extends keyof LNReaderSettings>(
        key: K,
        value: LNReaderSettings[K]
    ) => {
        setSettingsState(prev => {
            const updated = { ...prev, [key]: value };
            saveLnSettings(updated, currentLanguage);
            return updated;
        });
    }, [currentLanguage]);

    return {
        settings,
        setSettings,
        updateSetting,
        fullSettings,
        language: currentLanguage,
    };
}
