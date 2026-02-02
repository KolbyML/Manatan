/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollDirection } from '@/base/Base.types.ts';
import { useResizeObserver } from '@/base/hooks/useResizeObserver.tsx';

// "scrollBy" and "scrollTo" both require at least a change of 1px, otherwise, nothing happens
const MIN_SCROLL_AMOUNT_PX = 1;
const getScrollAmount = (
    amountPerMs: number,
    speedMs: number,
    isRTL: boolean = false,
    invert: boolean = false,
): number => {
    const pxPerMs = Math.max(amountPerMs * speedMs, MIN_SCROLL_AMOUNT_PX);
    const pxPerMsReadingMode = isRTL ? -pxPerMs : pxPerMs;
    const pxPerMsInverted = invert ? pxPerMsReadingMode * -1 : pxPerMsReadingMode;

    return pxPerMsInverted;
};

const getPxPerMs = (size: number, scrollAmountPercentage: number, scrollSpeedMs: number): number =>
    (size * (scrollAmountPercentage / 100)) / scrollSpeedMs;

function handleScrolling(
    smooth: boolean,
    scrollSpeedMs: number,
    setScrollTriggerId: (id: NodeJS.Timeout | number, type: 'interval' | 'animationFrame') => void,
    performScroll: (elapsedTime: number) => void,
    clearScrollTriggers: () => void,
): void {
    clearScrollTriggers();

    if (!smooth) {
        setScrollTriggerId(
            setInterval(() => {
                performScroll(scrollSpeedMs);
            }, scrollSpeedMs),
            'interval',
        );
        return;
    }

    let startTime: number;
    const triggerScroll = (timestamp: DOMHighResTimeStamp) => {
        const elapsedTime = timestamp - (startTime ?? timestamp);
        startTime = timestamp;

        performScroll(elapsedTime);
        setScrollTriggerId(requestAnimationFrame(triggerScroll), 'animationFrame');
    };

    setScrollTriggerId(requestAnimationFrame(triggerScroll), 'animationFrame');
}

export const useAutomaticScrolling = (
    refOrCallback: MutableRefObject<HTMLElement | null> | (() => void) | undefined,
    scrollPerSecond: number,
    scrollDirection: Exclude<ScrollDirection, ScrollDirection.XY> = ScrollDirection.Y,
    scrollAmountPercentage: number = 100,
    invert: boolean = false,
    smooth: boolean = false,
): {
    isActive: boolean;
    isPaused: boolean;
    start: () => void;
    cancel: () => void;
    toggleActive: () => void;
    pause: () => void;
    resume: () => void;
} => {
    const isCallback = typeof refOrCallback === 'function';

    const elementStyle = useRef<CSSStyleDeclaration>(undefined);
    const scrollTriggerTimer = useRef<NodeJS.Timeout>(undefined);
    const scrollTriggerAnimationFrameId = useRef(-1);

    const [isActive, setIsActive] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    // scroll amount is based on the screen dimensions, thus, the hook needs to update in case they change
    const [screenDimensions, setScreenDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
    useResizeObserver(
        document.documentElement,
        useCallback(() => {
            const width = window.innerWidth;
            const height = window.innerHeight;

            if (screenDimensions.width !== width || screenDimensions.height !== height) {
                setScreenDimensions({ width, height });
            }
        }, []),
    );

    const clearScrollTriggers = useCallback(() => {
        clearTimeout(scrollTriggerTimer.current);
        cancelAnimationFrame(scrollTriggerAnimationFrameId.current);
    }, []);

    const start = useCallback(() => {
        setIsActive(true);
    }, []);
    const cancel = useCallback(() => {
        setIsActive(false);
        setIsPaused(false);
        clearScrollTriggers();
    }, []);
    const toggleActive = useCallback(() => {
        if (isActive) {
            cancel();
            return;
        }

        start();
    }, [isActive]);
    const pause = useCallback(() => {
        setIsPaused(true);
    }, []);
    const resume = useCallback(() => {
        setIsPaused(false);
    }, []);

    useEffect(() => {
        if (!refOrCallback || !isActive) {
            return () => {};
        }

        if (isPaused) {
            clearScrollTriggers();
            return () => {};
        }

        const scrollSpeedMs = scrollPerSecond * 1000;

        if (isCallback) {
            handleScrolling(
                false,
                scrollSpeedMs,
                (id) => {
                    scrollTriggerTimer.current = id as NodeJS.Timeout;
                },
                refOrCallback,
                clearScrollTriggers,
            );
            return () => clearScrollTriggers();
        }

        const element = refOrCallback.current;
        if (!element) {
            return () => {};
        }

        if (!elementStyle.current) {
            elementStyle.current = getComputedStyle(element);
        }

        const isRTL = elementStyle.current.direction === 'rtl';
        const handleScrollX = scrollDirection !== ScrollDirection.Y;
        const handleScrollY = scrollDirection !== ScrollDirection.X;

        const pxPerMsX = getPxPerMs(window.innerWidth, scrollAmountPercentage, scrollSpeedMs);
        const pxPerMsY = getPxPerMs(window.innerHeight, scrollAmountPercentage, scrollSpeedMs);

        handleScrolling(
            smooth,
            scrollSpeedMs,
            (id, type) => {
                switch (type) {
                    case 'interval':
                        scrollTriggerTimer.current = id as NodeJS.Timeout;
                        break;
                    case 'animationFrame':
                        scrollTriggerAnimationFrameId.current = id as number;
                        break;
                    default:
                        throw new Error(`Unexpected "type" (${type})`);
                }
            },
            (elapsedTime) => {
                element.scrollBy({
                    top: Number(handleScrollY) * getScrollAmount(pxPerMsY, elapsedTime, false, invert),
                    left: Number(handleScrollX) * getScrollAmount(pxPerMsX, elapsedTime, isRTL, invert),
                    // arg "smooth" triggers the interval so fast that using "behavior smooth" doesn't look smooth and also slows down the scrolling
                    behavior: smooth ? undefined : 'smooth',
                });
            },
            clearScrollTriggers,
        );

        return () => clearScrollTriggers();
    }, [refOrCallback, scrollPerSecond, scrollAmountPercentage, screenDimensions, isActive, isPaused, invert, smooth]);

    return useMemo(
        () => ({ isActive, isPaused, start, cancel, toggleActive, pause, resume }),
        [isActive, isPaused, start, cancel, toggleActive, pause, resume],
    );
};
