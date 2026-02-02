/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';

interface Props {
    values: any;
    name: string;
    state: number;
    position: number;
    updateFilterValue: Function;
    group: number | undefined;
    update: any;
}

function noSelect(
    values: string[],
    name: string,
    state: number,
    position: number,
    updateFilterValue: Function,
    update: any,
    group?: number,
) {
    const [val, setval] = React.useState(state);

    if (values) {
        const handleChange = (event: { target: { name: any; value: any } }) => {
            const vall = values.indexOf(`${event.target.value}`);
            setval(vall);
            const upd = update.filter(
                (e: { position: number; group: number | undefined }) => !(position === e.position && group === e.group),
            );
            updateFilterValue([...upd, { type: 'selectState', position, state: vall, group }]);
        };

        const rett = values.map((value: string) => (
            <MenuItem key={`${name} ${value}`} value={value}>
                {value}
            </MenuItem>
        ));
        return (
            <FormControl sx={{ my: 1 }} variant="standard">
                <InputLabel>{name}</InputLabel>
                <Select name={name} value={values[val]} label={name} onChange={handleChange}>
                    {rett}
                </Select>
            </FormControl>
        );
    }
    return null;
}

export const SelectFilter: React.FC<Props> = ({ values, name, state, position, updateFilterValue, update, group }) =>
    noSelect(values, name, state, position, updateFilterValue, update, group);
