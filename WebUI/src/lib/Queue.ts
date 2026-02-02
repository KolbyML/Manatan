/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import pLimit, { LimitFunction } from 'p-limit';
import { ControlledPromise } from '@/lib/ControlledPromise.ts';

export enum Priority {
    LOW = 0,
    NORMAL = 1,
    HIGH = 2,
}
export type QueuePriority = Priority | number;

type Key = string;
type QueueItemFunction<T = any> = () => PromiseLike<T> | T;

export class Queue {
    private readonly queue: LimitFunction;

    private counter: number = 0;

    private pendingKeyToPriorityMap = new Map<Key, QueuePriority>();

    private pendingKeyToFnMap = new Map<Key, QueueItemFunction>();

    private pendingKeyToPromiseMap = new Map<Key, ControlledPromise<any>>();

    constructor(concurrency: number) {
        this.queue = pLimit(concurrency);
    }

    clear(): void {
        this.pendingKeyToPromiseMap.forEach((promise) => {
            promise.reject(new Error('Queue::clear: called'));
        });

        this.pendingKeyToPriorityMap.clear();
        this.pendingKeyToFnMap.clear();
        this.pendingKeyToPromiseMap.clear();
    }

    enqueue<T>(
        key: Key,
        fn: () => PromiseLike<T> | T,
        priority: QueuePriority = Priority.NORMAL,
    ): { key: string; promise: Promise<T> } {
        this.counter = (this.counter + 1) % Number.MAX_SAFE_INTEGER;
        const actualKey = `${key}_${this.counter}`;

        this.pendingKeyToPriorityMap.set(actualKey, priority);
        this.pendingKeyToFnMap.set(actualKey, fn);

        const processPromise = new ControlledPromise<T>();
        this.pendingKeyToPromiseMap.set(actualKey, processPromise);

        this.queue(() => this.process());

        return { key: actualKey, promise: processPromise.promise };
    }

    isProcessing(key: string): boolean {
        return !this.pendingKeyToFnMap.has(key);
    }

    private async process(): Promise<void> {
        const { fn, promise } = this.getNextItemToProcess();
        try {
            const result = await fn();
            promise.resolve(result);
        } catch (e) {
            promise.reject(e);
        }
    }

    private getNextItemToProcess<T>(): { key: Key; fn: QueueItemFunction<T>; promise: ControlledPromise<T> } {
        const [key] = [...this.pendingKeyToPriorityMap.entries()].toSorted(
            ([, priorityA], [, priorityB]) => priorityB - priorityA,
        )[0];
        const fn = this.pendingKeyToFnMap.get(key) as () => PromiseLike<T> | T;
        const promise = this.pendingKeyToPromiseMap.get(key) as ControlledPromise<T>;

        this.pendingKeyToPriorityMap.delete(key);
        this.pendingKeyToFnMap.delete(key);
        this.pendingKeyToPromiseMap.delete(key);

        return { key, fn, promise };
    }
}
