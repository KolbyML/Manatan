/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { SliceCreator } from '@/lib/zustand/Zustand.types.ts';
import { TReaderProgressBarContext } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.types.ts';

export interface ReaderProgressBarStoreSlice {
    progressBar: TReaderProgressBarContext & {
        reset: () => ReaderProgressBarStoreSlice;
    };
}

const DEFAULT_STATE = {
    isMaximized: false,
    isDragging: false,
} satisfies Pick<ReaderProgressBarStoreSlice['progressBar'], 'isDragging' | 'isMaximized'>;

export const createReaderProgressBarStoreSlice = <T extends ReaderProgressBarStoreSlice>(
    ...[createActionName, set, get]: Parameters<SliceCreator<T>>
): ReaderProgressBarStoreSlice => ({
    progressBar: {
        ...DEFAULT_STATE,
        setIsMaximized: (maximized) =>
            set(
                (draft) => {
                    draft.progressBar.isMaximized = maximized;
                },
                undefined,
                createActionName('setIsMaximized'),
            ),
        setIsDragging: (dragging) =>
            set(
                (draft) => {
                    draft.progressBar.isDragging = dragging;
                },
                undefined,
                createActionName('setIsDragging'),
            ),
        reset: () => ({ progressBar: { ...get().progressBar, ...DEFAULT_STATE } }),
    },
});
