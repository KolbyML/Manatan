/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { BaseSyntheticEvent } from 'react';
import { chainEventHandlers } from 'material-ui-popup-state/chainEventHandlers';

export class MUIUtil {
    static preventRipple(): (e: BaseSyntheticEvent) => void {
        return (e) => e.stopPropagation();
    }

    static preventRippleProp<T extends Record<string, unknown>[]>(
        ...handlers: T
    ): T & Pick<React.DOMAttributes<unknown>, 'onMouseDown' | 'onTouchStart'> {
        return chainEventHandlers(handlers[0], ...handlers.slice(1), {
            onMouseDown: MUIUtil.preventRipple(),
            onTouchStart: MUIUtil.preventRipple(),
        }) as T & Pick<React.DOMAttributes<unknown>, 'onMouseDown' | 'onTouchStart'>;
    }
}
