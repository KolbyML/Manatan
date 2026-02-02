/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { TMangaReader } from '@/features/manga/Manga.types.ts';
import {
    createReaderOverlayStoreSlice,
    ReaderOverlayStoreSlice,
} from '@/features/reader/overlay/ReaderOverlayStore.ts';
import {
    createReaderAutoScrollStoreSlice,
    ReaderAutoScrollStoreSlice,
} from '@/features/reader/auto-scroll/ReaderAutoScrollStore.ts';
import { IReaderSettingsWithDefaultFlag } from '@/features/reader/Reader.types.ts';
import { DEFAULT_READER_SETTINGS_WITH_DEFAULT_FLAG } from '@/features/reader/settings/ReaderSettingsMetadata.ts';
import {
    createReaderProgressBarStoreSlice,
    ReaderProgressBarStoreSlice,
} from '@/features/reader/overlay/progress-bar/ReaderProgressBarStore.tsx';
import {
    createReaderTapZoneStoreSlice,
    ReaderTapZoneStoreSlice,
} from '@/features/reader/tap-zones/ReaderTapZoneStore.tsx';
import { createReaderPagesStoreSlice, ReaderPagesStoreSlice } from '@/features/reader/stores/ReaderPagesStore.ts';
import {
    createReaderChaptersStoreSlice,
    ReaderChaptersStoreSlice,
} from '@/features/reader/stores/ReaderChaptersStore.ts';
import { ZustandUtil } from '@/lib/zustand/ZustandUtil.ts';

const UNSERIALIZABLE_KEYS = ['scrollRef'];

interface ReaderStore
    extends ReaderOverlayStoreSlice,
        ReaderAutoScrollStoreSlice,
        ReaderPagesStoreSlice,
        ReaderChaptersStoreSlice,
        ReaderProgressBarStoreSlice,
        ReaderTapZoneStoreSlice {
    reset: () => void;
    manga: TMangaReader | undefined;
    setManga: (manga: TMangaReader | undefined) => void;
    scrollbar: {
        xSize: number;
        setXSize: (size: number) => void;
        ySize: number;
        setYSize: (size: number) => void;
    };
    settings: IReaderSettingsWithDefaultFlag & {
        setSettings: (settings: IReaderSettingsWithDefaultFlag) => void;
    };
}

const DEFAULT_STATE = {
    manga: undefined,
    scrollbar: {
        xSize: 0,
        ySize: 0,
    },
} satisfies Pick<ReaderStore, 'manga'> & { scrollbar: Pick<ReaderStore['scrollbar'], 'xSize' | 'ySize'> };

const readerStore = create<ReaderStore>()(
    devtools(
        immer((set, get, store) => {
            const createActionName = ZustandUtil.createActionNameCreator('reader');
            const createActionNameCreator = (name: string) =>
                ZustandUtil.createActionNameCreator(name, createActionName);

            return {
                ...DEFAULT_STATE,
                reset: () =>
                    set(
                        () => ({
                            ...get(),
                            ...DEFAULT_STATE,
                            scrollbar: {
                                ...get().scrollbar,
                                ...DEFAULT_STATE.scrollbar,
                            },
                            settings: {
                                ...get().settings,
                                ...DEFAULT_READER_SETTINGS_WITH_DEFAULT_FLAG,
                            },
                            ...get().overlay.reset(),
                            ...get().autoScroll.reset(),
                            ...get().pages.reset(),
                            ...get().chapters.reset(),
                            ...get().progressBar.reset(),
                            ...get().tapZone.reset(),
                        }),
                        undefined,
                        createActionName('reset'),
                    ),
                setManga: (manga) =>
                    set(
                        (draft) => {
                            draft.manga = manga;
                        },
                        undefined,
                        createActionName('setManga'),
                    ),
                scrollbar: {
                    ...DEFAULT_STATE.scrollbar,
                    setXSize: (size) =>
                        set(
                            (draft) => {
                                draft.scrollbar.xSize = size;
                            },
                            undefined,
                            createActionName('scrollbar', 'setXSize'),
                        ),
                    setYSize: (size) =>
                        set(
                            (draft) => {
                                draft.scrollbar.ySize = size;
                            },
                            undefined,
                            createActionName('scrollbar', 'setYSize'),
                        ),
                },
                settings: {
                    ...DEFAULT_READER_SETTINGS_WITH_DEFAULT_FLAG,
                    setSettings: (settings) =>
                        set(
                            (draft) => {
                                draft.settings = {
                                    ...get().settings,
                                    ...settings,
                                };
                            },
                            undefined,
                            createActionName('settings', 'setSettings'),
                        ),
                },
                ...createReaderOverlayStoreSlice(createActionNameCreator('overlay'), set, get, store),
                ...createReaderAutoScrollStoreSlice(createActionNameCreator('autoScroll'), set, get, store),
                ...createReaderPagesStoreSlice(createActionNameCreator('pages'), set, get, store),
                ...createReaderChaptersStoreSlice(createActionNameCreator('chapters'), set, get, store),
                ...createReaderProgressBarStoreSlice(createActionNameCreator('progressBar'), set, get, store),
                ...createReaderTapZoneStoreSlice(createActionNameCreator('tapZone'), set, get, store),
            };
        }),
        {
            name: 'ReaderStore',
            anonymousActionType: 'reader/action',
            serialize: {
                replacer: (key: string, value: any) => {
                    if (UNSERIALIZABLE_KEYS.includes(key)) {
                        return null;
                    }

                    return value;
                },
            },
        },
    ),
);
export const useReaderStore = <T>(selector: (state: ReaderStore) => T): T => readerStore(useShallow(selector));
export const getReaderStore = () => readerStore.getState();

export const useReaderScrollbarStore = useReaderStore;
export const getReaderScrollbarStore = () => readerStore.getState().scrollbar;

export const useReaderSettingsStore = useReaderStore;
export const getReaderSettingsStore = () => readerStore.getState().settings;

export const useReaderOverlayStore = useReaderStore;
export const getReaderOverlayStore = () => readerStore.getState().overlay;

export const useReaderAutoScrollStore = useReaderStore;
export const getReaderAutoScrollStore = () => readerStore.getState().autoScroll;

export const useReaderPagesStore = useReaderStore;
export const getReaderPagesStore = () => readerStore.getState().pages;

export const useReaderChaptersStore = useReaderStore;
export const getReaderChaptersStore = () => readerStore.getState().chapters;

export const useReaderProgressBarStore = useReaderStore;
export const getReaderProgressBarStore = () => readerStore.getState().progressBar;

export const useReaderTapZoneStore = useReaderStore;
export const getReaderTapZoneStore = () => readerStore.getState().tapZone;
