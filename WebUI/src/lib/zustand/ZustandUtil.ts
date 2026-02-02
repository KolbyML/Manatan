/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export class ZustandUtil {
    static createActionName(...names: string[]) {
        const storeAndSlices = names.slice(0, -1);
        const action = names.slice(-1)[0];

        return `${storeAndSlices.join(':')}/${action}`;
    }

    static createActionNameCreator(
        name: string,
        parentCreator: typeof ZustandUtil.createActionName = ZustandUtil.createActionName,
    ): typeof ZustandUtil.createActionName {
        return (...names: string[]) => parentCreator(name, ...names);
    }
}
