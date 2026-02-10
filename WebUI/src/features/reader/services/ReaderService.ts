/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Direction, useTheme } from '@mui/material/styles';
import { t as translate } from 'i18next';
import { ChapterIdInfo, TChapterReader } from '@/features/chapter/Chapter.types.ts';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import {
    IReaderSettings,
    ReaderExitMode,
    ReaderOpenChapterLocationState,
    ReaderOverlayMode,
    ReadingDirection,
    ReadingMode,
} from '@/features/reader/Reader.types.ts';
import { updateReaderSettings } from '@/features/reader/settings/ReaderSettingsMetadata.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { useBackButton } from '@/base/hooks/useBackButton.ts';
import {
    DEFAULT_READER_SETTINGS,
    GLOBAL_READER_SETTING_KEYS,
} from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { UpdateChapterPatchInput } from '@/lib/requests/types.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import {
    getChapterIdsForDownloadAhead,
    getChapterIdsToDeleteForChapterUpdate,
    getReaderChapterFromCache,
    isInDownloadAheadRange,
    updateReaderStateVisibleChapters,
} from '@/features/reader/Reader.utils.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { Queue } from '@/lib/Queue.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { FALLBACK_MANGA, GLOBAL_READER_SETTINGS_MANGA } from '@/features/manga/Manga.constants.ts';
import { getMetadataKey } from '@/features/metadata/Metadata.utils.ts';
import { DirectionOffset } from '@/base/Base.types.ts';
import {
    getReaderChaptersStore,
    getReaderSettingsStore,
    getReaderStore,
    useReaderSettingsStore,
} from '@/features/reader/stores/ReaderStore.ts';
import { ReactRouter } from '@/lib/react-router/ReactRouter.ts';
import { ReaderChaptersStoreSlice } from '@/features/reader/stores/ReaderChaptersStore.ts';

const DIRECTION_TO_INVERTED: Record<Direction, Direction> = {
    ltr: 'rtl',
    rtl: 'ltr',
};

const DIRECTION_TO_READING_DIRECTION: Record<Direction, ReadingDirection> = {
    ltr: ReadingDirection.LTR,
    rtl: ReadingDirection.RTL,
};

export class ReaderService {
    private static downloadAheadQueue: Queue = new Queue(1);

    private static chapterUpdateQueues: Map<ChapterIdInfo['id'], Queue> = new Map();

    private static getOrCreateChapterUpdateQueue(id: ChapterIdInfo['id']): Queue {
        if (!ReaderService.chapterUpdateQueues.has(id)) {
            ReaderService.chapterUpdateQueues.set(id, new Queue(1));
        }

        return ReaderService.chapterUpdateQueues.get(id)!;
    }

    static navigateToChapter(chapter: TChapterReader, state?: ReaderOpenChapterLocationState): void {
        ReactRouter.navigate(Chapters.getReaderUrl(chapter), {
            replace: true,
            state,
        });
    }

    static downloadAhead(
        currentChapter: TChapterReader,
        nextChapter: TChapterReader | undefined,
        nextChapters: TChapterReader[],
        pageIndex: number,
        downloadAheadLimit: number,
    ): void {
        const key = `${currentChapter.id}_${nextChapter?.id}_${pageIndex}_${downloadAheadLimit}`;

        ReaderService.downloadAheadQueue.enqueue(key, async () => {
            const chapterIdsForDownloadAhead = getChapterIdsForDownloadAhead(
                currentChapter,
                nextChapter,
                nextChapters,
                pageIndex,
                downloadAheadLimit,
            );

            if (!chapterIdsForDownloadAhead.length) {
                return;
            }

            try {
                await Chapters.download(chapterIdsForDownloadAhead);
            } catch (e) {
                defaultPromiseErrorHandler('ReaderService::useUpdateCurrentPageIndex: download ahead')(e);
            }
        });
    }

    static preloadChapter(
        pageIndex: number,
        pageCount: number,
        chapter: TChapterReader | undefined | null,
        lastLeadingChapterSourceOrder: number,
        lastTrailingChapterSourceOrder: number,
        setReaderStateChapters: ReaderChaptersStoreSlice['chapters']['setReaderStateChapters'],
        direction: DirectionOffset,
    ): void {
        if (!chapter) {
            return;
        }

        const isPreviousChapter = direction === DirectionOffset.PREVIOUS;
        const isNextChapter = direction === DirectionOffset.NEXT;

        const isAlreadyPreloaded =
            (isPreviousChapter && lastLeadingChapterSourceOrder <= chapter.sourceOrder) ||
            (isNextChapter && lastTrailingChapterSourceOrder >= chapter.sourceOrder);
        const shouldPreload = !isAlreadyPreloaded && isInDownloadAheadRange(pageIndex, pageCount, direction);
        if (!shouldPreload) {
            return;
        }

        setReaderStateChapters((state) =>
            updateReaderStateVisibleChapters(
                isPreviousChapter,
                state,
                chapter.sourceOrder,
                false,
                isPreviousChapter ? true : undefined,
                isNextChapter ? true : undefined,
            ),
        );
    }

    static useUpdateChapter(): (patch: UpdateChapterPatchInput) => void {
        const {
            settings: { deleteChaptersWhileReading, deleteChaptersWithBookmark, updateProgressAfterReading },
        } = useMetadataServerSettings();

        return useCallback(
            (patch) => {
                const { manga } = getReaderStore();
                const { currentChapter, mangaChapters, chapters } = getReaderChaptersStore();
                const { shouldSkipDupChapters } = getReaderSettingsStore();

                if (!manga || !currentChapter || !mangaChapters) {
                    return;
                }

                const previousChapters = Chapters.getNextChapters(currentChapter, chapters, {
                    offset: DirectionOffset.PREVIOUS,
                });

                const update = async () => {
                    const chapterIdsToUpdate = Chapters.getIds(
                        shouldSkipDupChapters
                            ? Chapters.addDuplicates([currentChapter], mangaChapters)
                            : [currentChapter],
                    );

                    const chapterIdsToDelete = getChapterIdsToDeleteForChapterUpdate(
                        currentChapter,
                        mangaChapters,
                        previousChapters,
                        patch,
                        deleteChaptersWhileReading,
                        deleteChaptersWithBookmark,
                        shouldSkipDupChapters,
                    );

                    const isUpdateRequired =
                        !!chapterIdsToDelete.length ||
                        chapterIdsToUpdate.some((id) => {
                            const chapterUpToDateData = getReaderChapterFromCache(id);
                            if (!chapterUpToDateData) {
                                return false;
                            }

                            return (
                                (patch.isRead !== undefined && patch.isRead !== chapterUpToDateData.isRead) ||
                                (patch.lastPageRead !== undefined &&
                                    patch.lastPageRead !== chapterUpToDateData.lastPageRead) ||
                                (patch.isBookmarked !== undefined &&
                                    patch.isBookmarked !== chapterUpToDateData.isBookmarked)
                            );
                        });
                    if (!isUpdateRequired) {
                        return;
                    }

                    await requestManager
                        .updateChapters(
                            chapterIdsToUpdate,
                            {
                                ...patch,
                                chapterIdsToDelete,
                                trackProgressMangaId:
                                    updateProgressAfterReading && patch.isRead && manga.trackRecords.totalCount
                                        ? manga.id
                                        : undefined,
                            },
                            { errorPolicy: 'all' },
                        )
                        .response.catch(defaultPromiseErrorHandler('ReaderService::useUpdateChapter'));
                };

                ReaderService.getOrCreateChapterUpdateQueue(currentChapter.id).enqueue(`${currentChapter.id}`, update);
            },
            [deleteChaptersWhileReading, deleteChaptersWithBookmark, updateProgressAfterReading],
        );
    }

    static useGetThemeDirection(): Direction {
        const { direction } = useTheme();
        const readingDirection = useReaderSettingsStore((state) => state.settings.readingDirection.value);

        return DIRECTION_TO_READING_DIRECTION[direction] === readingDirection
            ? direction
            : DIRECTION_TO_INVERTED[direction];
    }

    /**
     * Updates local reader settings and persists if "commit" is true.
     */
    static updateSetting<Setting extends keyof IReaderSettings>(
        setting: Setting,
        value: IReaderSettings[Setting],
        commit: boolean = true,
        isGlobal: boolean = false,
        profile?: ReadingMode,
    ): void {
        const { manga: currentManga } = getReaderStore();
        const manga = currentManga ?? (isGlobal ? GLOBAL_READER_SETTINGS_MANGA : currentManga);

        if (!manga || manga.id === FALLBACK_MANGA.id) {
            return;
        }
        const isGlobalSetting = isGlobal || GLOBAL_READER_SETTING_KEYS.includes(setting);
        // ReaderStore always stores manga-scoped settings with a { value, isDefault } wrapper,
        // even when we persist them to global meta (e.g. default/profile settings).
        const shouldWrapInStore = !GLOBAL_READER_SETTING_KEYS.includes(setting);
        const settingsStore = getReaderSettingsStore();
        if (settingsStore?.setSettings) {
            const previousValue: any = (settingsStore as any)[setting];
            const wrappedValue =
                previousValue && typeof previousValue === 'object' && 'value' in previousValue
                    ? { ...previousValue, value, isDefault: false }
                    : { value, isDefault: false };
            const nextSettings = {
                ...settingsStore,
                [setting]: shouldWrapInStore ? wrappedValue : value,
            } as typeof settingsStore;
            settingsStore.setSettings(nextSettings);
        }

        if (commit) {
            updateReaderSettings(manga, setting, value, isGlobal, profile).catch((e) =>
                makeToast(
                    translate('reader.settings.error.label.failed_to_save_settings'),
                    'error',
                    getErrorMessage(e),
                ),
            );
        }
    }

    static deleteSetting<Setting extends keyof IReaderSettings>(
        setting: Setting,
        isGlobal: boolean = false,
        profile?: string,
    ): void {
        const { manga: currentManga } = getReaderStore();
        const manga = currentManga ?? (isGlobal ? GLOBAL_READER_SETTINGS_MANGA : currentManga);

        if (!manga || manga.id === FALLBACK_MANGA.id) {
            return;
        }

        const key = getMetadataKey(setting, profile !== undefined ? [profile] : undefined);

        const isGlobalSetting = isGlobal || GLOBAL_READER_SETTING_KEYS.includes(setting);
        const shouldWrapInStore = !GLOBAL_READER_SETTING_KEYS.includes(setting);
        const settingsStore = getReaderSettingsStore();
        if (settingsStore?.setSettings) {
            const nextSettings = {
                ...settingsStore,
                [setting]: shouldWrapInStore
                    ? {
                          value: DEFAULT_READER_SETTINGS[setting],
                          isDefault: true,
                      }
                    : DEFAULT_READER_SETTINGS[setting],
            } as typeof settingsStore;
            settingsStore.setSettings(nextSettings);
        }

        const deleteSetting = isGlobalSetting
            ? () => requestManager.deleteGlobalMeta(key).response
            : () => requestManager.deleteMangaMeta(manga.id, key).response;
        deleteSetting().catch((e) =>
            makeToast(translate('reader.settings.error.label.failed_to_save_settings'), 'error', getErrorMessage(e)),
        );
    }

    static useOverlayMode(): { mode: ReaderOverlayMode; isDesktop: boolean; isMobile: boolean } {
        const isTouchDevice = MediaQuery.useIsTouchDevice();
        const overlayMode = useReaderSettingsStore((state) => state.settings.overlayMode);

        const isAutoModeSelected = overlayMode === ReaderOverlayMode.AUTO;
        const isDesktopModeSelected = overlayMode === ReaderOverlayMode.DESKTOP;
        const isMobileModeSelected = overlayMode === ReaderOverlayMode.MOBILE;

        const isDesktop = isDesktopModeSelected || (isAutoModeSelected && !isTouchDevice);
        const isMobile = isMobileModeSelected || (isAutoModeSelected && isTouchDevice);

        return {
            mode: isDesktop ? ReaderOverlayMode.DESKTOP : ReaderOverlayMode.MOBILE,
            isDesktop,
            isMobile,
        };
    }

    static useExit(): () => void {
        const exitMode = useReaderSettingsStore((state) => state.settings.exitMode);
        const handleBack = useBackButton();
        const navigate = useNavigate();

        const openMangaPage = useCallback(() => {
            const { manga } = getReaderStore();

            if (!manga) {
                navigate(AppRoutes.library.path());
                return;
            }

            navigate(AppRoutes.manga.path(manga.id));
        }, [navigate]);

        switch (exitMode) {
            case ReaderExitMode.PREVIOUS:
                return handleBack;
            case ReaderExitMode.MANGA:
                return openMangaPage;
            default:
                throw new Error(`Unexpected "exitMode" (${exitMode})`);
        }
    }
}
