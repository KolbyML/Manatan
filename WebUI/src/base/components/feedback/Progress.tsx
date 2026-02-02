/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import CircularProgress, { CircularProgressProps } from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

export const Progress = ({
    progress,
    showText = true,
    progressProps = {},
}: {
    progress: number;
    showText?: boolean;
    progressProps?: CircularProgressProps;
}) => (
    <Box sx={{ display: 'grid', placeItems: 'center', position: 'relative' }}>
        <CircularProgress {...progressProps} variant="determinate" value={progress} />
        {showText && (
            <Box sx={{ position: 'absolute' }}>
                <Typography
                    sx={{
                        fontSize: '0.8rem',
                    }}
                >{`${Math.round(progress)}%`}</Typography>
            </Box>
        )}
    </Box>
);
