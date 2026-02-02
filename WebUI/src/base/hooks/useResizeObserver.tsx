/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { RefObject, useLayoutEffect, useState } from 'react';

export const useResizeObserver = (
    ref: RefObject<HTMLElement | null> | HTMLElement | undefined | null,
    callback: ResizeObserverCallback,
): (() => void) => {
    const [disconnect, setDisconnect] = useState<() => void>(() => {});

    useLayoutEffect(() => {
        const element = ref instanceof HTMLElement ? ref : ref?.current;

        if (!element) {
            return () => {};
        }

        const resizeObserver = new ResizeObserver(callback);
        resizeObserver.observe(element);

        setDisconnect(() => () => resizeObserver.disconnect());

        return () => resizeObserver.disconnect();
    }, [ref, callback]);

    return disconnect;
};
