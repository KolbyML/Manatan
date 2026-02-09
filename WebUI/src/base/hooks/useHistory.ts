/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useState } from 'react';
import { NavigationType, useLocation, useNavigationType } from 'react-router-dom';

const MAX_DEPTH = 50;

type HistoryEntry = {
    key: string;
    path: string;
};

export const useHistory = () => {
    const location = useLocation();
    const navigationType = useNavigationType();

    const createPath = (pathname: string, search: string) => `${pathname}${search}`;

    const [history, setHistory] = useState<HistoryEntry[]>([
        {
            key: location.key,
            path: createPath(location.pathname, location.search),
        },
    ]);

    useEffect(() => {
        const current: HistoryEntry = {
            key: location.key,
            path: createPath(location.pathname, location.search),
        };

        setHistory((prevHistory) => {
            // Initial load uses a special key. Ignore the implicit POP.
            const isInitialLocation = current.key === 'default' && prevHistory.length === 1;
            if (isInitialLocation) {
                // Ensure we keep the full path (incl. search params).
                if (prevHistory[0]?.path === current.path) {
                    return prevHistory;
                }
                return [current];
            }

            let nextHistory: HistoryEntry[];
            switch (navigationType) {
                case NavigationType.Push:
                    nextHistory = [...prevHistory, current];
                    break;
                case NavigationType.Replace:
                    nextHistory = [...prevHistory.slice(0, -1), current];
                    break;
                case NavigationType.Pop: {
                    const existingIndex = prevHistory.findIndex((entry) => entry.key === current.key);
                    nextHistory =
                        existingIndex === -1
                            ? [...prevHistory, current]
                            : prevHistory.slice(0, existingIndex + 1);
                    break;
                }
                default:
                    throw new Error(`Unexpected NavigationType "${navigationType}"`);
            }

            // prevent the history from getting too large (only relevant in case the app never gets reloaded (e.g. browser F5,
            // electron window gets closed))
            // theoretically the history should be empty for the "base" pages (e.g. library, updates, ...), but since the browser
            // navigation is used, opening another base page pushes this page to this history, as if it had a different depth
            // than the current page (expected history: library -> manga -> reader,
            // possible history: library -> updates -> settings -> library -> manga -> reader)
            return nextHistory.slice(-MAX_DEPTH);
        });
    }, [location.key, location.pathname, location.search, navigationType]);

    return history.map((entry) => entry.path);
};
