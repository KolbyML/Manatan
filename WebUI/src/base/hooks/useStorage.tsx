/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Dispatch, Reducer, SetStateAction, useCallback, useMemo, useReducer, useSyncExternalStore } from 'react';
import { AppStorage, Storage } from '@/lib/storage/AppStorage.ts';
import { jsonSaveParse } from '@/lib/HelperFunctions.ts';

const subscribeToStorageUpdates = (callback: () => void) => {
    window.addEventListener('storage', callback);
    return () => window.removeEventListener('storage', callback);
};

function useStorage<T>(storage: Storage, key: string, defaultValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
function useStorage<T = undefined>(
    storage: Storage,
    key: string,
): [T | undefined, Dispatch<SetStateAction<T | undefined>>];

function useStorage<T>(
    storage: Storage,
    key: string,
    defaultValue?: T | (() => T) | undefined,
): [T | undefined, Dispatch<SetStateAction<T | undefined>>] {
    const initialState = defaultValue instanceof Function ? defaultValue() : defaultValue;
    const storedValueRaw = useSyncExternalStore(subscribeToStorageUpdates, () => storage.getItem(key));

    const setValue = useCallback<React.Dispatch<React.SetStateAction<T | undefined>>>(
        (value) => {
            // Allow value to be a function so we have same API as useState
            const valueToStore = (() => {
                if (value instanceof Function) {
                    const previousValue = storage.getItemParsed(key, initialState);

                    return value(previousValue);
                }

                return value;
            })();

            storage.setItem(key, valueToStore);
        },
        [key],
    );

    const storedValue = useMemo(() => {
        if (storedValueRaw === null) {
            return initialState;
        }

        const parsedValue = jsonSaveParse(storedValueRaw);

        if (storedValueRaw === 'null' || storedValueRaw === 'undefined') {
            return parsedValue;
        }

        return parsedValue ?? storedValueRaw;
    }, [storedValueRaw, key]);

    return [storedValue, setValue];
}

const useReducerStorage = <S, A>(
    storage: Storage,
    reducer: Reducer<S, A>,
    key: string,
    defaultState: S | (() => S),
) => {
    const [storedValue, setValue] = useStorage(storage, key, defaultState);
    return useReducer((state: S, action: A): S => {
        const newState = reducer(state, action);
        setValue(newState);
        return newState;
    }, storedValue);
};

export function useLocalStorage<T>(key: string, defaultValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
export function useLocalStorage<T = undefined>(key: string): [T | undefined, Dispatch<SetStateAction<T | undefined>>];

export function useLocalStorage<T>(
    key: string,
    defaultValue?: T | undefined | (() => T | undefined),
): [T | undefined, Dispatch<SetStateAction<T | undefined>>] {
    return useStorage(AppStorage.local, key, defaultValue);
}

export function useReducerLocalStorage<S, A>(reducer: Reducer<S, A>, key: string, defaultState: S | (() => S)) {
    return useReducerStorage(AppStorage.local, reducer, key, defaultState);
}

export function useSessionStorage<T>(key: string, defaultValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
export function useSessionStorage<T = undefined>(key: string): [T | undefined, Dispatch<SetStateAction<T | undefined>>];

export function useSessionStorage<T>(
    key: string,
    defaultValue?: T | (() => T),
): [T | undefined, Dispatch<SetStateAction<T | undefined>>] {
    return useStorage(AppStorage.session, key, defaultValue);
}

export function useReducerSessionStorage<S, A>(reducer: Reducer<S, A>, key: string, defaultState: S | (() => S)) {
    return useReducerStorage(AppStorage.session, reducer, key, defaultState);
}
