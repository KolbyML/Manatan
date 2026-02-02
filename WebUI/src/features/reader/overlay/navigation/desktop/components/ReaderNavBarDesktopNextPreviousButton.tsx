/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ComponentProps } from 'react';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { CustomButtonIcon } from '@/base/components/buttons/CustomButtonIcon.tsx';

export const ReaderNavBarDesktopNextPreviousButton = ({
    title,
    type,
    disabled,
    ...customIconButtonProps
}: Omit<ComponentProps<typeof CustomButtonIcon>, 'children'> & {
    title: string;
    type: 'previous' | 'next';
}) => (
    <CustomTooltip title={title} disabled={disabled}>
        <CustomButtonIcon sx={{ flexBasis: '15%' }} variant="contained" disabled={disabled} {...customIconButtonProps}>
            {type === 'previous' ? <KeyboardArrowLeftIcon /> : <KeyboardArrowRightIcon />}
        </CustomButtonIcon>
    </CustomTooltip>
);
