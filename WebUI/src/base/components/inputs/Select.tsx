/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import MuiSelect from '@mui/material/Select';

export const Select = <Value,>({
    children,
    maxSelectionHeightPx = 250,
    ...props
}: React.ComponentProps<typeof MuiSelect<Value>> & { maxSelectionHeightPx?: number }) => (
    <MuiSelect<Value> MenuProps={{ PaperProps: { style: { maxHeight: maxSelectionHeightPx } } }} {...props}>
        {children}
    </MuiSelect>
);
