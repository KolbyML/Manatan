/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useLayoutEffect, useRef } from 'react';
import { getInitialReaderPageIndex } from '@/features/reader/Reader.utils.ts';
import { createPagesData } from '@/features/reader/viewer/pager/ReaderPager.utils.tsx';
import {
    ReaderPageSpreadState,
    ReaderResumeMode,
    ReaderStatePages,
    ReaderTransitionPageMode,
} from '@/features/reader/Reader.types.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { TChapterReader } from '@/features/chapter/Chapter.types.ts';
import { ReaderChaptersStoreSlice } from '@/features/reader/stores/ReaderChaptersStore.ts';
import { getReaderStore } from '@/features/reader/stores/ReaderStore.ts';
import { UrlUtil } from '@/lib/UrlUtil.ts';

export const useReaderSetPagesState = (
    isCurrentChapter: boolean,
    pagesResponse: ReturnType<typeof requestManager.useGetChapterPagesFetch>[1],
    resumeMode: ReaderResumeMode,
    lastPageRead: TChapterReader['lastPageRead'] | undefined,
    pages: ReaderStatePages['pages'],
    pageLoadStates: ReaderStatePages['pageLoadStates'],
    pagesToSpreadState: ReaderPageSpreadState[],
    arePagesFetched: boolean,
    setArePagesFetched: (fetched: boolean) => void,
    setReaderStateChapters: ReaderChaptersStoreSlice['chapters']['setReaderStateChapters'],
    setTotalPages: ReaderStatePages['setTotalPages'],
    setPages: ReaderStatePages['setPages'],
    setPageUrls: ReaderStatePages['setPageUrls'],
    setPageLoadStates: ReaderStatePages['setPageLoadStates'],
    setPagesToSpreadState: (state: ReaderPageSpreadState[]) => void,
    setCurrentPageIndex: ReaderStatePages['setCurrentPageIndex'],
    setPageToScrollToIndex: ReaderStatePages['setPageToScrollToIndex'],
    setTransitionPageMode: ReaderStatePages['setTransitionPageMode'],
) => {
    const previousPageData = useRef<string[]>(undefined);

    useLayoutEffect(() => {
        const pagesPayload = pagesResponse.data?.fetchChapterPages;
        if (!pagesPayload) {
            return;
        }

        const { pages: pagesFromResponse } = pagesPayload;
        const tmpPages = pagesFromResponse.length ? pagesFromResponse : [''];
        const newPages = tmpPages.map((page) =>
            UrlUtil.addParams(page, { sourceId: getReaderStore().manga?.sourceId }),
        );
        const initialReaderPageIndex = getInitialReaderPageIndex(resumeMode, lastPageRead ?? 0, newPages.length - 1);

        const didPagesChange = previousPageData.current !== pagesPayload?.pages;
        if (didPagesChange) {
            previousPageData.current = pagesPayload.pages;
            const newPageData = createPagesData(newPages);

            setArePagesFetched(true);
            setPages(newPageData);
            setPageUrls(newPages);
            setPageLoadStates(newPageData.map(({ primary: { url } }) => ({ url, loaded: false })));
            setPagesToSpreadState(newPageData.map(({ primary: { url } }) => ({ url, isSpread: false })));
        } else {
            setPages(pages);
            setPageLoadStates(pageLoadStates);
            setPagesToSpreadState(pagesToSpreadState);
        }

        setTotalPages(pagesPayload.pages.length);
        setPageUrls(newPages);
        setCurrentPageIndex(initialReaderPageIndex);
        setPageToScrollToIndex(initialReaderPageIndex);
        setReaderStateChapters((prevState) => ({
            ...prevState,
            isCurrentChapterReady: arePagesFetched || didPagesChange,
        }));

        setTransitionPageMode(ReaderTransitionPageMode.NONE);
    }, [pagesResponse.data?.fetchChapterPages?.pages, isCurrentChapter]);
};
