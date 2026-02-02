/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react';
import { ThreeStateCheckboxInput } from '@/base/components/inputs/ThreeStateCheckboxInput.tsx';
import { TriState } from '@/lib/graphql/generated/graphql.ts';

interface Props {
    state: TriState;
    name: string;
    position: number;
    group: number | undefined;
    updateFilterValue: Function;
    update: any;
}

const convertTriStateToNumber = (triState: TriState): number => {
    switch (triState) {
        case TriState.Ignore:
            return 0;
        case TriState.Include:
            return 1;
        case TriState.Exclude:
            return 2;
        default:
            throw new Error(`Unexpected TriState ${triState}`);
    }
};

const convertNumberToTriState = (state: number): TriState => {
    switch (state) {
        case 0:
            return TriState.Ignore;
        case 1:
            return TriState.Include;
        case 2:
            return TriState.Exclude;
        default:
            throw new Error(`Unexpected state number ${state}`);
    }
};

export const TriStateFilter: React.FC<Props> = (props) => {
    const { state, name, position, group, updateFilterValue, update } = props;
    const [val, setval] = React.useState(convertTriStateToNumber(state));

    const handleChange = (checked: boolean | null | undefined) => {
        // eslint-disable-next-line no-nested-ternary
        const newState = checked === undefined ? 0 : checked ? 1 : 2;
        setval(newState);
        const upd = update.filter(
            (e: { position: number; group: number | undefined }) => !(position === e.position && group === e.group),
        );
        updateFilterValue([
            ...upd,
            {
                type: 'triState',
                position,
                state: convertNumberToTriState(newState),
                group,
            },
        ]);
    };

    if (state !== undefined) {
        return (
            <ThreeStateCheckboxInput
                label={name}
                checked={[undefined, true, false][val]}
                onChange={(checked) => handleChange(checked)}
            />
        );
    }
    return null;
};
