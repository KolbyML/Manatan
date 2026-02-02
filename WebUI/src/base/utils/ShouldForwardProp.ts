/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export const shouldForwardProp =
    <TCustomProps extends Record<string, unknown>>(customProps: TupleUnion<keyof TCustomProps>) =>
    (prop: string): boolean =>
        // @ts-ignore - TS2589: Type instantiation is excessively deep and possibly infinite.
        // this function should never be used without a strict type, thus, this error can be ignored
        !customProps.includes(prop);
