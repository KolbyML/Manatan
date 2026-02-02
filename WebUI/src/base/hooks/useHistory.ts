/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useEffect, useState } from 'react';
import { NavigationType, useLocation, useNavigationType } from 'react-router-dom';

const MAX_DEPTH = 50;

export const useHistory = () => {
    const location = useLocation();
    const navigationType = useNavigationType();

    const [history, setHistory] = useState<string[]>([location.pathname]);

    const updateHistory = useCallback((newHistory: string[]) => {
        // prevent the history from getting too large (only relevant in case the app never gets reloaded (e.g. browser F5,
        // electron window gets closed))
        // theoretically the history should be empty for the "base" pages (e.g. library, updates, ...), but since the browser
        // navigation is used, opening another base page pushes this page to this history, as if it had a different depth
        // than the current page (expected history: library -> manga -> reader,
        // possible history: library -> updates -> settings -> library -> manga -> reader)
        setHistory(newHistory.slice(-MAX_DEPTH));
    }, []);

    useEffect(() => {
        const isLastPageInHistory = location.key === 'default';
        const ignoreInitialPop = isLastPageInHistory && history.length === 1;
        if (ignoreInitialPop) {
            return;
        }

        switch (navigationType) {
            case NavigationType.Pop:
                updateHistory([...history.slice(0, -1)]);
                break;
            case NavigationType.Push:
                updateHistory([...history, location.pathname + location.search]);
                break;
            case NavigationType.Replace:
                updateHistory([...history.slice(0, -1), location.pathname + location.search]);
                break;
            default:
                throw new Error(`Unexpected NavigationType "${navigationType}"`);
        }
    }, [location]);

    return history;
};
