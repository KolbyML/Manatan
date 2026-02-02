/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box, { BoxProps } from '@mui/material/Box';
import React from 'react';

interface IProps extends BoxProps {
    children: React.ReactNode;
    index: any;
    currentIndex: any;
}

export function TabPanel(props: IProps) {
    const { children, index, currentIndex, ...boxProps } = props;

    return (
        <Box {...boxProps} role="tabpanel" hidden={index !== currentIndex} id={`simple-tabpanel-${index}`}>
            {currentIndex === index && children}
        </Box>
    );
}
