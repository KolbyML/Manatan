/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Link } from 'react-router-dom';
import ListItemButton, { ListItemButtonProps } from '@mui/material/ListItemButton';

export function ListItemLink(props: ListItemButtonProps<typeof Link>) {
    return <ListItemButton component={Link} {...props} />;
}
