/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Divider from '@mui/material/Divider';
import React from 'react';

interface Props {
    name: string;
}

export const SeparatorFilter: React.FC<Props> = ({ name }) => (
    <Divider key={name} sx={{ my: 1 }} textAlign="center">
        {name}
    </Divider>
);
