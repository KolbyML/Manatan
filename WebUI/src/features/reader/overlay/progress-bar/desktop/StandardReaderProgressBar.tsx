/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTheme } from '@mui/material/styles';
import { memo, useCallback, useState } from 'react';
import { ReaderProgressBar } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.tsx';
import { ReaderService } from '@/features/reader/services/ReaderService.ts';
import { ProgressBarType } from '@/features/reader/Reader.types.ts';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { getProgressBarPositionInfo } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.utils.tsx';
import { ReaderProgressBarDirectionWrapper } from '@/features/reader/overlay/progress-bar/components/ReaderProgressBarDirectionWrapper.tsx';
import { NavbarContextType } from '@/features/navigation-bar/NavigationBar.types.ts';
import { withPropsFrom } from '@/base/hoc/withPropsFrom.tsx';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { ReaderProgressBarSlotDesktop } from '@/features/reader/overlay/progress-bar/desktop/components/ReaderProgressBarSlotDesktop.tsx';
import { useResizeObserver } from '@/base/hooks/useResizeObserver.tsx';
import { getProgressBarPosition } from '@/features/reader/settings/ReaderSettings.utils.tsx';
import {
    useReaderPagesStore,
    useReaderProgressBarStore,
    useReaderScrollbarStore,
    useReaderSettingsStore,
} from '@/features/reader/stores/ReaderStore.ts';

const BaseStandardReaderProgressBar = ({
    readerNavBarWidth,
    readerDirection,
}: Pick<NavbarContextType, 'readerNavBarWidth'> & {
    readerDirection: ReturnType<typeof ReaderService.useGetThemeDirection>;
}) => {
    const theme = useTheme();

    const scrollbar = useReaderScrollbarStore((state) => state.scrollbar);
    const totalPages = useReaderPagesStore((state) => state.pages.totalPages);
    const { progressBarType, progressBarSize, progressBarPosition, progressBarPositionAutoVertical } =
        useReaderSettingsStore((state) => ({
            progressBarType: state.settings.progressBarType,
            progressBarSize: state.settings.progressBarSize,
            progressBarPosition: state.settings.progressBarPosition,
            progressBarPositionAutoVertical: state.settings.progressBarPositionAutoVertical,
        }));
    const { isMaximized, setIsMaximized, isDragging } = useReaderProgressBarStore((state) => ({
        isMaximized: state.progressBar.isMaximized,
        setIsMaximized: state.progressBar.setIsMaximized,
        isDragging: state.progressBar.isDragging,
    }));

    const [, setRefreshProgressBarPosition] = useState({});
    useResizeObserver(
        window.document.documentElement,
        useCallback(() => setRefreshProgressBarPosition({}), []),
    );

    const finalProgressBarPosition = getProgressBarPosition(
        progressBarPosition,
        progressBarPositionAutoVertical,
        scrollbar.ySize,
        readerNavBarWidth + scrollbar.xSize,
    );
    const { isBottom, isLeft, isRight, isVertical, isHorizontal } =
        getProgressBarPositionInfo(finalProgressBarPosition);

    const arePagesLoaded = !!totalPages;
    const isHidden = progressBarType === ProgressBarType.HIDDEN;
    const isMinimized = !isMaximized && !isDragging;

    // the progress bar uses the reading direction to set the themes direction, thus, stuff has to be adjusted to still be correctly positioned
    // depending on which combination of theme direction and reading direction is currently active
    return (
        <ReaderProgressBarDirectionWrapper>
            <ReaderProgressBar
                direction={isHorizontal ? readerDirection : 'ltr'}
                progressBarPosition={finalProgressBarPosition}
                fullSegmentClicks
                createProgressBarSlot={useCallback(
                    (
                        page,
                        _pagesIndex,
                        primaryPageLoadState,
                        secondaryPageLoadState,
                        isCurrentPage,
                        isLeadingPage,
                        _isTrailingPage,
                        _totalPages,
                        showDraggingStyle,
                    ) => (
                        <ReaderProgressBarSlotDesktop
                            pageName={page.name}
                            primaryPageLoadState={primaryPageLoadState}
                            secondaryPageLoadState={secondaryPageLoadState}
                            progressBarPosition={finalProgressBarPosition}
                            isCurrentPage={isCurrentPage}
                            isLeadingPage={isLeadingPage}
                            showDraggingStyle={showDraggingStyle}
                        />
                    ),
                    [finalProgressBarPosition],
                )}
                slotProps={{
                    container: {
                        sx: {
                            overflow: 'hidden',
                            transition: `all 0.${theme.transitions.duration.shortest}s`,
                            ...applyStyles(isHorizontal, {
                                minHeight: '100px',
                                ...applyStyles(theme.direction === 'ltr', {
                                    left: readerDirection === 'ltr' ? readerNavBarWidth : scrollbar.ySize,
                                    right: readerDirection === 'rtl' ? readerNavBarWidth : scrollbar.ySize,
                                }),
                                ...applyStyles(theme.direction === 'rtl', {
                                    left: readerDirection === 'rtl' ? readerNavBarWidth : scrollbar.ySize,
                                    right: readerDirection === 'ltr' ? readerNavBarWidth : scrollbar.ySize,
                                }),
                            }),
                            ...applyStyles(isVertical, {
                                minWidth: '100px',
                                bottom: `${scrollbar.xSize}px`,
                            }),
                            ...applyStyles(isBottom, {
                                bottom: `${scrollbar.xSize}px`,
                            }),
                            ...applyStyles(isLeft, {
                                ...applyStyles(theme.direction === 'ltr', {
                                    left: readerDirection === 'ltr' ? readerNavBarWidth : 'unset',
                                    right: readerDirection === 'rtl' ? readerNavBarWidth : 'unset',
                                }),
                                ...applyStyles(theme.direction === 'rtl', {
                                    right: readerDirection === 'rtl' ? scrollbar.ySize : 'unset',
                                    left: readerDirection === 'ltr' ? scrollbar.ySize : 'unset',
                                }),
                            }),
                            ...applyStyles(isRight, {
                                ...applyStyles(theme.direction === 'ltr', {
                                    right: readerDirection === 'ltr' ? scrollbar.ySize : 'unset',
                                    left: readerDirection === 'rtl' ? scrollbar.ySize : 'unset',
                                }),
                                ...applyStyles(theme.direction === 'rtl', {
                                    left: readerDirection === 'rtl' ? readerNavBarWidth : 'unset',
                                    right: readerDirection === 'ltr' ? readerNavBarWidth : 'unset',
                                }),
                            }),
                            ...applyStyles(isMinimized, {
                                opacity: !isHidden ? 0.85 : 0,
                            }),
                            ...applyStyles(!arePagesLoaded, {
                                pointerEvents: 'none',
                            }),
                        },
                        onMouseEnter: () => setIsMaximized(true),
                        onMouseLeave: () => setIsMaximized(false),
                    },
                    progressBarRoot: {
                        sx: {
                            gap: 0,
                            transition: 'all 0.1s ease-in-out',
                            backgroundColor: 'background.paper',
                            ...applyStyles(isVertical, {
                                flexDirection: 'column',
                                height: '100%',
                            }),
                            ...applyStyles(isMinimized, {
                                backgroundColor: 'unset',
                                pointerEvents: 'none',
                                ...applyStyles(isHorizontal, {
                                    px: 2,
                                }),
                                ...applyStyles(isVertical, {
                                    py: 2,
                                }),
                                ...applyStyles(isBottom, {
                                    pb: 0.25,
                                }),
                                ...applyStyles(isLeft, {
                                    ...applyStyles(theme.direction === 'ltr', {
                                        pl: readerDirection === 'ltr' ? 0.25 : 0,
                                        pr: readerDirection === 'rtl' ? 0.25 : 0,
                                    }),
                                    ...applyStyles(theme.direction === 'rtl', {
                                        pr: readerDirection === 'rtl' ? 0.25 : 0,
                                        pl: readerDirection === 'ltr' ? 0.25 : 0,
                                    }),
                                }),
                                ...applyStyles(isRight, {
                                    ...applyStyles(theme.direction === 'ltr', {
                                        pr: readerDirection === 'ltr' ? 0.25 : 0,
                                        pl: readerDirection === 'rtl' ? 0.25 : 0,
                                    }),
                                    ...applyStyles(theme.direction === 'rtl', {
                                        pl: readerDirection === 'rtl' ? 0.25 : 0,
                                        pr: readerDirection === 'ltr' ? 0.25 : 0,
                                    }),
                                }),
                            }),
                        },
                    },
                    progressBarSlotsContainer: {
                        sx: {
                            gap: 0.25,
                            borderRadius: 2,
                            transition: 'height 0.1s ease-in-out',
                            ...applyStyles(isHorizontal, {
                                height: '20px',
                            }),
                            ...applyStyles(isVertical, {
                                flexDirection: 'column',
                                width: '20px',
                            }),
                            ...applyStyles(isMinimized, {
                                ...applyStyles(isHorizontal, {
                                    height: `${progressBarSize}px`,
                                }),
                                ...applyStyles(isVertical, {
                                    width: `${progressBarSize}px`,
                                }),
                            }),
                        },
                    },
                    progressBarReadPages: { sx: { display: 'none' } },
                    progressBarCurrentPageSlot: { sx: { display: 'none' } },
                    progressBarPageTexts: {
                        base: {
                            sx: {
                                px: 1,
                                py: 1.5,
                                transition: 'all 0.1s ease-in-out',
                                ...applyStyles(isMinimized, {
                                    transform: 'scale(0)',
                                    p: 0,
                                    minWidth: 0,
                                    maxWidth: 0,
                                    minHeight: 0,
                                    maxHeight: 0,
                                }),
                            },
                        },
                    },
                }}
            />
        </ReaderProgressBarDirectionWrapper>
    );
};

export const StandardReaderProgressBar = withPropsFrom(
    memo(BaseStandardReaderProgressBar),
    [useNavBarContext, () => ({ readerDirection: ReaderService.useGetThemeDirection() })],
    ['readerNavBarWidth', 'readerDirection'],
);
