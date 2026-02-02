/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { MutableRefObject, useEffect } from 'react';
import { ReadingDirection, ReadingMode } from '@/features/reader/Reader.types.ts';
import { PointerDeviceUtil } from '@/lib/PointerDeviceUtil.ts';

export const useReaderHorizontalModeRevampScrolling = (
    readingMode: ReadingMode,
    readingDirection: ReadingDirection,
    scrollElementRef: MutableRefObject<HTMLDivElement | null>,
) => {
    // invert x and y scrolling for the continuous horizontal reading mode
    useEffect(() => {
        const scrollElement = scrollElementRef.current;

        if (readingMode !== ReadingMode.CONTINUOUS_HORIZONTAL) {
            return () => {};
        }

        if (!scrollElement) {
            return () => {};
        }

        const handleScroll = (e: WheelEvent) => {
            const isHorizontalScroll = Math.abs(e.deltaX) > Math.abs(e.deltaY);
            if (isHorizontalScroll) {
                return;
            }

            // Trackpads can scroll horizontally without having shift pressed down.
            // This makes mapping vertical scrolling to horizontal scrolling unnecessary, and additionally, it feels weird and unexpected.
            // Especially since pages can cause vertical overflow which requires scrolling up and down.
            const isTrackPadLike = PointerDeviceUtil.isTrackPadLike();
            if (isTrackPadLike) {
                return;
            }

            e.preventDefault();

            if (e.shiftKey) {
                scrollElement.scrollBy({
                    top: e.deltaY,
                });
                return;
            }

            scrollElement.scrollBy({
                left: readingDirection === ReadingDirection.LTR ? e.deltaY : e.deltaY * -1,
            });
        };

        scrollElement.addEventListener('wheel', handleScroll);
        return () => scrollElement.removeEventListener('wheel', handleScroll);
    }, [readingMode, readingDirection]);
};
