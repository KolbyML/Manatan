/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Collapse from '@mui/material/Collapse';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import React from 'react';
import { SortRadioInput } from '@/base/components/inputs/SortRadioInput.tsx';
import { SortSelectionInput } from '@/lib/graphql/generated/graphql.ts';

interface Props {
    values: any;
    name: string;
    state: SortSelectionInput;
    position: number;
    group: number | undefined;
    updateFilterValue: Function;
    update: any;
}

export const SortFilter: React.FC<Props> = (props: Props) => {
    const { values, name, state, position, group, updateFilterValue, update } = props;
    const [val, setval] = React.useState(state);

    const [open, setOpen] = React.useState(false);

    const handleClick = () => {
        setOpen(!open);
    };

    if (values) {
        const handleChange = (index: number) => {
            const tmp = val;
            if (tmp.index === index) {
                tmp.ascending = !tmp.ascending;
            } else {
                tmp.ascending = true;
            }
            tmp.index = index;
            setval(tmp);
            const upd = update.filter(
                (e: { position: number; group: number | undefined }) => !(position === e.position && group === e.group),
            );
            updateFilterValue([...upd, { type: 'sortState', position, state: tmp, group }]);
        };

        return (
            <Box sx={{ mx: -2 }}>
                <ListItemButton onClick={handleClick}>
                    <ListItemText primary={name} />
                    {open ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse in={open}>
                    <Stack sx={{ mx: 4 }}>
                        {values.map((value: string, index: number) => (
                            <SortRadioInput
                                key={`${name} ${value}`}
                                label={value}
                                checked={val.index === index}
                                sortDescending={!val.ascending}
                                onClick={() => handleChange(index)}
                            />
                        ))}
                    </Stack>
                </Collapse>
            </Box>
        );
    }
    return null;
};
