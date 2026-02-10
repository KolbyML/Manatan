/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { ReaderTapZoneService } from '@/features/reader/tap-zones/ReaderTapZoneService.ts';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { useResizeObserver } from '@/base/hooks/useResizeObserver.tsx';
import { ReadingDirection } from '@/features/reader/Reader.types.ts';
import { withPropsFrom } from '@/base/hoc/withPropsFrom.tsx';
import { NavbarContextType } from '@/features/navigation-bar/NavigationBar.types.ts';
import { useReaderSettingsStore, useReaderTapZoneStore } from '@/features/reader/stores/ReaderStore.ts';

const CANVAS_ID = 'reader-tap-zone-layout-canvas';

const BaseTapZoneLayout = ({ readerNavBarWidth }: Pick<NavbarContextType, 'readerNavBarWidth'>) => {
    const theme = useTheme();
    const { tapZoneLayout, tapZoneInvertMode, readingDirection } = useReaderSettingsStore((state) => ({
        tapZoneLayout: state.settings.tapZoneLayout.value,
        tapZoneInvertMode: state.settings.tapZoneInvertMode.value,
        readingDirection: state.settings.readingDirection.value,
    }));
    const showPreview = useReaderTapZoneStore((state) => state.tapZone.showPreview);

    const [width, setWidth] = useState(0);
    const [height, setHeight] = useState(0);
    const [tapZoneLayoutElement, setTapZoneLayoutElement] = useState<HTMLDivElement | null>(null);
    useResizeObserver(
        tapZoneLayoutElement,
        useCallback(() => {
            setWidth(tapZoneLayoutElement?.clientWidth ?? 0);
            setHeight(tapZoneLayoutElement?.clientHeight ?? 0);
        }, [tapZoneLayoutElement]),
    );

    const canvas = useMemo(() => {
        // Keep tap zone geometry updated even when preview isn't visible.
        const safeWidth = Math.max(width, 1);
        const safeHeight = Math.max(height, 1);
        return ReaderTapZoneService.getOrCreateCanvas(tapZoneLayout, safeWidth, safeHeight, theme.typography.h3, {
            vertical: tapZoneInvertMode.vertical,
            horizontal: tapZoneInvertMode.horizontal,
            isRTL: readingDirection === ReadingDirection.RTL,
        });
    }, [
        tapZoneLayout,
        width,
        height,
        theme.typography.h3,
        tapZoneInvertMode.vertical,
        tapZoneInvertMode.horizontal,
        readingDirection,
    ]);

    useLayoutEffect(() => {
        const canvasContainerElement = document.getElementById(CANVAS_ID);
        if (!showPreview) {
            canvasContainerElement?.replaceChildren();
            return;
        }
        canvasContainerElement?.replaceChildren(canvas);
    }, [canvas, showPreview]);

    return (
        <Box
            ref={setTapZoneLayoutElement}
            sx={{
                position: 'fixed',
                top: 0,
                left: readerNavBarWidth,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
            }}
        >
            {showPreview && <div id={CANVAS_ID} />}
        </Box>
    );
};

export const TapZoneLayout = withPropsFrom(BaseTapZoneLayout, [useNavBarContext], ['readerNavBarWidth']);
