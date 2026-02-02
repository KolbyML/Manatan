/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box, { BoxProps } from '@mui/material/Box';

export const TabsWrapper = ({ children, ...props }: BoxProps) => (
    <Box {...props} sx={{ ...props.sx, position: 'relative', height: `100%` }}>
        {children}
    </Box>
);
