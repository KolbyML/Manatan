/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { useAppPageHistoryContext } from '@/base/contexts/AppPageHistoryContext.tsx';

const READER_REGEX = /\/manga\/[0-9]+\/chapter\/[0-9]+/g;
const PAGES_TO_IGNORE: readonly RegExp[] = [READER_REGEX];

export const useBackButton = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const history = useAppPageHistoryContext();

    return useCallback(() => {
        const getDelta = (historyToCheck: string[] = history, delta: number = 0) => {
            const isHistoryEmpty = !historyToCheck.length;
            if (isHistoryEmpty) {
                return 0;
            }

            const isLastPageInHistoryCurrentPage =
                historyToCheck.length === 1 && historyToCheck[0] === location.pathname;
            if (isLastPageInHistoryCurrentPage) {
                return 0;
            }

            const previousPage = historyToCheck.slice(-2)[0];

            const isPreviousPageCurrentPage = previousPage === location.pathname;
            const ignorePreviousPage = PAGES_TO_IGNORE.some((page) => !!previousPage.match(page));

            const skipPreviousPage = isPreviousPageCurrentPage || ignorePreviousPage;
            if (!skipPreviousPage) {
                return delta - 1;
            }

            return getDelta(historyToCheck.slice(0, -1), delta - 1);
        };

        const backDelta = getDelta();

        const canNavigateBack = backDelta < 0;
        if (!canNavigateBack) {
            navigate(AppRoutes.library.path());
            return;
        }

        navigate(backDelta);
    }, [history, location.pathname]);
};
