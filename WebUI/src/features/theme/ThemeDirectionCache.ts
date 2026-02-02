/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Direction } from '@mui/material/styles';
import { EmotionCache } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

export const DIRECTION_TO_CACHE: Record<Direction, EmotionCache> = {
    ltr: createCache({
        key: 'muiltr',
    }),
    rtl: createCache({
        key: 'muirtl',
        stylisPlugins: [prefixer, rtlPlugin],
    }),
};
