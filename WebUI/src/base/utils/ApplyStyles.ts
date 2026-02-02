/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Theme } from '@mui/material/styles';

// use CSSObject instead of SxProps<Theme> because this completely fucks over typescript by causing an out of memory error during compilation
type CSSObject = ReturnType<Theme['applyStyles']>;

const emptyStyle = {};
export const applyStyles = (isActive: boolean, styling: CSSObject): CSSObject => (isActive ? styling : emptyStyle);
