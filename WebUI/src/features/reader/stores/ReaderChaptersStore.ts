/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { SliceCreator } from '@/lib/zustand/Zustand.types.ts';
import { ReaderStateChapters } from '@/features/reader/Reader.types.ts';

export interface ReaderChaptersStoreSlice {
    chapters: ReaderStateChapters & {
        setReaderStateChapters: (
            state: ((state: ReaderStateChapters) => ReaderStateChapters) | ReaderStateChapters,
        ) => void;
        reset: () => ReaderChaptersStoreSlice;
    };
}

export const READER_DEFAULT_CHAPTERS_STATE = {
    chapters: {
        mangaChapters: undefined,
        chapters: [],
        chapterForDuplicatesHandling: undefined,
        initialChapter: undefined,
        currentChapter: undefined,
        nextChapter: undefined,
        previousChapter: undefined,
        isCurrentChapterReady: false,
        visibleChapters: {
            leading: 0,
            trailing: 0,
            lastLeadingChapterSourceOrder: 99999,
            lastTrailingChapterSourceOrder: -1,
            isLeadingChapterPreloadMode: true,
            isTrailingChapterPreloadMode: true,
            scrollIntoView: false,
            resumeMode: undefined,
        },
    },
} satisfies {
    chapters: Omit<ReaderStateChapters, 'setReaderStateChapters'>;
};

export const createReaderChaptersStoreSlice = <T extends ReaderChaptersStoreSlice>(
    ...[createActionName, set, get]: Parameters<SliceCreator<T>>
): ReaderChaptersStoreSlice => ({
    chapters: {
        ...READER_DEFAULT_CHAPTERS_STATE.chapters,
        reset: () => ({ chapters: { ...get().chapters, ...READER_DEFAULT_CHAPTERS_STATE.chapters } }),
        setReaderStateChapters: (state) =>
            set(
                (draft) => {
                    if (typeof state === 'function') {
                        draft.chapters = {
                            ...get().chapters,
                            ...state(get().chapters),
                        };
                        return;
                    }

                    draft.chapters = {
                        ...get().chapters,
                        ...state,
                    };
                },
                undefined,
                createActionName('setReaderStateChapters'),
            ),
    },
});
