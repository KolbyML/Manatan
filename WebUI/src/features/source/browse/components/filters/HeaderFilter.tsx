/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Typography from '@mui/material/Typography';
import React from 'react';

interface Props {
    name: string;
}

export const HeaderFilter: React.FC<Props> = ({ name }) => (
    <Typography key={name} sx={{ mt: 2 }} variant="subtitle2">
        {name}
    </Typography>
);
