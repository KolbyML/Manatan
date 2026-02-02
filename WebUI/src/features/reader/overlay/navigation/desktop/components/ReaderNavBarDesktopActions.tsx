/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import IconButton from '@mui/material/IconButton';
import DownloadIcon from '@mui/icons-material/Download';
import ReplayIcon from '@mui/icons-material/Replay';
import { memo, useMemo, useRef } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { DownloadStateIndicator } from '@/base/components/downloads/DownloadStateIndicator.tsx';
import { ReaderLibraryButton } from '@/features/reader/overlay/navigation/components/ReaderLibraryButton.tsx';
import { ReaderBookmarkButton } from '@/features/reader/overlay/navigation/components/ReaderBookmarkButton.tsx';
import { CHAPTER_ACTION_TO_TRANSLATION, FALLBACK_CHAPTER } from '@/features/chapter/Chapter.constants.ts';
import { IconBrowser } from '@/assets/icons/IconBrowser.tsx';
import { IconWebView } from '@/assets/icons/IconWebView.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { useReaderChaptersStore, useReaderPagesStore } from '@/features/reader/stores/ReaderStore.ts';
import { ChapterDownloadInfo, ChapterIdInfo } from '@/features/chapter/Chapter.types.ts';

const DownloadButton = ({ id = -1, isDownloaded }: ChapterIdInfo & ChapterDownloadInfo) => {
    const { t } = useTranslation();

    const downloadStatus = Chapters.useDownloadStatusFromCache(id);

    const isDisabled = id === undefined;

    if (id !== undefined && isDownloaded) {
        return (
            <CustomTooltip title={t(CHAPTER_ACTION_TO_TRANSLATION.delete.action.single)}>
                <IconButton onClick={() => Chapters.performAction('delete', [id], {})} color="inherit">
                    <DeleteIcon />
                </IconButton>
            </CustomTooltip>
        );
    }

    if (downloadStatus) {
        return <DownloadStateIndicator chapterId={downloadStatus.chapter.id} />;
    }

    return (
        <CustomTooltip title={t(CHAPTER_ACTION_TO_TRANSLATION.download.action.single)} disabled={isDisabled}>
            <IconButton
                disabled={isDisabled}
                onClick={() => Chapters.performAction('download', [id], {})}
                color="inherit"
            >
                <DownloadIcon />
            </IconButton>
        </CustomTooltip>
    );
};

export const ReaderNavBarDesktopActions = memo(() => {
    const { id, isDownloaded, isBookmarked, realUrl } = useReaderChaptersStore((state) => ({
        id: state.chapters.currentChapter?.id ?? FALLBACK_CHAPTER.id,
        isDownloaded: state.chapters.currentChapter?.isDownloaded ?? FALLBACK_CHAPTER.isDownloaded,
        isBookmarked: state.chapters.currentChapter?.isBookmarked ?? FALLBACK_CHAPTER.isBookmarked,
        realUrl: state.chapters.currentChapter?.realUrl ?? FALLBACK_CHAPTER.realUrl,
    }));

    const { t } = useTranslation();
    const { pageLoadStates, setPageLoadStates, setRetryFailedPagesKeyPrefix } = useReaderPagesStore((state) => ({
        pageLoadStates: state.pages.pageLoadStates,
        setPageLoadStates: state.pages.setPageLoadStates,
        setRetryFailedPagesKeyPrefix: state.pages.setRetryFailedPagesKeyPrefix,
    }));

    const pageRetryKeyPrefix = useRef<number>(0);

    const haveSomePagesFailedToLoad = useMemo(
        () => pageLoadStates.some((pageLoadState) => pageLoadState.error),
        [pageLoadStates],
    );

    return (
        <Stack sx={{ flexDirection: 'row', justifyContent: 'center', gap: 1 }}>
            <ReaderLibraryButton />
            <ReaderBookmarkButton id={id} isBookmarked={isBookmarked} />
            <CustomTooltip title={t('reader.button.retry_load_pages')} disabled={!haveSomePagesFailedToLoad}>
                <IconButton
                    onClick={() => {
                        setPageLoadStates((statePageLoadStates) =>
                            statePageLoadStates.map((pageLoadState) => ({
                                url: pageLoadState.url,
                                loaded: pageLoadState.loaded,
                            })),
                        );
                        setRetryFailedPagesKeyPrefix(`${pageRetryKeyPrefix.current}`);
                        pageRetryKeyPrefix.current = (pageRetryKeyPrefix.current + 1) % 1000;
                    }}
                    disabled={!haveSomePagesFailedToLoad}
                    color="inherit"
                >
                    <ReplayIcon />
                </IconButton>
            </CustomTooltip>
            <DownloadButton id={id} isDownloaded={isDownloaded} />
            <CustomTooltip title={t('global.button.open_browser')} disabled={!realUrl}>
                <IconButton disabled={!realUrl} href={realUrl ?? ''} rel="noreferrer" target="_blank" color="inherit">
                    <IconBrowser />
                </IconButton>
            </CustomTooltip>
            <CustomTooltip title={t('global.button.open_webview')} disabled={!realUrl}>
                <IconButton
                    disabled={!realUrl}
                    href={realUrl ? requestManager.getWebviewUrl(realUrl) : ''}
                    rel="noreferrer"
                    target="_blank"
                    color="inherit"
                >
                    <IconWebView />
                </IconButton>
            </CustomTooltip>
        </Stack>
    );
});
