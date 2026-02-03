import { useSyncExternalStore } from 'react';
import type { DownloadStatusSubscription, GetDownloadStatusQuery } from '@/lib/requests/types.ts';
import { DownloadState, DownloadUpdateType, DownloaderState } from '@/lib/requests/types.ts';

type DownloadQueueEntry = GetDownloadStatusQuery['downloadStatus']['queue'][number] & { position: number };
type DownloadStatusSnapshot = Omit<GetDownloadStatusQuery['downloadStatus'], 'queue'> & {
    queue: DownloadQueueEntry[];
};
type DownloadStatusChangedPayload = DownloadStatusSubscription['downloadStatusChanged'] & {
    initial?: DownloadQueueEntry[];
};

let snapshot: DownloadStatusSnapshot | undefined;
const listeners = new Set<() => void>();

const notify = () => {
    listeners.forEach((listener) => listener());
};

const normalizeDownloadState = (state: string | undefined): DownloadState => {
    switch (state) {
        case DownloadState.Downloading:
            return DownloadState.Downloading;
        case DownloadState.Error:
            return DownloadState.Error;
        case DownloadState.Finished:
            return DownloadState.Finished;
        case DownloadState.Queued:
        default:
            return DownloadState.Queued;
    }
};

const normalizeDownloaderState = (state: string | undefined): DownloaderState =>
    state === DownloaderState.Started ? DownloaderState.Started : DownloaderState.Stopped;

const normalizeQueueEntry = (entry: DownloadQueueEntry, index: number): DownloadQueueEntry => ({
    ...entry,
    position: Number.isFinite(entry.position) ? entry.position : index,
    state: normalizeDownloadState(entry.state as unknown as string),
});

const sortQueue = (queue: DownloadQueueEntry[]): DownloadQueueEntry[] =>
    [...queue].sort((a, b) => a.position - b.position);

export const setDownloadStatusSnapshot = (downloadStatus?: GetDownloadStatusQuery['downloadStatus']): void => {
    if (!downloadStatus) {
        return;
    }
    snapshot = {
        ...downloadStatus,
        state: normalizeDownloaderState(downloadStatus.state as unknown as string),
        queue: sortQueue(downloadStatus.queue.map((entry, index) => normalizeQueueEntry(entry as DownloadQueueEntry, index))),
    };
    notify();
};

export const applyDownloadStatusUpdate = (payload?: DownloadStatusChangedPayload): void => {
    if (!payload) {
        return;
    }

    const nextState = normalizeDownloaderState(payload.state as unknown as string);
    let queue = snapshot?.queue ? [...snapshot.queue] : [];

    if (payload.initial) {
        queue = payload.initial.map((entry, index) => normalizeQueueEntry(entry, index));
    }

    for (const update of payload.updates ?? []) {
        const download = normalizeQueueEntry(update.download as DownloadQueueEntry, update.download.position ?? 0);
        const index = queue.findIndex((entry) => entry.chapter.id === download.chapter.id);

        if (update.type === DownloadUpdateType.Dequeued) {
            if (index >= 0) {
                queue.splice(index, 1);
            }
            continue;
        }

        if (index >= 0) {
            queue[index] = { ...queue[index], ...download };
        } else {
            queue.push(download);
        }
    }

    snapshot = {
        state: nextState,
        queue: sortQueue(queue),
    };
    notify();
};

export const getDownloadStatusSnapshot = (): DownloadStatusSnapshot | undefined => snapshot;

export const subscribeToDownloadStatus = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useDownloadStatusSnapshot = (): DownloadStatusSnapshot | undefined =>
    useSyncExternalStore(subscribeToDownloadStatus, getDownloadStatusSnapshot, getDownloadStatusSnapshot);
