/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export class ControlledPromise<T = void> {
    private orgResolve!: (value: T | PromiseLike<T>) => void;

    private orgReject!: (reason?: any) => void;

    public readonly promise: Promise<T>;

    constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this.orgResolve = resolve;
            this.orgReject = reject;
        });
    }

    resolve(value: T): void {
        this.orgResolve(value);
    }

    reject(reason?: any): void {
        this.orgReject(reason);
    }
}
