/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import SearchIcon from '@mui/icons-material/Search';
import FormControl from '@mui/material/FormControl';
import Input from '@mui/material/Input';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import React, { useEffect } from 'react';
import { useDebounce } from '@/base/hooks/useDebounce.ts';

interface Props {
    state: string;
    name: string;
    position: number;
    group: number | undefined;
    updateFilterValue: Function;
    update: any;
}

export const TextFilter: React.FC<Props> = (props) => {
    const { state, name, position, group, updateFilterValue, update } = props;
    const [Search, setsearch] = React.useState(state || '');
    const inputText = useDebounce(Search, 500);

    useEffect(() => {
        const upd = update.filter(
            (el: { position: number; group: number | undefined }) => !(position === el.position && group === el.group),
        );
        updateFilterValue([...upd, { type: 'textState', position, state: inputText, group }]);
    }, [inputText]);

    if (state !== undefined) {
        return (
            <FormControl sx={{ my: 1 }} variant="standard">
                <InputLabel>{name}</InputLabel>
                <Input
                    name={name}
                    value={Search}
                    onChange={({ target: { value } }) => setsearch(value)}
                    endAdornment={
                        <InputAdornment position="end">
                            <SearchIcon />
                        </InputAdornment>
                    }
                />
            </FormControl>
        );
    }
    return null;
};
