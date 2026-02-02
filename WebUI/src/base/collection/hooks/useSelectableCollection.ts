/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useRef, useState } from 'react';

export type SelectableCollectionReturnType<Id extends number | string, Key extends string = string> = {
    selectedItemIds: Id[];
    keySelectedItemIds: Id[];
    areAllItemsSelected: boolean;
    areNoItemsSelected: boolean;
    areAllItemsForKeySelected: boolean;
    areNoItemsForKeySelected: boolean;
    handleSelection: (id: Id, selected: boolean, options?: { selectRange?: boolean; key?: Key }) => void;
    handleSelectAll: (selectAll: boolean, ids: Id[], key?: Key) => void;
    setSelectionForKey: (key: Key, ids: Id[]) => void;
    getSelectionForKey: (key: Key) => Id[];
    clearSelection: () => void;
    reset: () => void;
};

export const useSelectableCollection = <Id extends number | string, Key extends string = 'default'>(
    totalCount: number,
    {
        itemIds = [],
        keyCount = totalCount,
        currentKey,
        initialState = {} as Record<Key, Id[]>,
    }: {
        itemIds?: Id[];
        keyCount?: number;
        currentKey: Key;
        initialState?: Record<Key, Id[]>;
    },
): SelectableCollectionReturnType<Id, Key> => {
    const [keyToSelectedItemIds, setKeyToSelectedItemIds] = useState<Record<string, Id[]>>(initialState);

    const lastSelectedItemInfoRef = useRef<{ id: Id; key: Key }>(undefined);

    const selectedItemIds = [...new Set(Object.values(keyToSelectedItemIds).flat())];
    const areAllItemsSelected = selectedItemIds.length === totalCount;
    const areNoItemsSelected = !selectedItemIds.length;

    const keySelectedItemIds = keyToSelectedItemIds[currentKey] ?? [];
    const areAllItemsForKeySelected = keySelectedItemIds.length === keyCount;
    const areNoItemsForKeySelected = keySelectedItemIds.length === 0;

    if (areNoItemsForKeySelected) {
        lastSelectedItemInfoRef.current = undefined;
    }

    const handleSelection: SelectableCollectionReturnType<Id, Key>['handleSelection'] = useCallback(
        (id, selected, { selectRange = false, key = currentKey } = {}) => {
            const deselect = !selected;

            const { id: lastSelectedItemId, key: lastSelectedItemIdKey } = lastSelectedItemInfoRef.current ?? {};
            lastSelectedItemInfoRef.current = { id, key };

            const isSelectRange = selectRange && key === lastSelectedItemIdKey && lastSelectedItemId !== undefined;

            const indexOfLastSelectedItemId = isSelectRange ? itemIds.indexOf(lastSelectedItemId) : -1;
            const indexOfSelectedId = isSelectRange ? itemIds.indexOf(id) : -1;

            const selectedIds = isSelectRange
                ? itemIds.slice(
                      Math.min(indexOfLastSelectedItemId, indexOfSelectedId),
                      Math.max(indexOfLastSelectedItemId, indexOfSelectedId) + 1,
                  )
                : [id];

            if (deselect) {
                setKeyToSelectedItemIds((prevState) => ({
                    ...prevState,
                    [key]: prevState[key]?.filter((selectedItemId) => !selectedIds.includes(selectedItemId)) ?? [],
                }));
                return;
            }

            setKeyToSelectedItemIds((prevState) => ({
                ...prevState,
                [key]: [...new Set([...(prevState[key] ?? []), ...selectedIds])],
            }));
        },
        [currentKey, itemIds],
    );

    const handleSelectAll = useCallback(
        (selectAll: boolean, ids: Id[], key: Key = currentKey) => {
            switch (selectAll) {
                case true:
                    setKeyToSelectedItemIds((prevState) => ({
                        ...prevState,
                        [key]: [...ids],
                    }));
                    break;
                case false:
                    setKeyToSelectedItemIds((prevState) => ({
                        ...prevState,
                        [key]: [],
                    }));
                    break;
                default:
                    break;
            }
        },
        [currentKey],
    );

    const setSelectionForKey = useCallback((key: Key, ids: Id[]) => {
        setKeyToSelectedItemIds((prevState) => ({
            ...prevState,
            [key]: [...ids],
        }));
    }, []);

    const getSelectionForKey = useCallback((key: Key) => keyToSelectedItemIds[key], [keyToSelectedItemIds]);

    const clearSelection = useCallback(() => {
        setKeyToSelectedItemIds({});
    }, []);

    const reset = useCallback(() => {
        clearSelection();
        setKeyToSelectedItemIds(initialState);
    }, [clearSelection, initialState]);

    return {
        selectedItemIds,
        keySelectedItemIds,
        handleSelection,
        handleSelectAll,
        areAllItemsSelected,
        areNoItemsSelected,
        areAllItemsForKeySelected,
        areNoItemsForKeySelected,
        setSelectionForKey,
        getSelectionForKey,
        clearSelection,
        reset,
    };
};
