/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * credit: (06.12.2024 - 00:11)
 *  MobileLikeScroller
 *  https://github.com/utsb-fmm/MobileLikeScroller/blob/main/mobilelikescroller.js
 */

import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { ScrollDirection } from '@/base/Base.types.ts';
import { coerceIn } from '@/lib/HelperFunctions.ts';

type Positions = [OldestPos: number, SecondOldestPos: number, LatestPos: number];
type ClickTimes = [OldestTime: number, SecondOldestTime: number, LatestTime: number];

const OLDEST = 2;
const LATEST = 0;

const X = 0;
const Y = 1;

export const useMouseDragScroll = (
    ref?: MutableRefObject<HTMLElement | null>,
    scrollDirection: ScrollDirection = ScrollDirection.XY,
) => {
    const [isDragging, setIsDragging] = useState(false);

    const elementStyle = useRef<CSSStyleDeclaration>(undefined);
    const previousClickPosX = useRef<Positions>([0, 0, 0]);
    const previousClickPosY = useRef<Positions>([0, 0, 0]);
    const previousClickTime = useRef<ClickTimes>([0, 0, 0]);
    const scrollAtT0 = useRef<[ScrollLeft: number, ScrollTop: number]>([0, 0]);
    const inertiaTimeInterval = useRef<number>(undefined);
    const initialMousePos = useRef<[x: number, y: number]>([0, 0]);
    const initialScrollPos = useRef<[left: number, top: number]>([0, 0]);

    useEffect(() => {
        const element = ref?.current;

        if (!element) {
            return () => {};
        }

        const isRTL = () => {
            if (!elementStyle.current) {
                elementStyle.current = getComputedStyle(element);
            }

            const isRTLDirection = elementStyle.current.direction === 'rtl';
            const isFlexDirectionReversed = elementStyle.current.flexDirection === 'row';

            return isRTLDirection || (!isRTLDirection && isFlexDirectionReversed);
        };

        const isTopReversed = () => {
            if (!elementStyle.current) {
                elementStyle.current = getComputedStyle(element);
            }

            return elementStyle.current.flexDirection === 'column-reverse';
        };

        const handleScrollX = scrollDirection !== ScrollDirection.Y;
        const handleScrollY = scrollDirection !== ScrollDirection.X;

        const clearInertiaInterval = () => {
            if (inertiaTimeInterval.current !== undefined) {
                cancelAnimationFrame(inertiaTimeInterval.current);
                inertiaTimeInterval.current = undefined;
            }
        };

        const inertiaMove = () => {
            const calcVelocity = (positions: Positions, clickTimes: ClickTimes, size: number): number =>
                (((positions[LATEST] - positions[OLDEST]) / (clickTimes[LATEST] - clickTimes[OLDEST])) * 1000) / size;

            const v0 = [
                handleScrollX
                    ? calcVelocity(previousClickPosX.current, previousClickTime.current, element.clientWidth)
                    : 0,
                handleScrollY
                    ? calcVelocity(previousClickPosY.current, previousClickTime.current, element.clientHeight)
                    : 0,
            ];

            const a0V = (() => {
                if (handleScrollX && handleScrollY) {
                    return Math.sqrt(v0[X] ** 2 + v0[Y] ** 2);
                }

                if (handleScrollY) {
                    return Math.abs(v0[Y]);
                }

                return Math.abs(v0[X]);
            })();
            const unitVector = [v0[X] / a0V, v0[Y] / a0V];
            const a0VCoerced = coerceIn(1.2 * a0V, -12, 12);

            const t = (Date.now() - previousClickTime.current[LATEST]) / 1000;
            const v =
                a0VCoerced - 14.278 * t + (75.24 * t ** 2) / a0VCoerced - (149.72 * t ** 3) / a0VCoerced / a0VCoerced;

            const isValidVelocity = a0VCoerced !== 0 && v > 0 && !Number.isNaN(a0VCoerced);
            if (!isValidVelocity) {
                clearInertiaInterval();
                return;
            }

            const calcDelta = (size: number, unit: number): number =>
                size *
                unit *
                (a0VCoerced * t -
                    7.1397 * t ** 2 +
                    (25.08 * t ** 3) / a0VCoerced -
                    (37.43 * t ** 4) / a0VCoerced / a0VCoerced);

            const delta = [
                calcDelta(element.clientWidth, unitVector[X]),
                calcDelta(element.clientHeight, unitVector[Y]),
            ];
            const maxScrollPos = [
                element.scrollWidth - element.clientWidth,
                element.scrollHeight - element.clientHeight,
            ];
            const newScrollPos = [
                coerceIn(scrollAtT0.current[X] - delta[X], isRTL() ? -maxScrollPos[X] : 0, maxScrollPos[X]),
                coerceIn(scrollAtT0.current[Y] - delta[Y], isTopReversed() ? -maxScrollPos[Y] : 0, maxScrollPos[Y]),
            ];

            const isScrollXPossible = newScrollPos[X] !== 0 || newScrollPos[X] !== maxScrollPos[X];
            const isScrollYPossible = newScrollPos[Y] !== 0 || newScrollPos[Y] !== maxScrollPos[Y];
            const isScrollPossible = isScrollXPossible || isScrollYPossible;
            if (!isScrollPossible) {
                clearInertiaInterval();
            }

            if (handleScrollX) {
                element.scrollLeft = newScrollPos[X];
            }

            if (handleScrollY) {
                element.scrollTop = newScrollPos[Y];
            }
        };

        let isHandlingMouseMoveEvents = false;
        const shouldStartHandlingMouseMoveEvents = (e: MouseEvent) => {
            if (isHandlingMouseMoveEvents) {
                return true;
            }

            const hasScrollBar = [
                element.clientHeight < element.scrollHeight,
                element.clientWidth < element.scrollWidth,
            ];
            const didPosChange = [
                Math.abs(previousClickPosX.current[LATEST] - e.pageX) > 0,
                Math.abs(previousClickPosY.current[LATEST] - e.pageY) > 0,
            ];

            return (hasScrollBar[X] && didPosChange[X]) || (hasScrollBar[Y] && didPosChange[Y]);
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!shouldStartHandlingMouseMoveEvents(e)) {
                return;
            }

            isHandlingMouseMoveEvents = true;
            setIsDragging(true);

            previousClickPosX.current = [...(previousClickPosX.current.slice(1) as [number, number]), e.pageX];
            previousClickPosY.current = [...(previousClickPosY.current.slice(1) as [number, number]), e.pageY];
            previousClickTime.current = [...(previousClickTime.current.slice(1) as [number, number]), Date.now()];

            // Use absolute positioning from initial drag position to prevent drift
            if (handleScrollX) {
                element.scrollLeft = initialScrollPos.current[X] - (e.pageX - initialMousePos.current[X]);
            }

            if (handleScrollY) {
                element.scrollTop = initialScrollPos.current[Y] - (e.pageY - initialMousePos.current[Y]);
            }
        };

        const handleMouseUp = () => {
            element.removeEventListener('mousemove', handleMouseMove);
            element.removeEventListener('mouseup', handleMouseUp);

            // move disabling drag handling to next event loop cycle so that e.g. the resulting mouse click at the end of the dragging can be ignored
            setTimeout(() => {
                isHandlingMouseMoveEvents = false;
                setIsDragging(false);
            }, 0);

            scrollAtT0.current = [element.scrollLeft, element.scrollTop];

            const inertiaLoop = () => {
                inertiaMove();
                inertiaTimeInterval.current = requestAnimationFrame(inertiaLoop);
            };
            inertiaTimeInterval.current = requestAnimationFrame(inertiaLoop);
        };

        const handleMouseDown = (e: MouseEvent) => {
            const isLeftMouseButton = e.button === 0;
            if (!isLeftMouseButton) {
                return;
            }

            e.preventDefault();

            // Store initial positions for absolute positioning during drag
            initialMousePos.current = [e.pageX, e.pageY];
            initialScrollPos.current = [element.scrollLeft, element.scrollTop];

            previousClickPosX.current = [e.pageX, e.pageX, e.pageX];
            previousClickPosY.current = [e.pageY, e.pageY, e.pageY];
            previousClickTime.current = [Date.now() - 2, Date.now() - 1, Date.now()];

            element.addEventListener('mousemove', handleMouseMove, { passive: true });
            element.addEventListener('mouseup', handleMouseUp);

            clearInertiaInterval();
        };

        element.addEventListener('mousedown', handleMouseDown);
        element.addEventListener('wheel', clearInertiaInterval, { passive: true });
        return () => {
            element.removeEventListener('mousedown', handleMouseDown);
            element.removeEventListener('wheel', clearInertiaInterval);
            clearInertiaInterval();
        };
    }, [ref, scrollDirection]);

    return isDragging;
};
