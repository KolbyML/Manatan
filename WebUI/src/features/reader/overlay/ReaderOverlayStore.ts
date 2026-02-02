/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { SliceCreator } from '@/lib/zustand/Zustand.types.ts';

export interface ReaderOverlayStoreSlice {
    overlay: {
        isVisible: boolean;
        setIsVisible: (visible: boolean) => void;
        reset: () => ReaderOverlayStoreSlice;
    };
}

const DEFAULT_STATE = {
    isVisible: false,
} satisfies Pick<ReaderOverlayStoreSlice['overlay'], 'isVisible'>;

export const createReaderOverlayStoreSlice = <T extends ReaderOverlayStoreSlice>(
    ...[createActionName, set, get]: Parameters<SliceCreator<T>>
): ReaderOverlayStoreSlice => ({
    overlay: {
        isVisible: DEFAULT_STATE.isVisible,
        setIsVisible: (visible) =>
            set(
                (draft) => {
                    draft.overlay.isVisible = visible;
                },
                undefined,
                createActionName('setIsVisible'),
            ),
        reset: () => ({ overlay: { ...get().overlay, ...DEFAULT_STATE } }),
    },
});
