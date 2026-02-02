/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import useMediaQuery from '@mui/material/useMediaQuery';
import { Breakpoint, SxProps, Theme } from '@mui/material/styles';
import { useCallback, useState } from 'react';
import { getCurrentTheme } from '@/features/theme/services/ThemeCreator.ts';
import { useResizeObserver } from '@/base/hooks/useResizeObserver.tsx';
import { ThemeMode } from '@/features/theme/AppTheme.types.ts';

export class MediaQuery {
    static readonly MOBILE_WIDTH: Breakpoint | number = 'sm';

    static readonly TABLET_WIDTH: Breakpoint | number = 1025;

    static isTouchDevice(): boolean {
        return window.matchMedia('not (pointer: fine)').matches;
    }

    static useIsTouchDevice(): boolean {
        return useMediaQuery('not (pointer: fine)');
    }

    static useIsBelowWidth(breakpoint: Breakpoint | number): boolean {
        return useMediaQuery(getCurrentTheme().breakpoints.down(breakpoint));
    }

    static useIsMobileWidth(): boolean {
        return this.useIsBelowWidth(this.MOBILE_WIDTH);
    }

    static useIsTabletWidth(): boolean {
        return this.useIsBelowWidth(this.TABLET_WIDTH);
    }

    private static getScrollbarSize(type: 'height' | 'width'): number {
        const outer = document.createElement('div');
        outer.style.position = 'absolute';
        outer.style.top = '-9999px';
        outer.style.visibility = 'hidden';
        outer.style.overflow = 'scroll';
        document.body.appendChild(outer);

        const inner = document.createElement('div');
        inner.style.width = '100%';
        inner.style.height = '100%';
        outer.appendChild(inner);

        const width = outer.offsetWidth - inner.offsetWidth;
        const height = outer.offsetHeight - inner.offsetHeight;

        document.body.removeChild(outer);

        return type === 'height' ? height : width;
    }

    static useGetScrollbarSize(
        type: 'height' | 'width',
        element: HTMLElement | null = document.documentElement,
    ): number {
        const [scrollbarSize, setScrollbarSize] = useState(0);

        useResizeObserver(
            element,
            useCallback(() => {
                const hasYScrollbar = !!(element!.scrollHeight - element!.clientHeight);
                const hasXScrollbar = !!(element!.scrollWidth - element!.clientWidth);

                const hasScrollbar = (type === 'height' && hasYScrollbar) || (type === 'width' && hasXScrollbar);
                if (hasScrollbar) {
                    setScrollbarSize(this.getScrollbarSize(type));
                    return;
                }

                setScrollbarSize(0);
            }, [element]),
        );

        return scrollbarSize;
    }

    static getSystemThemeMode(): Exclude<ThemeMode, 'system'> {
        const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDarkMode ? ThemeMode.DARK : ThemeMode.LIGHT;
    }

    static getThemeMode(themeMode: ThemeMode): Exclude<ThemeMode, 'system'> {
        const isSystemMode = themeMode === ThemeMode.SYSTEM;
        if (isSystemMode) {
            return this.getSystemThemeMode();
        }

        return themeMode;
    }

    static listenToSystemThemeChange(onChange: (themeMode: Exclude<ThemeMode, 'system'>) => void): () => void {
        const handleSystemThemeModeChange = (e: MediaQueryListEvent) => {
            onChange(e.matches ? ThemeMode.DARK : ThemeMode.LIGHT);
        };

        const matchSystemThemeMode = window.matchMedia('(prefers-color-scheme: dark)');

        matchSystemThemeMode.addEventListener('change', handleSystemThemeModeChange);

        return () => matchSystemThemeMode.removeEventListener('change', handleSystemThemeModeChange);
    }

    static usePreventMobileContextMenu() {
        const isTouchDevice = MediaQuery.useIsTouchDevice();

        return useCallback(
            (e: React.MouseEvent<any, MouseEvent>) => {
                if (isTouchDevice) {
                    e.preventDefault();
                }
            },
            [isTouchDevice],
        );
    }

    static preventMobileContextMenuSx(): SxProps<Theme> {
        return {
            userSelect: 'none',
            '-webkit-touch-callout': 'none',
        };
    }
}
