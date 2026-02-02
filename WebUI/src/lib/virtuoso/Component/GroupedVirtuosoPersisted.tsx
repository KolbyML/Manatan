/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ComponentProps, useRef } from 'react';
import { GroupedVirtuoso, GroupedVirtuosoHandle, StateSnapshot } from 'react-virtuoso';
import { useMergedRef } from '@mantine/hooks';
import { VirtuosoUtil } from '@/lib/virtuoso/Virtuoso.util.tsx';

export const GroupedVirtuosoPersisted = ({
    ref: passedRef,
    persistKey,
    ...props
}: ComponentProps<typeof GroupedVirtuoso> & { persistKey: string }) => {
    const { state, persistState } = VirtuosoUtil.usePersistState<StateSnapshot>(persistKey);

    const localRef = useRef<GroupedVirtuosoHandle>(undefined);
    const ref = useMergedRef(localRef, passedRef);

    return (
        <GroupedVirtuoso
            {...props}
            ref={ref}
            isScrolling={(isScrolling) => {
                if (!isScrolling) {
                    localRef.current?.getState(persistState);
                }

                props.isScrolling?.(isScrolling);
            }}
            restoreStateFrom={state}
        />
    );
};
