/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { MutableRefObject, useEffect } from 'react';
import { TReaderTapZoneContext } from '@/features/reader/tap-zones/TapZoneLayout.types.ts';
import { getReaderOverlayStore } from '@/features/reader/stores/ReaderStore.ts';

export const useReaderHideOverlayOnUserScroll = (
    isOverlayVisible: boolean,
    showPreview: TReaderTapZoneContext['showPreview'],
    setShowPreview: TReaderTapZoneContext['setShowPreview'],
    scrollElementRef: MutableRefObject<HTMLDivElement | null>,
) => {
    useEffect(() => {
        const handleScroll = () => {
            if (isOverlayVisible) {
                getReaderOverlayStore().setIsVisible(false);
            }

            if (showPreview) {
                setShowPreview(false);
            }
        };

        scrollElementRef.current?.addEventListener('wheel', handleScroll, { passive: true });
        scrollElementRef.current?.addEventListener('touchmove', handleScroll, { passive: true });
        return () => {
            scrollElementRef.current?.removeEventListener('wheel', handleScroll);
            scrollElementRef.current?.removeEventListener('touchmove', handleScroll);
        };
    }, [isOverlayVisible, showPreview]);
};
