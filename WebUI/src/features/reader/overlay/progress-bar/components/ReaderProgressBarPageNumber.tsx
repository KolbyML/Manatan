/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

export const ReaderProgressBarPageNumber = styled(Typography)({
    boxSizing: 'content-box',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    textAlign: 'center',
    userSelect: 'none',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
});
