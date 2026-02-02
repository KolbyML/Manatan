/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

export const Kbd = styled(Typography)(({ theme }) => ({
    display: 'inline-block',
    padding: '0.2em 0.4em',
    fontSize: '0.85em',
    lineHeight: '1.4',
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: '3px',
    boxShadow: `inset 0 -1px 0 ${theme.palette.divider}`,
    fontFamily: 'monospace, monospace',
}));
