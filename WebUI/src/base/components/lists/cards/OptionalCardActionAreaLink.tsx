/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Link } from 'react-router-dom';
import CardActionArea from '@mui/material/CardActionArea';
import { ComponentProps } from 'react';

export const OptionalCardActionAreaLink = ({
    disabled,
    children,
    ...props
}: ComponentProps<typeof CardActionArea> & ComponentProps<typeof Link> & { disabled?: boolean }) => {
    if (disabled) {
        return children;
    }

    return (
        <CardActionArea component={Link} {...props}>
            {children}
        </CardActionArea>
    );
};
