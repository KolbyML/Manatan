/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useMemo } from 'react';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { ReaderService } from '@/features/reader/services/ReaderService.ts';
import { ProgressBarType, ReadingDirection } from '@/features/reader/Reader.types.ts';
import { getPage } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.utils.tsx';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { reverseString } from '@/base/utils/Strings.ts';
import { NavbarContextType } from '@/features/navigation-bar/NavigationBar.types.ts';
import { withPropsFrom } from '@/base/hoc/withPropsFrom.tsx';
import {
    useReaderPagesStore,
    useReaderProgressBarStore,
    useReaderScrollbarStore,
    useReaderSettingsStore,
} from '@/features/reader/stores/ReaderStore.ts';

const BaseReaderPageNumber = ({
    isDesktop,
    readerNavBarWidth,
}: Pick<ReturnType<typeof ReaderService.useOverlayMode>, 'isDesktop'> &
    Pick<NavbarContextType, 'readerNavBarWidth'>) => {
    const scrollbar = useReaderScrollbarStore((state) => state.scrollbar);
    const { currentPageIndex, pages, totalPages } = useReaderPagesStore((state) => ({
        currentPageIndex: state.pages.currentPageIndex,
        pages: state.pages.pages,
        totalPages: state.pages.totalPages,
    }));
    const { readingDirection, shouldShowPageNumber, progressBarType } = useReaderSettingsStore((state) => ({
        readingDirection: state.settings.readingDirection.value,
        shouldShowPageNumber: state.settings.shouldShowPageNumber,
        progressBarType: state.settings.progressBarType,
    }));
    const isMaximized = useReaderProgressBarStore((state) => state.progressBar.isMaximized);

    const pageName = useMemo(() => {
        const currentPageName = getPage(currentPageIndex, pages).name;
        const SEPARATOR = '/';
        const tmpPageName = `${currentPageName}${SEPARATOR}${totalPages}`;

        return readingDirection === ReadingDirection.LTR ? tmpPageName : reverseString(tmpPageName, SEPARATOR);
    }, [currentPageIndex, pages, totalPages, readingDirection]);

    if (!shouldShowPageNumber) {
        return null;
    }

    if (isMaximized) {
        return null;
    }

    if (isDesktop && progressBarType === ProgressBarType.STANDARD) {
        return null;
    }

    if (isMaximized && progressBarType === ProgressBarType.HIDDEN) {
        return null;
    }

    return (
        <Stack
            sx={{
                position: 'fixed',
                left: readerNavBarWidth,
                right: 0,
                bottom: (theme) => `max(calc(${theme.spacing(1)} + ${scrollbar.xSize}px), env(safe-area-inset-bottom))`,
                alignItems: 'center',
                transition: (theme) => `left 0.${theme.transitions.duration.shortest}s`,
            }}
        >
            <Box
                sx={{
                    p: 0.5,
                    borderRadius: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                }}
            >
                {/* 
                    CHANGE: 
                    1. Added class 'yomitan-ghost-text'
                    2. Moved text to data-text={pageName}
                    3. Removed children (self-closing tag)
                */}
                <Typography 
                    className="yomitan-ghost-text"
                    data-text={pageName}
                    sx={{ color: 'white' }} 
                />
            </Box>
        </Stack>
    );
};

export const ReaderPageNumber = withPropsFrom(
    BaseReaderPageNumber,
    [ReaderService.useOverlayMode, useNavBarContext],
    ['isDesktop', 'readerNavBarWidth'],
);
