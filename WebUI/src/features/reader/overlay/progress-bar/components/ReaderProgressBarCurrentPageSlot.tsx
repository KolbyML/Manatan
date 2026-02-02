/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import { ReactNode } from 'react';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { CurrentPageSlotProps } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.types.ts';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { getProgressBarPositionInfo } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.utils.tsx';
import { READER_PROGRESS_BAR_POSITION_TO_PLACEMENT } from '@/features/reader/settings/ReaderSettings.constants.tsx';

export const ReaderProgressBarCurrentPageSlot = ({
    pageName,
    currentPagesIndex,
    pagesLength,
    isDragging,
    boxProps,
    children,
    progressBarPosition,
}: CurrentPageSlotProps & { children?: ReactNode }) => (
    <CustomTooltip
        title={pageName}
        slotProps={{
            tooltip: { sx: { backgroundColor: 'primary.main', color: 'primary.contrastText' } },
        }}
        placement={READER_PROGRESS_BAR_POSITION_TO_PLACEMENT[progressBarPosition]}
        disableTouchListener
    >
        <Box
            {...boxProps}
            sx={{
                position: 'absolute',
                cursor: isDragging ? 'grabbing' : 'grab',
                ...applyStyles(getProgressBarPositionInfo(progressBarPosition).isHorizontal, {
                    left: `${(Math.max(0, currentPagesIndex - 1) / (pagesLength - 1)) * 100}%`,
                    width: `calc(100% / ${pagesLength - 1})`,
                    height: '100%',
                }),
                ...applyStyles(getProgressBarPositionInfo(progressBarPosition).isVertical, {
                    top: `${(Math.max(0, currentPagesIndex - 1) / (pagesLength - 1)) * 100}%`,
                    width: '100%',
                    height: `calc(100% / ${pagesLength - 1})`,
                }),
                ...boxProps?.sx,
            }}
        >
            {children}
        </Box>
    </CustomTooltip>
);
