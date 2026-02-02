/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useLocalStorage } from '@/base/hooks/useStorage.tsx';

export const getPersistedServerSetting = <T,>(serverValue: T | undefined, lastValue: T): T => {
    const isDisabled = serverValue === 0;
    if (isDisabled) {
        return lastValue;
    }

    return serverValue ?? lastValue;
};

export const usePersistedValue = <T,>(
    key: string,
    defaultValue: T,
    currentValue: T | undefined,
    getCurrentValue: (currentValue: T | undefined, persistedValue: T) => T,
): [T, (value: T) => void] => {
    const [persistedValue, setPersistedValue] = useLocalStorage(key, defaultValue);

    const value = getCurrentValue(currentValue, persistedValue);

    return [value, setPersistedValue];
};
