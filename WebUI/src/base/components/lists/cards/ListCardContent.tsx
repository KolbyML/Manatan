/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import CardContent, { CardContentProps } from '@mui/material/CardContent';

export const ListCardContent = ({ children, ...props }: CardContentProps) => (
    <CardContent
        {...props}
        sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1,
            '&:last-child': {
                paddingBottom: 1,
            },
            ...props.sx,
        }}
    >
        {children}
    </CardContent>
);
