/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';
import { IReaderSettings } from '@/features/reader/Reader.types.ts';
import { shouldForwardProp } from '@/base/utils/ShouldForwardProp.ts';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { getProgressBarPositionInfo } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.utils.tsx';

type ReaderProgressBarContainerProps = Pick<IReaderSettings, 'progressBarPosition'>;
export const ReaderProgressBarContainer = styled(Stack, {
    shouldForwardProp: shouldForwardProp<ReaderProgressBarContainerProps>(['progressBarPosition']),
})<ReaderProgressBarContainerProps>(({ theme, progressBarPosition }) => ({
    position: 'fixed',
    pointerEvents: 'all',
    touchAction: 'none',
    ...applyStyles(getProgressBarPositionInfo(progressBarPosition).isHorizontal, {
        justifyContent: 'flex-end',
        bottom: 0,
        right: 0,
    }),
    ...applyStyles(getProgressBarPositionInfo(progressBarPosition).isVertical, {
        top: 0,
        bottom: 0,
    }),
    ...applyStyles(getProgressBarPositionInfo(progressBarPosition).isLeft, {
        alignItems: theme.direction === 'ltr' ? 'flex-start' : 'flex-end',
    }),
    ...applyStyles(getProgressBarPositionInfo(progressBarPosition).isRight, {
        alignItems: theme.direction === 'ltr' ? 'flex-end' : 'flex-start',
    }),
    WebkitTapHighlightColor: 'transparent',
}));
