/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import Delete from '@mui/icons-material/Delete';
import DeleteSweep from '@mui/icons-material/DeleteSweep';
import DocumentScanner from '@mui/icons-material/DocumentScanner';
import Download from '@mui/icons-material/Download';
import RemoveDone from '@mui/icons-material/RemoveDone';
import Done from '@mui/icons-material/Done';
import { useTranslation } from 'react-i18next';
import BookmarkRemove from '@mui/icons-material/BookmarkRemove';
import BookmarkAdd from '@mui/icons-material/BookmarkAdd';
import DoneAll from '@mui/icons-material/DoneAll';
import { ComponentProps, useEffect, useMemo } from 'react';
import { SelectableCollectionReturnType } from '@/base/collection/hooks/useSelectableCollection.ts';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { MenuItem } from '@/base/components/menu/MenuItem.tsx';
import {
    createGetMenuItemTitle,
    createIsMenuItemDisabled,
    createShouldShowMenuItem,
} from '@/base/components/menu/Menu.utils.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { ChapterCard } from '@/features/chapter/components/cards/ChapterCard.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { CHAPTER_ACTION_TO_TRANSLATION } from '@/features/chapter/Chapter.constants.ts';
import {
    ChapterAction,
    ChapterBookmarkInfo,
    ChapterDownloadInfo,
    ChapterIdInfo,
    ChapterMangaInfo,
    ChapterReadInfo,
    ChapterRealUrlInfo,
} from '@/features/chapter/Chapter.types.ts';
import { IconWebView } from '@/assets/icons/IconWebView.tsx';
import { IconBrowser } from '@/assets/icons/IconBrowser.tsx';
import { useOCR } from '@/Manatan/context/OCRContext.tsx';

type BaseProps = { onClose: () => void; selectable?: boolean };

type TChapter = ChapterIdInfo &
    ChapterMangaInfo &
    ChapterDownloadInfo &
    ChapterBookmarkInfo &
    ChapterReadInfo &
    ChapterRealUrlInfo;

type SingleModeProps = {
    chapter: TChapter;
    handleSelection?: SelectableCollectionReturnType<TChapter['id']>['handleSelection'];
    canBeDownloaded: boolean;
};

type SelectModeProps = {
    selectedChapters: ComponentProps<typeof ChapterCard>['chapter'][];
};

type Props =
    | (BaseProps & SingleModeProps & PropertiesNever<SelectModeProps>)
    | (BaseProps & PropertiesNever<SingleModeProps> & SelectModeProps);

export const ChapterActionMenuItems = ({
    chapter,
    handleSelection,
    canBeDownloaded = false,
    selectedChapters = [],
    onClose,
    selectable = true,
}: Props) => {
    const { t } = useTranslation();
    const { chapterOcrStatusMap, refreshChapterOcrStatus, startChapterOcr, deleteChapterOcr } = useOCR();

    const isSingleMode = !!chapter;
    const { isDownloaded, isRead, isBookmarked } = chapter ?? {};

    const chapterPath = chapter ? `/manga/${chapter.mangaId}/chapter/${chapter.sourceOrder}` : null;
    const ocrStatus = chapterPath ? chapterOcrStatusMap.get(chapterPath) : undefined;
    const isOcrProcessed = ocrStatus?.status === 'processed';
    const isOcrProcessing = ocrStatus?.status === 'processing';
    const hasOcrData =
        isOcrProcessed ||
        isOcrProcessing ||
        (ocrStatus?.status === 'idle' && ocrStatus.cached > 0);

    useEffect(() => {
        if (!chapterPath) return;
        if (ocrStatus) return;
        void refreshChapterOcrStatus(chapterPath);
    }, [chapterPath, ocrStatus, refreshChapterOcrStatus]);

    const selectedChapterPaths = useMemo(
        () => selectedChapters.map((c) => `/manga/${c.mangaId}/chapter/${c.sourceOrder}`),
        [selectedChapters],
    );

    useEffect(() => {
        if (isSingleMode) return;
        selectedChapterPaths.forEach((path) => {
            if (chapterOcrStatusMap.has(path)) return;
            void refreshChapterOcrStatus(path);
        });
    }, [chapterOcrStatusMap, isSingleMode, refreshChapterOcrStatus, selectedChapterPaths]);

    const mangaChaptersResponse = requestManager.useGetMangaChaptersList(chapter?.mangaId ?? -1, {
        skip: !chapter,
        fetchPolicy: 'cache-only',
    });
    const allChapters = mangaChaptersResponse.data?.chapters.nodes ?? [];

    const {
        settings: { deleteChaptersWithBookmark },
    } = useMetadataServerSettings();

    const getMenuItemTitle = createGetMenuItemTitle(isSingleMode, CHAPTER_ACTION_TO_TRANSLATION);
    const shouldShowMenuItem = createShouldShowMenuItem(isSingleMode);
    const isMenuItemDisabled = createIsMenuItemDisabled(isSingleMode);

    const {
        downloadableChapters,
        downloadedChapters,
        unbookmarkedChapters,
        bookmarkedChapters,
        unreadChapters,
        readChapters,
    } = useMemo(
        () => ({
            downloadableChapters: Chapters.getDownloadable(selectedChapters),
            downloadedChapters: Chapters.getDownloaded(selectedChapters),
            unbookmarkedChapters: Chapters.getNonBookmarked(selectedChapters),
            bookmarkedChapters: Chapters.getBookmarked(selectedChapters),
            unreadChapters: Chapters.getNonRead(selectedChapters),
            readChapters: Chapters.getRead(selectedChapters),
        }),
        [selectedChapters],
    );

    const selectModeOcrState = useMemo(() => {
        if (isSingleMode) {
            return {
                showOcr: false,
                showDownloadAndOcr: false,
                showDeleteOcr: false,
                disableOcrActions: false,
                chaptersNeedingOcr: [] as TChapter[],
                chaptersWithOcrData: [] as TChapter[],
            };
        }

        const chaptersNeedingOcr: TChapter[] = [];
        const chaptersWithOcrData: TChapter[] = [];
        let anyProcessing = false;

        selectedChapters.forEach((c) => {
            const path = `/manga/${c.mangaId}/chapter/${c.sourceOrder}`;
            const status = chapterOcrStatusMap.get(path);

            if (status?.status === 'processing') anyProcessing = true;

            const hasData =
                status?.status === 'processed' ||
                status?.status === 'processing' ||
                (status?.status === 'idle' && status.cached > 0);
            if (hasData) chaptersWithOcrData.push(c);

            const isProcessed = status?.status === 'processed';
            if (!isProcessed) chaptersNeedingOcr.push(c);
        });

        const showOcr = chaptersNeedingOcr.length > 0;
        const showDownloadAndOcr = showOcr && downloadableChapters.length > 0;
        const showDeleteOcr = chaptersWithOcrData.length > 0;

        return {
            showOcr,
            showDownloadAndOcr,
            showDeleteOcr,
            disableOcrActions: anyProcessing,
            chaptersNeedingOcr,
            chaptersWithOcrData,
        };
    }, [chapterOcrStatusMap, downloadableChapters.length, isSingleMode, selectedChapters]);

    const handleSelect = () => {
        handleSelection?.(chapter.id, true);
        onClose();
    };

    const performAction = (action: ChapterAction | 'mark_prev_as_read', chapters: TChapter[]) => {
        const isMarkPrevAsRead = action === 'mark_prev_as_read';
        const actualAction: ChapterAction = isMarkPrevAsRead ? 'mark_as_read' : action;

        if (actualAction === 'delete' && chapter) {
            const isDeletable = Chapters.isDeletable(chapter, deleteChaptersWithBookmark);
            if (!isDeletable) {
                onClose();
                return;
            }
        }

        const getChapters = (): SingleModeProps['chapter'][] => {
            // select mode
            if (!chapter) {
                return chapters;
            }

            if (!isMarkPrevAsRead) {
                return [chapter];
            }

            const index = allChapters.findIndex(({ id: chapterId }) => chapterId === chapter.id);

            const isFirstChapter = index + 1 > allChapters.length - 1;
            if (isFirstChapter) {
                return [];
            }

            const previousChapters = allChapters.slice(index + 1);

            return Chapters.getNonRead(previousChapters);
        };

        const chaptersToUpdate = getChapters();

        if (!chaptersToUpdate.length) {
            onClose();
            return;
        }

        Chapters.performAction(actualAction, Chapters.getIds(chaptersToUpdate), {
            chapters: chaptersToUpdate,
            wasManuallyMarkedAsRead: true,
            trackProgressMangaId: chaptersToUpdate[0]?.mangaId,
        }).catch(defaultPromiseErrorHandler('ChapterActionMenuItems::performAction'));

        // When deleting a downloaded chapter, also delete its OCR cache (including cached OCR data).
        // This keeps chapter cleanup behavior consistent for OCR users.
        if (actualAction === 'delete') {
            const pathsToDelete = chaptersToUpdate.map((c) => `/manga/${c.mangaId}/chapter/${c.sourceOrder}`);
            pathsToDelete.forEach((path) => {
                const status = chapterOcrStatusMap.get(path);
                const shouldDelete =
                    status?.status === 'processed' ||
                    status?.status === 'processing' ||
                    (status?.status === 'idle' && status.cached > 0);
                if (shouldDelete) void deleteChapterOcr(path, true);
            });
        }
        onClose();
    };

    return (
        <>
            {isSingleMode && selectable && (
                <MenuItem onClick={handleSelect} Icon={CheckBoxOutlineBlank} title={t('chapter.action.label.select')} />
            )}
            {isSingleMode && (
                <>
                    <MenuItem
                        Icon={IconBrowser}
                        disabled={!chapter!.realUrl}
                        onClick={() => {
                            window.open(chapter!.realUrl!, '_blank', 'noopener,noreferrer');
                            onClose();
                        }}
                        title={t('global.button.open_browser')}
                    />
                    <MenuItem
                        Icon={IconWebView}
                        disabled={!chapter!.realUrl}
                        onClick={() => {
                            window.open(
                                requestManager.getWebviewUrl(chapter!.realUrl!),
                                '_blank',
                                'noopener,noreferrer',
                            );
                            onClose();
                        }}
                        title={t('global.button.open_webview')}
                    />
                </>
            )}
            {shouldShowMenuItem(canBeDownloaded) && (
                <MenuItem
                    Icon={Download}
                    disabled={isMenuItemDisabled(!downloadableChapters.length)}
                    onClick={() => performAction('download', downloadableChapters)}
                    title={getMenuItemTitle('download', downloadableChapters.length)}
                />
            )}

            {!isSingleMode && selectModeOcrState.showDownloadAndOcr && (
                <MenuItem
                    Icon={Download}
                    disabled={selectModeOcrState.disableOcrActions}
                    onClick={() => {
                        Chapters.performAction('download', Chapters.getIds(downloadableChapters), {
                            chapters: downloadableChapters,
                            trackProgressMangaId: downloadableChapters[0]?.mangaId,
                        }).catch(defaultPromiseErrorHandler('ChapterActionMenuItems::downloadAndOcr'));

                        selectModeOcrState.chaptersNeedingOcr.forEach((c) => {
                            const path = `/manga/${c.mangaId}/chapter/${c.sourceOrder}`;
                            void startChapterOcr(path);
                        });
                        onClose();
                    }}
                    title="Download & OCR"
                />
            )}

            {!isSingleMode && selectModeOcrState.showOcr && (
                <MenuItem
                    Icon={DocumentScanner}
                    disabled={selectModeOcrState.disableOcrActions}
                    onClick={() => {
                        selectModeOcrState.chaptersNeedingOcr.forEach((c) => {
                            const path = `/manga/${c.mangaId}/chapter/${c.sourceOrder}`;
                            void startChapterOcr(path);
                        });
                        onClose();
                    }}
                    title="OCR"
                />
            )}

            {!isSingleMode && selectModeOcrState.showDeleteOcr && (
                <MenuItem
                    Icon={DeleteSweep}
                    disabled={selectModeOcrState.disableOcrActions}
                    onClick={() => {
                        selectModeOcrState.chaptersWithOcrData.forEach((c) => {
                            const path = `/manga/${c.mangaId}/chapter/${c.sourceOrder}`;
                            void deleteChapterOcr(path, true);
                        });
                        onClose();
                    }}
                    title="Delete OCR"
                />
            )}

            {isSingleMode && chapterPath && !isOcrProcessed && canBeDownloaded && (
                <MenuItem
                    Icon={Download}
                    disabled={isOcrProcessing}
                    onClick={() => {
                        // Don't wait for the download to finish; enqueue download then start OCR.
                        Chapters.performAction('download', [chapter!.id], {
                            chapters: [chapter!],
                            trackProgressMangaId: chapter!.mangaId,
                        }).catch(defaultPromiseErrorHandler('ChapterActionMenuItems::downloadAndOcr'));
                        void startChapterOcr(chapterPath);
                        onClose();
                    }}
                    title="Download & OCR"
                />
            )}

            {isSingleMode && chapterPath && !isOcrProcessed && (
                <MenuItem
                    Icon={DocumentScanner}
                    disabled={isOcrProcessing}
                    onClick={() => {
                        void startChapterOcr(chapterPath);
                        onClose();
                    }}
                    title="OCR"
                />
            )}

            {isSingleMode && chapterPath && hasOcrData && (
                <MenuItem
                    Icon={DeleteSweep}
                    disabled={isOcrProcessing}
                    onClick={() => {
                        void deleteChapterOcr(chapterPath, true);
                        onClose();
                    }}
                    title="Delete OCR"
                />
            )}
            {shouldShowMenuItem(isDownloaded) && (
                <MenuItem
                    Icon={Delete}
                    disabled={isMenuItemDisabled(!downloadedChapters.length)}
                    onClick={() =>
                        performAction('delete', Chapters.getDeletable(downloadedChapters, deleteChaptersWithBookmark))
                    }
                    title={getMenuItemTitle('delete', downloadedChapters.length)}
                />
            )}
            {shouldShowMenuItem(!isBookmarked) && (
                <MenuItem
                    Icon={BookmarkAdd}
                    disabled={isMenuItemDisabled(!unbookmarkedChapters.length)}
                    onClick={() => performAction('bookmark', unbookmarkedChapters)}
                    title={getMenuItemTitle('bookmark', unbookmarkedChapters.length)}
                />
            )}
            {shouldShowMenuItem(isBookmarked) && (
                <MenuItem
                    Icon={BookmarkRemove}
                    disabled={isMenuItemDisabled(!bookmarkedChapters.length)}
                    onClick={() => performAction('unbookmark', bookmarkedChapters)}
                    title={getMenuItemTitle('unbookmark', bookmarkedChapters.length)}
                />
            )}
            {shouldShowMenuItem(!isRead) && (
                <MenuItem
                    Icon={Done}
                    disabled={isMenuItemDisabled(!unreadChapters.length)}
                    onClick={() => performAction('mark_as_read', unreadChapters)}
                    title={getMenuItemTitle('mark_as_read', unreadChapters.length)}
                />
            )}
            {shouldShowMenuItem(isRead) && (
                <MenuItem
                    Icon={RemoveDone}
                    disabled={isMenuItemDisabled(!readChapters.length)}
                    onClick={() => performAction('mark_as_unread', readChapters)}
                    title={getMenuItemTitle('mark_as_unread', readChapters.length)}
                />
            )}
            {isSingleMode && (
                <MenuItem
                    onClick={() => performAction('mark_prev_as_read', [])}
                    Icon={DoneAll}
                    title={t('chapter.action.mark_as_read.add.label.action.previous')}
                />
            )}
        </>
    );
};
