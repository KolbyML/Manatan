/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MuiMenuItem, { MenuItemProps } from '@mui/material/MenuItem';
import { OverridableComponent } from '@mui/material/OverridableComponent';
import { SvgIconTypeMap } from '@mui/material/SvgIcon';

interface IProps extends MenuItemProps {
    title: string;
    Icon: OverridableComponent<SvgIconTypeMap> & { muiName: string };
}

export const MenuItem = ({ title, Icon, ...menuItemProps }: IProps) => (
    <MuiMenuItem {...menuItemProps}>
        <ListItemIcon>
            <Icon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{title}</ListItemText>
    </MuiMenuItem>
);
