/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Chip, { ChipProps } from '@mui/material/Chip';
import Tab from '@mui/material/Tab';
import { styled } from '@mui/material/styles';
import { useCallback, useMemo, useState } from 'react';
import { useQueryParam, NumberParam, StringParam } from 'use-query-params';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { TabPanel } from '@/base/components/tabs/TabPanel.tsx';
import { LibraryToolbarMenu } from '@/features/library/components/LibraryToolbarMenu.tsx';
import { LibraryMangaGrid } from '@/features/library/components/LibraryMangaGrid.tsx';
import { AppbarSearch } from '@/base/components/AppbarSearch.tsx';
import { UpdateChecker } from '@/features/updates/components/UpdateChecker.tsx';
import { useSelectableCollection } from '@/base/collection/hooks/useSelectableCollection.ts';
import { SelectableCollectionSelectMode } from '@/base/collection/components/SelectableCollectionSelectMode.tsx';
import { useGetVisibleLibraryMangas } from '@/features/library/hooks/useGetVisibleLibraryMangas.ts';
import { SelectionFAB } from '@/base/collection/components/SelectionFAB.tsx';
import { MangaActionMenuItems } from '@/features/manga/components/MangaActionMenuItems.tsx';
import { TabsMenu } from '@/base/components/tabs/TabsMenu.tsx';
import { TabsWrapper } from '@/base/components/tabs/TabsWrapper.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import {
    GetCategoriesLibraryQuery,
    GetCategoriesLibraryQueryVariables,
    GetLibraryMangaCountQuery,
    GetLibraryMangaCountQueryVariables,
    MangaChapterStatFieldsFragment,
    MangaType,
} from '@/lib/graphql/generated/graphql.ts';
import { GET_CATEGORIES_LIBRARY } from '@/lib/graphql/category/CategoryQuery.ts';
import { Mangas } from '@/features/manga/services/Mangas.ts';
import { MANGA_CHAPTER_STAT_FIELDS } from '@/lib/graphql/manga/MangaFragments.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { GET_LIBRARY_MANGA_COUNT } from '@/lib/graphql/manga/MangaQuery.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { useAppAction } from '@/features/navigation-bar/hooks/useAppAction.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { SearchParam } from '@/base/Base.types.ts';

const TitleWithSizeTag = styled('span')({
    display: 'flex',
    alignItems: 'center',
});

const TitleSizeTag = ({ sx, ...props }: ChipProps) => (
    <Chip {...props} size="small" sx={{ ...sx, marginLeft: '5px' }} />
);

export function Library() {
    const { t } = useTranslation();

    const {
        settings: { showTabSize },
    } = useMetadataServerSettings();

    const {
        data: categoriesResponse,
        error: tabsError,
        loading: areCategoriesLoading,
        refetch: refetchCategories,
    } = requestManager.useGetCategories<GetCategoriesLibraryQuery, GetCategoriesLibraryQueryVariables>(
        GET_CATEGORIES_LIBRARY,
        {
            notifyOnNetworkStatusChange: true,
        },
    );
    const tabsData = categoriesResponse?.categories.nodes.filter(
        (category) => category.id !== 0 || (category.id === 0 && category.mangas.totalCount),
    );
    const tabs = tabsData ?? [];

    const librarySizeResponse = requestManager.useGetMangas<
        GetLibraryMangaCountQuery,
        GetLibraryMangaCountQueryVariables
    >(GET_LIBRARY_MANGA_COUNT, {});

    const librarySize = librarySizeResponse.data?.mangas.totalCount ?? 0;

    const [tabSearchParam, setTabSearchParam] = useQueryParam(SearchParam.TAB, NumberParam);
    const [query] = useQueryParam(SearchParam.QUERY, StringParam);

    const activeTab: (typeof tabs)[number] | undefined = tabs.find((tab) => tab.id === tabSearchParam) ?? tabs[0];

    const {
        data: categoryMangaResponse,
        error: mangaError,
        loading: mangaLoading,
        refetch: refetchCategoryMangas,
    } = requestManager.useGetCategoryMangas(activeTab?.id, { skip: !activeTab, notifyOnNetworkStatusChange: true });
    const categoryMangas = categoryMangaResponse?.mangas.nodes ?? [];
    const {
        visibleMangas: mangas,
        showFilteredOutMessage,
        filterKey,
    } = useGetVisibleLibraryMangas(categoryMangas, activeTab);

    const retryFetchCategoryMangas = useCallback(
        () => refetchCategoryMangas().catch(defaultPromiseErrorHandler('Library::refetchCategoryMangas')),
        [refetchCategoryMangas, activeTab],
    );

    const mangaIds = useMemo(() => mangas.map((manga) => manga.id), [mangas]);

    const [isSelectModeActive, setIsSelectModeActive] = useState(false);
    const {
        areNoItemsForKeySelected: areNoItemsSelected,
        areAllItemsForKeySelected: areAllItemsSelected,
        selectedItemIds,
        handleSelectAll,
        handleSelection,
        clearSelection,
    } = useSelectableCollection<MangaType['id'], string>(mangas.length, {
        itemIds: mangaIds,
        currentKey: activeTab?.id.toString(),
    });

    const handleSelect: typeof handleSelection = useCallback(
        (id, selected, selectOptions) => {
            setIsSelectModeActive(!!(selectedItemIds.length + (selected ? 1 : -1)));
            handleSelection(id, selected, selectOptions);
        },
        [setIsSelectModeActive, handleSelection],
    );

    const selectedMangas = useMemo(
        () =>
            selectedItemIds
                .map((id) =>
                    Mangas.getFromCache<MangaChapterStatFieldsFragment>(
                        id,
                        MANGA_CHAPTER_STAT_FIELDS,
                        'MANGA_CHAPTER_STAT_FIELDS',
                    ),
                )
                .filter((manga) => !!manga),
        [selectedItemIds.length, mangas],
    );

    const selectionFab = useMemo(() => {
        if (!isSelectModeActive) {
            return null;
        }

        return (
            <SelectionFAB selectedItemsCount={selectedItemIds.length} title="manga.title">
                {(handleClose, setHideMenu) => (
                    <MangaActionMenuItems
                        selectedMangas={selectedMangas}
                        onClose={() => {
                            handleClose();
                            setIsSelectModeActive(false);
                            clearSelection();
                        }}
                        setHideMenu={setHideMenu}
                    />
                )}
            </SelectionFAB>
        );
    }, [isSelectModeActive, selectedMangas]);

    const triggerGlobalSearchButton = useMemo(
        () =>
            !!query && (
                <Box sx={{ p: 2 }}>
                    <Button
                        size="large"
                        component={Link}
                        to={AppRoutes.sources.childRoutes.searchAll.path(query)}
                        sx={{ textTransform: 'none', width: '100%' }}
                    >
                        {t('library.action.label.search_globally', { query })}
                    </Button>
                </Box>
            ),
        [query],
    );

    useAppTitle(
        <TitleWithSizeTag>
            Manga
            {showTabSize && <TitleSizeTag sx={{ color: 'inherit' }} label={librarySize} />}
        </TitleWithSizeTag>,
        'Manga',
        [showTabSize, librarySize],
    );
    useAppAction(
        <>
            {!isSelectModeActive && activeTab && (
                <>
                    <AppbarSearch />
                    <LibraryToolbarMenu category={activeTab} />
                    <UpdateChecker categoryId={activeTab?.id} />
                </>
            )}
            {!!mangas.length && (
                <SelectableCollectionSelectMode
                    isActive={isSelectModeActive}
                    areAllItemsSelected={areAllItemsSelected}
                    areNoItemsSelected={areNoItemsSelected}
                    onSelectAll={(selectAll) =>
                        handleSelectAll(selectAll, [...new Set(mangas.map((manga) => manga.id))])
                    }
                    onModeChange={(checked) => {
                        setIsSelectModeActive(checked);

                        if (checked) {
                            handleSelectAll(true, [...new Set(mangas.map((manga) => manga.id))]);
                        } else {
                            tabs.forEach((tab) => handleSelectAll(false, [], tab.id.toString()));
                        }
                    }}
                />
            )}
        </>,
        [isSelectModeActive, areNoItemsSelected, areAllItemsSelected, activeTab, mangas.length],
    );

    const handleTabChange = (newTab: number) => {
        setTabSearchParam(newTab);
    };

    if (tabsError != null || librarySizeResponse.error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={tabsError?.message ?? librarySizeResponse.error?.message}
                retry={() => {
                    if (tabsError) {
                        refetchCategories().catch(defaultPromiseErrorHandler('Library::refetchCategories'));
                    }

                    if (librarySizeResponse.error) {
                        librarySizeResponse.refetch().catch(defaultPromiseErrorHandler('Library::refetchLibrarySize'));
                    }
                }}
            />
        );
    }

    if (areCategoriesLoading || librarySizeResponse.loading) {
        return <LoadingPlaceholder />;
    }

    if (tabs.length === 0) {
        return <EmptyViewAbsoluteCentered message={t('library.error.label.empty')} />;
    }

    if (tabs.length === 1) {
        return (
            <>
                {triggerGlobalSearchButton}
                <LibraryMangaGrid
                    // the key needs to include filters and query to force a re-render of the virtuoso grid to prevent https://github.com/petyosi/react-virtuoso/issues/1242
                    key={filterKey}
                    mangas={mangas}
                    message={mangaError ? t('manga.error.label.request_failure') : t('library.error.label.empty')}
                    messageExtra={mangaError?.message}
                    isLoading={mangaLoading}
                    selectedMangaIds={selectedItemIds}
                    isSelectModeActive={isSelectModeActive}
                    handleSelection={handleSelect}
                    showFilteredOutMessage={!mangaError && showFilteredOutMessage}
                    retry={mangaError && retryFetchCategoryMangas}
                />
                {selectionFab}
            </>
        );
    }

    return (
        <TabsWrapper>
            <TabsMenu value={activeTab.id} onChange={(e, newTab) => handleTabChange(newTab)}>
                {tabs.map((tab) => (
                    <Tab
                        sx={{ flexGrow: 1, maxWidth: 'unset' }}
                        key={tab.id}
                        label={
                            <TitleWithSizeTag>
                                {tab.name}
                                {showTabSize ? <TitleSizeTag label={tab.mangas.totalCount} /> : null}
                            </TitleWithSizeTag>
                        }
                        value={tab.id}
                    />
                ))}
            </TabsMenu>
            {triggerGlobalSearchButton}
            {tabs.map((tab) => (
                <TabPanel key={tab.order} index={tab.order} currentIndex={activeTab.order}>
                    {tab === activeTab && (
                        <LibraryMangaGrid
                            // the key needs to include filters and query to force a re-render of the virtuoso grid to prevent https://github.com/petyosi/react-virtuoso/issues/1242
                            key={filterKey}
                            mangas={mangas}
                            message={
                                mangaError ? t('manga.error.label.request_failure') : t('category.error.label.empty')
                            }
                            messageExtra={mangaError?.message}
                            isLoading={mangaLoading}
                            selectedMangaIds={selectedItemIds}
                            isSelectModeActive={isSelectModeActive}
                            handleSelection={handleSelect}
                            showFilteredOutMessage={!mangaError && showFilteredOutMessage}
                            retry={mangaError && retryFetchCategoryMangas}
                        />
                    )}
                </TabPanel>
            ))}
            {selectionFab}
        </TabsWrapper>
    );
}
