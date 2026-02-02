/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { styled } from '@mui/material/styles';
import { TypographyProps } from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { shouldForwardProp } from '@/base/utils/ShouldForwardProp.ts';

type StyledGroupHeaderProps = {
    isFirstItem: boolean;
};
export const StyledGroupHeader = styled(Stack, {
    shouldForwardProp: shouldForwardProp<StyledGroupHeaderProps>(['isFirstItem']),
})<StyledGroupHeaderProps & TypographyProps>(({ theme, isFirstItem }) => ({
    paddingLeft: theme.spacing(3),
    paddingTop: theme.spacing(0.75),
    paddingBottom: theme.spacing(2),
    fontWeight: 'bold',
    backgroundColor: theme.palette.background.default,
    [theme.breakpoints.down('sm')]: {
        paddingTop: isFirstItem ? theme.spacing(1) : theme.spacing(0.75),
    },
}));
