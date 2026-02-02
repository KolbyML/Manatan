/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import { shouldForwardProp } from '@/base/utils/ShouldForwardProp.ts';
import { IReaderSettings } from '@/features/reader/Reader.types.ts';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { getProgressBarPositionInfo } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.utils.tsx';

type ProgressBarHighlightReadPagesProps = Pick<IReaderSettings, 'progressBarPosition'> & {
    currentPagesIndex: number;
    pagesLength: number;
};
export const ProgressBarHighlightReadPages = styled(Box, {
    shouldForwardProp: shouldForwardProp<ProgressBarHighlightReadPagesProps>([
        'currentPagesIndex',
        'pagesLength',
        'progressBarPosition',
    ]),
})<ProgressBarHighlightReadPagesProps>(({ currentPagesIndex, pagesLength, progressBarPosition }) => ({
    position: 'absolute',
    pointerEvents: 'none',
    ...applyStyles(getProgressBarPositionInfo(progressBarPosition).isHorizontal, {
        left: 0,
        width: `${((currentPagesIndex + 1) / pagesLength) * 100}%`,
        height: '100%',
    }),
    ...applyStyles(getProgressBarPositionInfo(progressBarPosition).isVertical, {
        top: 0,
        width: '100%',
        height: `${((currentPagesIndex + 1) / pagesLength) * 100}%`,
    }),
}));
