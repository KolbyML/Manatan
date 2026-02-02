/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import React from 'react';

interface IProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    minHeight?: number;
}

export const OptionsPanel: React.FC<IProps> = ({ open, onClose, children, minHeight }) => (
    <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
            style: {
                maxWidth: 600,
                marginLeft: 'auto',
                marginRight: 'auto',
                minHeight,
            },
        }}
    >
        <Box>{children}</Box>
    </Drawer>
);
