/**
 * UI Visibility Hook
 * Manages visibility state with auto-hide timer
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseUIVisibilityOptions {
    autoHideDelay?: number;
    initialVisible?: boolean;
}

interface UseUIVisibilityReturn {
    showUI: boolean;
    toggleUI: () => void;
    showTemporarily: () => void;
    hide: () => void;
    show: () => void;
    resetTimer: () => void;
}

export function useUIVisibility(
    options: UseUIVisibilityOptions = {}
): UseUIVisibilityReturn {
    const {
        autoHideDelay = 2000,
        initialVisible = false,
    } = options;

    const [showUI, setShowUI] = useState(initialVisible);
    const timerRef = useRef<number | null>(null);

    // Clear existing timer
    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Start auto-hide timer
    const startTimer = useCallback(() => {
        clearTimer();
        timerRef.current = window.setTimeout(() => {
            setShowUI(false);
            timerRef.current = null;
        }, autoHideDelay);
    }, [autoHideDelay, clearTimer]);

    // Show UI permanently (until hidden)
    const show = useCallback(() => {
        clearTimer();
        setShowUI(true);
    }, [clearTimer]);

    // Hide UI immediately
    const hide = useCallback(() => {
        clearTimer();
        setShowUI(false);
    }, [clearTimer]);

    // Show UI with auto-hide timer
    const showTemporarily = useCallback(() => {
        setShowUI(true);
        startTimer();
    }, [startTimer]);

    // Toggle UI visibility
    const toggleUI = useCallback(() => {
        setShowUI(prev => {
            const newState = !prev;
            if (newState) {
                startTimer();
            } else {
                clearTimer();
            }
            return newState;
        });
    }, [startTimer, clearTimer]);

    // Reset timer (extend visibility)
    const resetTimer = useCallback(() => {
        if (showUI) {
            startTimer();
        }
    }, [showUI, startTimer]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearTimer();
        };
    }, [clearTimer]);

    return {
        showUI,
        toggleUI,
        showTemporarily,
        hide,
        show,
        resetTimer,
    };
}