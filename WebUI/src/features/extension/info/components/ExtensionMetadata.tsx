/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ComponentProps } from 'react';
import Divider from '@mui/material/Divider';
import { Metadata } from '@/base/components/texts/Metadata.tsx';

export const ExtensionMetadata = ({
    addDivider = true,
    ...props
}: ComponentProps<typeof Metadata> & { addDivider?: boolean }) => (
    <>
        <Metadata
            {...props}
            stackProps={{
                // eslint-disable-next-line react/destructuring-assignment
                ...props.stackProps,
                sx: {
                    // eslint-disable-next-line react/destructuring-assignment
                    ...props.stackProps?.sx,
                    flexDirection: 'column-reverse',
                    alignItems: 'center',
                    flexGrow: 1,
                    flexBasis: 0,
                },
            }}
            titleProps={{
                // eslint-disable-next-line react/destructuring-assignment
                ...props.titleProps,
                variant: 'body2',
            }}
        />
        {addDivider && <Divider orientation="vertical" sx={{ height: '25px' }} />}
    </>
);
