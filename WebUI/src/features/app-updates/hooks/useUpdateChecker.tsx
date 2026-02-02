/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { d } from 'koration';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';

const UPDATE_CHECK_INTERVAL = d(1).hours.inWholeMilliseconds;
const UPDATE_REMINDER_THRESHOLD = d(1).hours.inWholeMilliseconds;

export const useUpdateChecker = (
    storageKey: string,
    checkForUpdate: () => Promise<unknown>,
    version?: string,
    interval: number = UPDATE_CHECK_INTERVAL,
): { handleUpdate: boolean; ignoreUpdate: () => void; remindLater: () => void } => {
    const [lastUpdateCheck, setLastUpdateCheck] = useLocalStorage(`UpdateChecker::${storageKey}::lastUpdateCheck`, 0);
    const [ignoreVersionUpdate, setIgnoreVersionUpdate] = useLocalStorage<string>(
        `UpdateChecker::${storageKey}::ignoreUpdate`,
    );
    const [updateClosedTimestamp, setUpdateClosedTimestamp] = useLocalStorage(
        `UpdateChecker::${storageKey}::closeTimestamp`,
        0,
    );

    useEffect(() => {
        const remainingTimeTillNextUpdateCheck = (interval - (Date.now() - lastUpdateCheck)) % interval;

        let timeout: NodeJS.Timeout | undefined;
        const scheduleUpdateCheck = (timeoutMS: number) => {
            timeout = setTimeout(() => {
                checkForUpdate().catch(defaultPromiseErrorHandler(`UpdateChecker(${storageKey})::checkForUpdate`));
                setLastUpdateCheck(Date.now());
                scheduleUpdateCheck(interval);
            }, timeoutMS);
        };

        scheduleUpdateCheck(remainingTimeTillNextUpdateCheck);

        return () => clearTimeout(timeout);
    }, [storageKey, checkForUpdate, interval]);

    const ignoreUpdate = useCallback(() => {
        setIgnoreVersionUpdate(version);
    }, [storageKey, version]);

    const remindLater = useCallback(() => {
        setUpdateClosedTimestamp(Date.now());
    }, [storageKey]);

    const wasRecentlyClosed = Date.now() - updateClosedTimestamp < UPDATE_REMINDER_THRESHOLD;
    const wasUpdateIgnored = !!ignoreVersionUpdate && ignoreVersionUpdate === version;
    const handleUpdate = !wasRecentlyClosed && !wasUpdateIgnored;

    return useMemo(() => ({ handleUpdate, ignoreUpdate, remindLater }), [handleUpdate, ignoreUpdate, remindLater]);
};
