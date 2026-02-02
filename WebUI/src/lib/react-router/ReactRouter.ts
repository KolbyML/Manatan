/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { NavigateFunction, NavigateOptions, To } from 'react-router-dom';
import { noOp } from '@/lib/HelperFunctions.ts';

export class ReactRouter {
    private static navigateFn: NavigateFunction = noOp;

    static setNavigateFn(navigate: NavigateFunction) {
        this.navigateFn = navigate;
    }

    static navigate(delta: number): void;
    static navigate(to: To, options?: NavigateOptions): void;
    static navigate(toOrDelta: number | To, options?: NavigateOptions): void {
        if (typeof toOrDelta === 'number') {
            this.navigateFn(toOrDelta);
            return;
        }

        this.navigateFn(toOrDelta, options);
    }
}
