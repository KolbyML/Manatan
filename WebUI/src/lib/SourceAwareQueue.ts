/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Queue, type QueuePriority } from '@/lib/Queue';
import { Sources } from '@/features/source/services/Sources.ts';

export class SourceAwareQueue {
    private static readonly DEFAULT_ID = '__global__';

    private readonly queueBySource: Map<string, Queue>;

    constructor(
        private readonly areConnectionsLimited: boolean,
        private readonly concurrencyPerSource = 5,
    ) {
        this.queueBySource = new Map<string, Queue>([
            [SourceAwareQueue.DEFAULT_ID, new Queue(this.concurrencyPerSource)],
        ]);
    }

    private getConcurrencyFor(sourceId: string | null): number {
        const isLocalSource = sourceId === Sources.LOCAL_SOURCE_ID;

        if (isLocalSource) {
            return Number.MAX_SAFE_INTEGER;
        }

        return this.concurrencyPerSource;
    }

    private getQueueFor(sourceId: string | null): Queue {
        const finalSourceId = sourceId ?? SourceAwareQueue.DEFAULT_ID;
        const queueKey = this.areConnectionsLimited ? SourceAwareQueue.DEFAULT_ID : finalSourceId;

        if (!this.queueBySource.has(queueKey)) {
            this.queueBySource.set(queueKey, new Queue(this.getConcurrencyFor(finalSourceId)));
        }

        return this.queueBySource.get(queueKey)!;
    }

    enqueue<T>(sourceId: string | null, key: string, fn: () => PromiseLike<T> | T, priority?: QueuePriority) {
        const queue = this.getQueueFor(sourceId);

        return queue.enqueue(key, fn, priority);
    }

    isProcessing(sourceId: string | null, key: string): boolean {
        const queue = this.getQueueFor(sourceId);

        return queue.isProcessing(key);
    }

    clear(): void {
        for (const queue of this.queueBySource.values()) {
            queue.clear();
        }

        this.queueBySource.clear();
    }
}
