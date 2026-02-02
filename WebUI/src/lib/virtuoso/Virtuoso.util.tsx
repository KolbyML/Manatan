/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSessionStorage } from '@/base/hooks/useStorage.tsx';
import { AppStorage } from '@/lib/storage/AppStorage.ts';

export class VirtuosoUtil {
    static readonly GROUP = 0;

    static readonly ITEMS = 1;

    /**
     * Returns the index converted to the index of the list of group or normal items.
     *
     * @example
     *
     * index 1
     * groupCounts [1, 3, 1]
     *
     * (GCS) groups content size                2   3   1
     * (SOG) size of group (with header item)   3   7   9
     *
     * is group header item: SOG - index === GCS + 1
     * is normal item      : SOG - index  <  GCS + 1
     *
     * converted index:
     *   is group header
     *     ? group index
     *     : index - (group index + 1)
     *
     * group index 0
     * 3 - 0 = 3 (group - index: 0)
     * 3 - 1 = 2 (normal - index: 0 = 1 - (0 + 1))
     * 3 - 2 = 1 (normal - index: 1 = 2 - (0 + 1))
     *
     * group index 1
     * 7 - 3 = 4 (group - index: 1)
     * 7 - 4 = 3 (normal - index: 2 = 4 - (1 + 1))
     * 7 - 5 = 2 (normal - index: 3 = 5 - (1 + 1))
     * 7 - 6 = 1 (normal - index: 4 = 6 - (1 + 1))
     *
     * group index 2
     * 9 - 7 = 2 (group - index: 2)
     * 9 - 8 = 1 (normal - index: 5 = 8 - (2 + 1))
     */
    static convertIndex(
        index: number,
        groupCounts: number[],
        sizeOfGroups: number[],
    ): { type: 'normal' | 'group'; index: number; groupIndex: number } {
        for (let groupIndex = 0; groupIndex < groupCounts.length; groupIndex++) {
            const groupCount = groupCounts[groupIndex];
            const sizeOfGroup = sizeOfGroups[groupIndex];

            const isIndexOfGroup = index <= sizeOfGroup - 1;
            if (isIndexOfGroup) {
                const isGroupHeaderItem = sizeOfGroup - index === groupCount + 1;

                return {
                    type: isGroupHeaderItem ? 'group' : 'normal',
                    index: isGroupHeaderItem ? groupIndex : index - (groupIndex + 1),
                    groupIndex,
                };
            }
        }

        throw new Error(`Unexpected "${index}" (${index}) and "groupCounts" (${groupCounts})`);
    }

    static useCreateConvertIndex(
        groupCounts: number[],
    ): (index: number) => ReturnType<typeof VirtuosoUtil.convertIndex> {
        const sizeOfGroups = useMemo(() => {
            const tmpSizeOfGroups: number[] = [];
            for (let i = 0; i < groupCounts.length; i++) {
                const maxIndexOfPreviousGroup = tmpSizeOfGroups[i - 1] ?? 0;
                tmpSizeOfGroups[i] = groupCounts[i] + 1 + maxIndexOfPreviousGroup;
            }

            return tmpSizeOfGroups;
        }, [groupCounts]);

        return useCallback((index: number) => this.convertIndex(index, groupCounts, sizeOfGroups), [sizeOfGroups]);
    }

    static useCreateGroupedComputeItemKey(
        groupCounts: number[],
        getGroupKey: (index: number, groupIndex: number) => React.Key,
        getNormalKey: (index: number, groupIndex: number) => React.Key,
    ): (index: number) => React.Key {
        const convertIndex = this.useCreateConvertIndex(groupCounts);

        return useCallback(
            (index) => {
                const { type, index: convertedIndex, groupIndex } = convertIndex(index);

                switch (type) {
                    case 'group':
                        return getGroupKey(convertedIndex, groupIndex);
                    case 'normal':
                        return getNormalKey(convertedIndex, groupIndex);
                    default:
                        throw new Error(
                            `VirtuosoUtil::useCreateGroupedComputeItemKey: unexpected "converted index type" (${type})`,
                        );
                }
            },
            [convertIndex, getGroupKey, getNormalKey],
        );
    }

    static usePersistState<Snapshot>(key: string): {
        key: string;
        state: Snapshot | undefined;
        persistState: (state: Snapshot) => void;
        deleteState: () => void;
    } {
        const location = useLocation<{ snapshot?: Snapshot }>();

        const snapshotSessionKey = `virtuoso-snapshot-${key}-${location.key}`;
        const [snapshot] = useSessionStorage<Snapshot | undefined>(snapshotSessionKey, undefined);

        const persistGridStateTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
        const persistState = useCallback(
            (state: Snapshot) => {
                const currentUrl = window.location.href;

                clearTimeout(persistGridStateTimeout.current);
                persistGridStateTimeout.current = setTimeout(() => {
                    const didLocationChange = currentUrl !== window.location.href;
                    if (didLocationChange) {
                        return;
                    }

                    AppStorage.session.setItem(snapshotSessionKey, state, false);
                }, 250);
            },
            [snapshotSessionKey],
        );
        const deleteState = useCallback(() => {
            AppStorage.session.setItem(snapshotSessionKey, undefined, false);
        }, [snapshotSessionKey]);

        useEffect(() => clearTimeout(persistGridStateTimeout.current), [location.key, persistGridStateTimeout.current]);

        return {
            key: snapshotSessionKey,
            state: snapshot,
            persistState,
            deleteState,
        };
    }
}
