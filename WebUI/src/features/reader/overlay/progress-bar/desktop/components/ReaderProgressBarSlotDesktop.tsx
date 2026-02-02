/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { alpha, darken, lighten, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import { memo } from 'react';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { ReaderProgressBarSlot } from '@/features/reader/overlay/progress-bar/components/ReaderProgressBarSlot.tsx';
import { IReaderSettings } from '@/features/reader/Reader.types.ts';

export const ReaderProgressBarSlotDesktop = memo(
    ({
        pageName,
        primaryPageLoadState,
        secondaryPageLoadState,
        progressBarPosition,
        isCurrentPage,
        isLeadingPage,
        showDraggingStyle,
    }: Pick<IReaderSettings, 'progressBarPosition'> & {
        pageName: string;
        primaryPageLoadState: boolean;
        secondaryPageLoadState?: boolean;
        isCurrentPage: boolean;
        isLeadingPage: boolean;
        showDraggingStyle: boolean;
    }) => {
        const theme = useTheme();

        return (
            <ReaderProgressBarSlot
                pageName={pageName}
                progressBarPosition={progressBarPosition}
                slotProps={{
                    box: {
                        sx: {
                            cursor: 'pointer',
                            backgroundColor: darken(theme.palette.background.paper, 0.2),
                            ...theme.applyStyles('dark', {
                                backgroundColor: lighten(theme.palette.background.paper, 0.1),
                            }),
                            ...applyStyles(
                                primaryPageLoadState && (secondaryPageLoadState == null || secondaryPageLoadState),
                                {
                                    backgroundColor: darken(theme.palette.background.paper, 0.35),
                                    ...theme.applyStyles('dark', {
                                        backgroundColor: lighten(theme.palette.background.paper, 0.25),
                                    }),
                                },
                            ),
                        },
                    },
                    tooltip: {
                        slotProps: isCurrentPage
                            ? {
                                  tooltip: {
                                      sx: {
                                          backgroundColor: 'primary.main',
                                          color: 'primary.contrastText',
                                      },
                                  },
                              }
                            : undefined,
                    },
                }}
            >
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        ...applyStyles(isLeadingPage, {
                            backgroundColor: alpha(theme.palette.primary.main, 0.5),
                        }),
                        ...applyStyles(isCurrentPage, {
                            cursor: showDraggingStyle ? 'grabbing' : 'grab',
                            pointer: 'grabbing',
                            borderRadius: 2,
                            backgroundColor: 'primary.dark',
                            ...theme.applyStyles('dark', {
                                backgroundColor: 'primary.light',
                            }),
                        }),
                    }}
                />
            </ReaderProgressBarSlot>
        );
    },
);
