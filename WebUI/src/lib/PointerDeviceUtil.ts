/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { d } from 'koration';
import { coerceIn } from '@/lib/HelperFunctions.ts';

type Direction = 'X' | 'Y';

interface DeltaData {
    simultaneousDeltaOccurrences: number[];
    deltas: Record<Direction, { timestamp: number; delta: number }[]>;
}

class PointerDeviceUtilClass {
    private readonly TRACK_PAD_DELTA_THRESHOLD = 30;

    private readonly MAX_RECORDS = 150;

    private data: DeltaData = {
        simultaneousDeltaOccurrences: [],
        deltas: {
            X: [],
            Y: [],
        },
    };

    private detectedTrackPadLike: boolean | undefined = undefined;

    constructor() {
        window.addEventListener('wheel', this.record.bind(this), { passive: true });

        setInterval(() => {
            this.determineIsTrackPadLike();
        }, d(5).seconds.inWholeMilliseconds);
    }

    private record(event: WheelEvent): void {
        const now = Date.now();

        const isSimultaneous = event.deltaX !== 0 && event.deltaY !== 0;
        if (isSimultaneous) {
            this.data.simultaneousDeltaOccurrences.push(now);
        }

        this.data.deltas.X.push({ timestamp: now, delta: Math.abs(event.deltaX) });
        this.data.deltas.Y.push({ timestamp: now, delta: Math.abs(event.deltaY) });

        this.data.simultaneousDeltaOccurrences = this.cleanupSeries(this.data.simultaneousDeltaOccurrences);
        this.data.deltas.X = this.cleanupSeries(this.data.deltas.X);
        this.data.deltas.Y = this.cleanupSeries(this.data.deltas.Y);

        const triggerInitialDetermination = this.data.deltas.X.length > 5 && this.detectedTrackPadLike === undefined;
        if (triggerInitialDetermination) {
            this.determineIsTrackPadLike();
        }
    }

    private cleanupSeries<T>(series: T[]): T[] {
        if (series.length <= this.MAX_RECORDS * 1.25) {
            return series;
        }

        const recordsToRemove = Math.abs(this.MAX_RECORDS - series.length);

        return series.slice(recordsToRemove);
    }

    private getOldestRecordTimestamp(): number | undefined {
        return this.data.deltas.X[0]?.timestamp;
    }

    private getLatestRecordTimestamp(): number | undefined {
        return this.data.deltas.X[this.data.deltas.X.length - 1]?.timestamp;
    }

    private getIndexOfLastValidRecord<T>(
        series: T[],
        timespan: number,
        now: number,
        getTimestamp: (entry: T) => number,
    ): number {
        const firstInvalidIndex = series.findLastIndex((entry) => now - getTimestamp(entry) > timespan);

        return coerceIn(firstInvalidIndex + 1, 0, series.length - 1);
    }

    public isTrackPadLike(): boolean {
        return !!this.detectedTrackPadLike;
    }

    private determineIsTrackPadLike(): void {
        const finalTimespan = d(15).seconds.inWholeMilliseconds;

        const now = Date.now();
        const oldestRecordTimestamp = this.getOldestRecordTimestamp();
        const latestRecordTimestamp = this.getLatestRecordTimestamp();
        const hasRecordedData = oldestRecordTimestamp !== undefined;
        if (!hasRecordedData) {
            return;
        }

        // The timespan needs to be based on the latest recorded data, not the current time.
        const finalLatestRecordTimestamp = latestRecordTimestamp ?? now;
        const hasSimultaneousDeltaOccurrences = this.hasSimultaneousDeltaOccurrences(
            finalTimespan,
            finalLatestRecordTimestamp,
        );
        const isTrackPadLikeX = this.isTrackPadLikeForDirection('X', finalTimespan, finalLatestRecordTimestamp);
        const isTrackPadLikeY = this.isTrackPadLikeForDirection('Y', finalTimespan, finalLatestRecordTimestamp);

        this.detectedTrackPadLike = hasSimultaneousDeltaOccurrences || isTrackPadLikeX || isTrackPadLikeY;
    }

    private hasSimultaneousDeltaOccurrences(timespan: number, now: number): boolean {
        const threshold = d(timespan).milliseconds.asWholeSeconds.div(2).inWholeSeconds;
        const indexOfLastValidOccurrence = this.getIndexOfLastValidRecord(
            this.data.simultaneousDeltaOccurrences,
            timespan,
            now,
            (timestamp) => timestamp,
        );

        return this.data.simultaneousDeltaOccurrences.slice(indexOfLastValidOccurrence).length >= threshold;
    }

    private isTrackPadLikeForDirection(direction: 'X' | 'Y', timespan: number, now: number): boolean {
        const indexOfLastValidRecord = this.getIndexOfLastValidRecord(
            this.data.deltas[direction],
            timespan,
            now,
            (entry) => entry.timestamp,
        );

        const filteredDeltaRecords = this.data.deltas[direction]
            .slice(indexOfLastValidRecord)
            .filter((entry) => !!entry.delta);

        if (!filteredDeltaRecords.length) {
            return false;
        }

        const deltas = filteredDeltaRecords.sort((a, b) => a.delta - b.delta);

        const isEven = deltas.length % 2 === 0;
        const medianIndex = Math.floor(deltas.length / 2);

        const oddMedian = deltas[medianIndex].delta;
        const evenMedian = (deltas[medianIndex].delta + deltas[Math.min(deltas.length - 1, medianIndex + 1)].delta) / 2;
        const median = isEven ? evenMedian : oddMedian;

        return median < this.TRACK_PAD_DELTA_THRESHOLD;
    }
}

export const PointerDeviceUtil = new PointerDeviceUtilClass();
