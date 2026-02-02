/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { ResumeFab } from '@/features/manga/components/ResumeFAB.tsx';
import {
    filterAndSortChapters,
    updateChapterListOptions,
    useChapterListOptions,
} from '@/features/chapter/utils/ChapterList.util.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { ChaptersToolbarMenu } from '@/features/chapter/components/ChaptersToolbarMenu.tsx';
import { SelectionFAB } from '@/base/collection/components/SelectionFAB.tsx';
import { DEFAULT_FULL_FAB_HEIGHT } from '@/base/components/buttons/StyledFab.tsx';
import {
    ChapterListFieldsFragment,
    GetChaptersMangaQuery,
    GetChaptersMangaQueryVariables,
    MangaScreenFieldsFragment,
} from '@/lib/graphql/generated/graphql.ts';
import { useSelectableCollection } from '@/base/collection/hooks/useSelectableCollection.ts';
import { SelectableCollectionSelectAll } from '@/base/collection/components/SelectableCollectionSelectAll.tsx';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { ChapterActionMenuItems } from '@/features/chapter/components/actions/ChapterActionMenuItems.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { GET_CHAPTERS_MANGA } from '@/lib/graphql/chapter/ChapterQuery.ts';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { useResizeObserver } from '@/base/hooks/useResizeObserver.tsx';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { shouldForwardProp } from '@/base/utils/ShouldForwardProp.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { ChapterListCard } from '@/features/chapter/components/cards/ChapterListCard.tsx';
import { VirtuosoPersisted } from '@/lib/virtuoso/Component/VirtuosoPersisted.tsx';

type ChapterListHeaderProps = {
    scrollbarWidth: number;
};
const ChapterListHeader = styled(Stack, {
    shouldForwardProp: shouldForwardProp<ChapterListHeaderProps>(['scrollbarWidth']),
})<ChapterListHeaderProps>(({ theme, scrollbarWidth }) => ({
    padding: theme.spacing(1),
    paddingRight: `calc(${scrollbarWidth}px + ${theme.spacing(1)})`,
    paddingBottom: 0,
    [theme.breakpoints.down('md')]: {
        paddingRight: theme.spacing(1),
    },
}));

type StyledVirtuosoProps = { topOffset: number };
const StyledVirtuoso = styled(VirtuosoPersisted, {
    shouldForwardProp: shouldForwardProp<StyledVirtuosoProps>(['topOffset']),
})<StyledVirtuosoProps>(({ theme, topOffset }) => ({
    listStyle: 'none',
    padding: 0,
    [theme.breakpoints.up('md')]: {
        height: `calc(100vh - ${topOffset}px)`,
        margin: 0,
    },
}));

const ChapterListFAB = ({
    selectedChapters,
    firstUnreadChapter,
    onFABMenuClose,
}: {
    selectedChapters: ChapterListFieldsFragment[];
    firstUnreadChapter: ComponentProps<typeof ResumeFab>['chapter'] | null | undefined;
    onFABMenuClose?: () => void;
}) => {
    if (selectedChapters.length) {
        return (
            <SelectionFAB selectedItemsCount={selectedChapters.length} title="chapter.title_one">
                {(handleClose) => (
                    <ChapterActionMenuItems
                        selectedChapters={selectedChapters}
                        onClose={() => {
                            onFABMenuClose?.();
                            handleClose();
                        }}
                    />
                )}
            </SelectionFAB>
        );
    }

    if (firstUnreadChapter) {
        return <ResumeFab chapter={firstUnreadChapter} />;
    }

    return null;
};

export const ChapterList = ({
    manga,
    isRefreshing,
}: {
    manga: Pick<MangaScreenFieldsFragment, 'id' | 'firstUnreadChapter' | 'chapters' | 'unreadCount' | 'downloadCount'>;
    isRefreshing: boolean;
}) => {
    const { t } = useTranslation();
    const { appBarHeight } = useNavBarContext();

    const isMobileWidth = MediaQuery.useIsBelowWidth('md');

    const [chapterListHeaderHeight, setChapterListHeaderHeight] = useState(50);
    const [chapterListHeaderRef, setChapterListHeaderRef] = useState<HTMLDivElement | null>(null);
    useResizeObserver(
        chapterListHeaderRef,
        useCallback(() => setChapterListHeaderHeight(chapterListHeaderRef?.offsetHeight ?? 0), [chapterListHeaderRef]),
    );

    const scrollbarWidth = MediaQuery.useGetScrollbarSize('width');

    const options = useChapterListOptions(manga);
    const updateOption = updateChapterListOptions(manga, (e) =>
        makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
    );
    const {
        data: chaptersData,
        loading: isLoading,
        error,
        refetch,
    } = requestManager.useGetMangaChapters<GetChaptersMangaQuery, GetChaptersMangaQueryVariables>(
        GET_CHAPTERS_MANGA,
        manga.id,
        { notifyOnNetworkStatusChange: true },
    );
    const chapters = useMemo(() => chaptersData?.chapters.nodes ?? [], [chaptersData?.chapters.nodes]);

    const visibleChapters = useMemo(() => filterAndSortChapters(chapters, options), [chapters, options]);
    const visibleChapterIds = useMemo(() => Chapters.getIds(visibleChapters), [visibleChapters]);
    const missingChapterCount = useMemo(() => Chapters.getMissingCount(visibleChapters), [visibleChapters]);

    const noChaptersFound = chapters.length === 0;
    const noChaptersMatchingFilter = !noChaptersFound && visibleChapters.length === 0;

    const {
        areNoItemsSelected,
        areAllItemsSelected,
        selectedItemIds,
        handleSelectAll,
        handleSelection,
        clearSelection,
    } = useSelectableCollection(visibleChapterIds.length, { itemIds: visibleChapterIds, currentKey: 'default' });

    const onSelect = useCallback(
        (id: number, selected: boolean, selectRange?: boolean) => handleSelection(id, selected, { selectRange }),
        [handleSelection],
    );

    if (isLoading || (noChaptersFound && isRefreshing)) {
        return (
            <Stack sx={{ justifyContent: 'center', alignItems: 'center', position: 'relative', flexGrow: 1 }}>
                <LoadingPlaceholder />
            </Stack>
        );
    }

    if (error) {
        return (
            <Stack sx={{ justifyContent: 'center', position: 'relative', flexGrow: 1 }}>
                <EmptyViewAbsoluteCentered
                    message={t('global.error.label.failed_to_load_data')}
                    messageExtra={getErrorMessage(error)}
                    retry={() => refetch().catch(defaultPromiseErrorHandler('ChapterList::refetch'))}
                />
            </Stack>
        );
    }

    return (
        <>
            <Stack direction="column" sx={{ position: 'relative', flexBasis: '60%' }}>
                <ChapterListHeader
                    ref={setChapterListHeaderRef}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    scrollbarWidth={scrollbarWidth}
                >
                    <Stack>
                        <Typography variant="h5" component="h3">
                            {t('chapter.value', { count: visibleChapters.length })}
                        </Typography>
                        {!!missingChapterCount && (
                            <Typography variant="body2" color="warning">
                                {`${t('chapter.missing', {
                                    count: missingChapterCount,
                                })}`}
                            </Typography>
                        )}
                    </Stack>

                    <Stack direction="row">
                        {areNoItemsSelected && (
                            <ChaptersToolbarMenu
                                mangaId={manga.id}
                                options={options}
                                updateOption={updateOption}
                                chapters={visibleChapters}
                                scanlators={Chapters.getScanlators(chapters)}
                                excludeScanlators={options.excludedScanlators}
                            />
                        )}
                        {!!visibleChapterIds.length && (
                            <SelectableCollectionSelectAll
                                areAllItemsSelected={areAllItemsSelected}
                                areNoItemsSelected={areNoItemsSelected}
                                onChange={(checked) => handleSelectAll(checked, checked ? visibleChapterIds : [])}
                            />
                        )}
                    </Stack>
                </ChapterListHeader>

                {noChaptersFound && <EmptyViewAbsoluteCentered message={t('chapter.error.label.no_chapter_found')} />}
                {noChaptersMatchingFilter && (
                    <EmptyViewAbsoluteCentered message={t('chapter.error.label.no_matches')} />
                )}

                <StyledVirtuoso
                    persistKey={`manga-${manga.id}-chapter-list`}
                    topOffset={appBarHeight + chapterListHeaderHeight}
                    style={{
                        // override Virtuoso default values and set them with class
                        height: 'undefined',
                    }}
                    components={{ Footer: () => <Box sx={{ paddingBottom: DEFAULT_FULL_FAB_HEIGHT }} /> }}
                    totalCount={visibleChapters.length}
                    computeItemKey={(index) => visibleChapters[index].id}
                    itemContent={(index: number) => (
                        <ChapterListCard
                            index={index}
                            isSortDesc={options.reverse}
                            chapters={visibleChapters}
                            selected={!areNoItemsSelected ? selectedItemIds.includes(visibleChapters[index].id) : null}
                            showChapterNumber={options.showChapterNumber}
                            onSelect={onSelect}
                        />
                    )}
                    useWindowScroll={isMobileWidth}
                    overscan={window.innerHeight * 0.5}
                />
            </Stack>
            <ChapterListFAB
                selectedChapters={selectedItemIds
                    .map((id) => chapters.find((chapter) => chapter.id === id))
                    .filter((chapter) => chapter != null)}
                firstUnreadChapter={manga.firstUnreadChapter}
                onFABMenuClose={clearSelection}
            />
        </>
    );
};
