/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDefaultReaderSettings } from '@/features/reader/settings/ReaderSettingsMetadata.ts';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { ReaderOverlay } from '@/features/reader/overlay/ReaderOverlay.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { TapZoneLayout } from '@/features/reader/tap-zones/TapZoneLayout.tsx';
import { ReaderRGBAFilter } from '@/features/reader/filters/ReaderRGBAFilter.tsx';
import { ReaderViewer } from '@/features/reader/viewer/ReaderViewer.tsx';
import { READER_BACKGROUND_TO_COLOR } from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { ReaderHotkeys } from '@/features/reader/hotkeys/ReaderHotkeys.tsx';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { NavbarContextType } from '@/features/navigation-bar/NavigationBar.types.ts';
import { withPropsFrom } from '@/base/hoc/withPropsFrom.tsx';
import { useReaderResetStates } from '@/features/reader/hooks/useReaderResetStates.ts';
import { useReaderSetSettingsState } from '@/features/reader/hooks/useReaderSetSettingsState.ts';
import { useReaderShowSettingPreviewOnChange } from '@/features/reader/hooks/useReaderShowSettingPreviewOnChange.ts';
import { useReaderSetChaptersState } from '@/features/reader/hooks/useReaderSetChaptersState.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { useChapterListOptions } from '@/features/chapter/utils/ChapterList.util.tsx';
import { FALLBACK_MANGA } from '@/features/manga/Manga.constants.ts';
import {
    getReaderOverlayStore,
    getReaderStore,
    useReaderChaptersStore,
    useReaderSettingsStore,
    useReaderStore,
    useReaderTapZoneStore,
} from '@/features/reader/stores/ReaderStore.ts';

import { ReaderAutoScroll } from '@/features/reader/auto-scroll/ReaderAutoScroll.tsx';
import { ReaderZoomProvider } from '../zoom/ReaderZoomContext';

const BaseReader = ({
    setOverride,
    readerNavBarWidth,
}: Pick<NavbarContextType, 'setOverride' | 'readerNavBarWidth'>) => {
    const { t } = useTranslation();
    const manga = useReaderStore((state) => state.manga);
    const { mangaChapters, initialChapter, chapterForDuplicatesHandling, currentChapter } = useReaderChaptersStore(
        (state) => ({
            mangaChapters: state.chapters.mangaChapters,
            initialChapter: state.chapters.initialChapter,
            chapterForDuplicatesHandling: state.chapters.chapterForDuplicatesHandling,
            currentChapter: state.chapters.currentChapter,
        }),
    );
    const {
        shouldSkipDupChapters,
        shouldSkipFilteredChapters,
        backgroundColor,
        readingMode,
        tapZoneLayout,
        tapZoneInvertMode,
        shouldShowReadingModePreview,
        shouldShowTapZoneLayoutPreview,
        setSettings,
    } = useReaderSettingsStore((state) => ({
        shouldSkipDupChapters: state.settings.shouldSkipDupChapters,
        shouldSkipFilteredChapters: state.settings.shouldSkipFilteredChapters,
        backgroundColor: state.settings.backgroundColor,
        readingMode: state.settings.readingMode,
        tapZoneLayout: state.settings.tapZoneLayout,
        tapZoneInvertMode: state.settings.tapZoneInvertMode,
        shouldShowReadingModePreview: state.settings.shouldShowReadingModePreview,
        shouldShowTapZoneLayoutPreview: state.settings.shouldShowTapZoneLayoutPreview,
        setSettings: state.settings.setSettings,
    }));
    const setShowPreview = useReaderTapZoneStore((state) => state.tapZone.setShowPreview);

    const scrollElementRef = useRef<HTMLDivElement | null>(null);

    const [areSettingsSet, setAreSettingsSet] = useState(false);

    const { chapterSourceOrder: paramChapterSourceOrder, mangaId: paramMangaId } = useParams<{
        chapterSourceOrder: string;
        mangaId: string;
    }>();
    const chapterSourceOrder = Number(paramChapterSourceOrder);
    const mangaId = Number(paramMangaId);

    const mangaResponse = requestManager.useGetMangaReader(mangaId);
    const chaptersResponse = requestManager.useGetReaderChapters(mangaId);

    useAppTitle(
        !manga || !currentChapter
            ? t('reader.title', { mangaId, chapterIndex: chapterSourceOrder })
            : `${manga.title}: ${currentChapter.name}`,
    );

    const {
        metadata: defaultSettingsMetadata,
        settings: defaultSettings,
        request: defaultSettingsResponse,
    } = useDefaultReaderSettings();
    const chapterListOptions = useChapterListOptions(manga ?? FALLBACK_MANGA);

    const isLoading =
        currentChapter === undefined ||
        !areSettingsSet ||
        mangaResponse.loading ||
        chaptersResponse.loading ||
        defaultSettingsResponse.loading;
    const error = mangaResponse.error ?? chaptersResponse.error ?? defaultSettingsResponse.error;

    useEffect(() => {
        getReaderStore().setManga(mangaResponse.data?.manga);
    }, [mangaResponse.data?.manga]);

    useReaderResetStates();
    useReaderSetSettingsState(
        mangaResponse,
        defaultSettingsResponse,
        defaultSettings,
        defaultSettingsMetadata,
        setSettings,
        areSettingsSet,
        setAreSettingsSet,
    );
    useReaderShowSettingPreviewOnChange(
        isLoading,
        error,
        areSettingsSet,
        readingMode,
        tapZoneLayout,
        tapZoneInvertMode,
        shouldShowReadingModePreview,
        shouldShowTapZoneLayoutPreview,
        setShowPreview,
    );
    useReaderSetChaptersState(
        chaptersResponse,
        chapterSourceOrder,
        mangaChapters,
        initialChapter,
        chapterForDuplicatesHandling,
        shouldSkipDupChapters,
        shouldSkipFilteredChapters,
        chapterListOptions,
    );

    useLayoutEffect(() => {
        setOverride({
            status: true,
            value: (
                <Box sx={{ position: 'absolute' }}>
                    <ReaderHotkeys scrollElementRef={scrollElementRef} />
                    <ReaderOverlay />
                    {!scrollElementRef.current && (
                        <Box
                            onClick={() => getReaderOverlayStore().setIsVisible(!getReaderOverlayStore().isVisible)}
                            sx={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                width: '100vw',
                                height: '100vh',
                                background: 'transparent',
                            }}
                        />
                    )}
                </Box>
            ),
        });

        return () => setOverride({ status: false, value: null });
    }, [scrollElementRef.current]);

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => {
                    if (mangaResponse.error) {
                        mangaResponse.refetch().catch(defaultPromiseErrorHandler('Reader::refetchManga'));
                    }

                    if (defaultSettingsResponse.error) {
                        defaultSettingsResponse
                            .refetch()
                            .catch(defaultPromiseErrorHandler('Reader::refetchDefaultSettings'));
                    }

                    if (chaptersResponse.error) {
                        chaptersResponse.refetch().catch(defaultPromiseErrorHandler('Reader::refetchChapters'));
                    }
                }}
            />
        );
    }

    if (isLoading) {
        return (
            <Box
                sx={{
                    height: '100vh',
                    width: '100vw',
                    display: 'grid',
                    placeItems: 'center',
                }}
            >
                <LoadingPlaceholder />
            </Box>
        );
    }

    if (currentChapter === null) {
        return <EmptyViewAbsoluteCentered message={t('reader.error.label.chapter_not_found')} />;
    }

    if (!manga || !currentChapter) {
        return null;
    }

    return (
        <ReaderZoomProvider>
            <Box
                sx={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: `calc(100vw - ${readerNavBarWidth}px)`,
                    maxWidth: `calc(100vw - ${readerNavBarWidth}px)`,
                    width: `calc(100vw - ${readerNavBarWidth}px)`,
                    height: `100dvh`,
                    marginLeft: `${readerNavBarWidth}px`,
                    transition: (theme) =>
                        `width 0.${theme.transitions.duration.shortest}s, margin-left 0.${theme.transitions.duration.shortest}s`,
                    overflow: 'auto',
                    backgroundColor: READER_BACKGROUND_TO_COLOR[backgroundColor],
                }}
            >
                <ReaderViewer ref={scrollElementRef} />
                <TapZoneLayout />
                <ReaderRGBAFilter />
                <ReaderAutoScroll />
            </Box>
        </ReaderZoomProvider>
    );
};

export const Reader = withPropsFrom(memo(BaseReader), [useNavBarContext], ['setOverride', 'readerNavBarWidth']);
