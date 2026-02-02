/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { BoxProps } from '@mui/material/Box';
import { TooltipProps } from '@mui/material/Tooltip';
import { IReaderSettings, PageData } from '@/features/reader/Reader.types.ts';

export interface ReaderProgressBarProps extends Pick<IReaderSettings, 'progressBarPosition'> {}

export interface TReaderProgressCurrentPage extends PageData {
    pagesIndex: number;
}

export interface ReaderProgressBarSlotProps extends Pick<IReaderSettings, 'progressBarPosition'> {
    pageName: string;
    slotProps?: {
        box?: BoxProps;
        tooltip?: Omit<TooltipProps, 'title' | 'children'>;
    };
}

export interface CurrentPageSlotProps extends Pick<IReaderSettings, 'progressBarPosition'> {
    pageName: string;
    currentPagesIndex: number;
    pagesLength: number;
    isDragging: boolean;
    boxProps?: BoxProps;
}

export type TReaderProgressBarContext = {
    isMaximized: boolean;
    setIsMaximized: (visible: boolean) => void;
    isDragging: boolean;
    setIsDragging: (isDragging: boolean) => void;
};
