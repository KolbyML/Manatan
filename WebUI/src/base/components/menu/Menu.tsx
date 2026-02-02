/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import MuiMenu, { MenuProps } from '@mui/material/Menu';
import { useState, type JSX } from 'react';

export const Menu = ({
    children,
    onClose,
    ...props
}: Omit<MenuProps, 'children' | 'onClose'> &
    Required<Pick<MenuProps, 'onClose'>> & {
        children: (onClose: () => void, setHideMenu: (hide: boolean) => void) => JSX.Element | JSX.Element[];
    }) => {
    const [shouldHideMenu, setShouldHideMenu] = useState(false);

    return (
        <MuiMenu
            {...props}
            open={props.open}
            onClose={onClose}
            sx={{ visibility: !props.open || shouldHideMenu ? 'hidden' : 'visible' }}
        >
            {children(() => {
                onClose({}, 'backdropClick');
                setShouldHideMenu(false);
            }, setShouldHideMenu)}
        </MuiMenu>
    );
};
