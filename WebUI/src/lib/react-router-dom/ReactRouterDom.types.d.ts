/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Location } from 'react-router-dom';

type GenericLocation<State = any> = Omit<Location, 'state'> & { state?: State };

declare module 'react-router-dom' {
    export function useParams<Params extends { [K in keyof Params]: string } = {}>(): Params;

    export function useLocation<State = any>(): GenericLocation<State>;
}
