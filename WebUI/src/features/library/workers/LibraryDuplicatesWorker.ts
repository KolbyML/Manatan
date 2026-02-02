/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { findDuplicatesByTitle } from '@/features/library/util/LibraryDuplicates.util.ts';
import {
    LibraryDuplicatesDescriptionWorkerInput,
    LibraryDuplicatesWorkerInput,
    TMangaDuplicate,
    TMangaDuplicates,
} from '@/features/library/Library.types.ts';
import { Queue } from '@/lib/Queue.ts';
import { ControlledPromise } from '@/lib/ControlledPromise.ts';
import { enhancedCleanup } from '@/base/utils/Strings.ts';

const queue = new Queue((navigator.hardwareConcurrency ?? 5) - 1);
const MANGAS_PER_CHUNK = 200;

// eslint-disable-next-line no-restricted-globals
self.onmessage = async (event: MessageEvent<LibraryDuplicatesWorkerInput>) => {
    const { mangas, checkAlternativeTitles } = event.data;

    if (!checkAlternativeTitles) {
        postMessage(findDuplicatesByTitle(mangas));
        return;
    }

    const chunkPromises: Promise<TMangaDuplicates<TMangaDuplicate>>[] = [];
    for (let chunkStart = 0; chunkStart < mangas.length; chunkStart += MANGAS_PER_CHUNK) {
        chunkPromises.push(
            queue.enqueue(chunkStart.toString(), () => {
                const workerPromise = new ControlledPromise<TMangaDuplicates<TMangaDuplicate>>();

                const worker = new Worker(new URL('LibraryDuplicatesDescriptionWorker.ts', import.meta.url), {
                    type: 'module',
                });

                worker.onmessage = (subWorkerEvent: MessageEvent<TMangaDuplicates<TMangaDuplicate>>) =>
                    workerPromise.resolve(subWorkerEvent.data);

                worker.postMessage({
                    mangas,
                    mangasToCheck: mangas.slice(chunkStart, chunkStart + MANGAS_PER_CHUNK),
                } satisfies LibraryDuplicatesDescriptionWorkerInput);

                return workerPromise.promise;
            }).promise,
        );
    }

    const chunkedResults = await Promise.all(chunkPromises);
    const mergedResult: TMangaDuplicates<TMangaDuplicate> = {};

    const cleanedUpTitleToOriginalTitle: Record<string, string> = {};
    chunkedResults.forEach((chunkedResult) =>
        Object.entries(chunkedResult).forEach(([title, duplicates]) => {
            const cleanedTitle = enhancedCleanup(title);
            cleanedUpTitleToOriginalTitle[cleanedTitle] ??= title;
            const originalTitle = cleanedUpTitleToOriginalTitle[cleanedTitle];

            // ignore duplicated results for a title from other chunked results
            mergedResult[originalTitle] ??= duplicates;
        }),
    );

    postMessage(mergedResult);
};
