/*
 * Copyright (C) Contributors to the Manatan project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useQueryParam, StringParam } from 'use-query-params';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { useAppAction } from '@/features/navigation-bar/hooks/useAppAction.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { AnimeGridCard } from '@/features/anime/components/AnimeGridCard.tsx';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { AppbarSearch } from '@/base/components/AppbarSearch.tsx';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { SearchParam } from '@/base/Base.types.ts';
import { SelectableCollectionSelectMode } from '@/base/collection/components/SelectableCollectionSelectMode.tsx';
import { useSelectableCollection } from '@/base/collection/hooks/useSelectableCollection.ts';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { useResizeObserver } from '@/base/hooks/useResizeObserver.tsx';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';

export const AnimeLibrary = () => {
    const { t } = useTranslation();
    const { data, loading, error, refetch } = requestManager.useGetAnimeLibrary({ notifyOnNetworkStatusChange: true });
    type AnimeLibraryEntry = {
        id: number;
        title: string;
        thumbnailUrl?: string | null;
        inLibrary?: boolean;
        url?: string | null;
        inLibraryAt?: number | null;
    };
    const animes = useMemo<AnimeLibraryEntry[]>(() => data?.animes.nodes ?? [], [data?.animes.nodes]);
    const [query] = useQueryParam(SearchParam.QUERY, StringParam);
    const [sort, setSort] = useLocalStorage('anime-library-sort', 'addedDesc');
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [isSelectModeActive, setIsSelectModeActive] = useState(false);
    const { navBarWidth } = useNavBarContext();
    const {
        settings: { mangaGridItemWidth },
    } = useMetadataServerSettings();
    const gridWrapperRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState(
        gridWrapperRef.current?.offsetWidth ?? Math.max(0, document.documentElement.offsetWidth - navBarWidth),
    );

    const filteredAnimes = useMemo(() => {
        const normalizedQuery = query?.trim().toLowerCase() ?? '';
        const result = normalizedQuery
            ? animes.filter((anime: AnimeLibraryEntry) => anime.title.toLowerCase().includes(normalizedQuery))
            : animes;

        return [...result].sort((a: AnimeLibraryEntry, b: AnimeLibraryEntry) => {
            switch (sort) {
                case 'titleAsc':
                    return a.title.localeCompare(b.title);
                case 'titleDesc':
                    return b.title.localeCompare(a.title);
                case 'addedAsc':
                    return (a.inLibraryAt ?? 0) - (b.inLibraryAt ?? 0);
                case 'addedDesc':
                default:
                    return (b.inLibraryAt ?? 0) - (a.inLibraryAt ?? 0);
            }
        });
    }, [animes, query, sort]);

    const animeIds = useMemo(() => filteredAnimes.map((anime) => anime.id), [filteredAnimes]);
    const {
        areNoItemsForKeySelected,
        areAllItemsForKeySelected,
        selectedItemIds,
        handleSelectAll,
        handleSelection,
        clearSelection,
    } = useSelectableCollection<number, string>(filteredAnimes.length, {
        itemIds: animeIds,
        currentKey: 'anime-library',
    });

    const handleSelect = useCallback(
        (id: number, selected: boolean, isShiftKey?: boolean) => {
            setIsSelectModeActive(!!(selectedItemIds.length + (selected ? 1 : -1)));
            handleSelection(id, selected, { selectRange: isShiftKey });
        },
        [handleSelection, selectedItemIds.length],
    );

    useResizeObserver(
        gridWrapperRef,
        useCallback(() => {
            const gridWidth = gridWrapperRef.current?.offsetWidth;
            setDimensions(gridWidth ?? document.documentElement.offsetWidth - navBarWidth);
        }, [navBarWidth]),
    );

    const gridColumns = Math.max(1, Math.ceil(dimensions / mangaGridItemWidth));

    useAppTitle('Anime');
    useAppAction(
        <>
            <AppbarSearch />
            <CustomTooltip title={t('chapter.action.filter_and_sort.label')}>
                <IconButton onClick={(event) => setMenuAnchor(event.currentTarget)} color="inherit">
                    <FilterListIcon />
                </IconButton>
            </CustomTooltip>
            <CustomTooltip title={t('global.button.refresh')}>
                <IconButton
                    color="inherit"
                    onClick={() => refetch()}
                >
                    <RefreshIcon />
                </IconButton>
            </CustomTooltip>
            {!!filteredAnimes.length && (
                <SelectableCollectionSelectMode
                    isActive={isSelectModeActive}
                    areAllItemsSelected={areAllItemsForKeySelected}
                    areNoItemsSelected={areNoItemsForKeySelected}
                    onSelectAll={(selectAll) => handleSelectAll(selectAll, animeIds)}
                    onModeChange={(checked) => {
                        setIsSelectModeActive(checked);
                        if (checked) {
                            handleSelectAll(true, animeIds);
                        } else {
                            handleSelectAll(false, [], 'anime-library');
                            clearSelection();
                        }
                    }}
                />
            )}
        </>,
        [filteredAnimes.length, isSelectModeActive, areAllItemsForKeySelected, areNoItemsForKeySelected, animeIds],
    );

    if (loading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
            />
        );
    }

    if (!filteredAnimes.length) {
        return <EmptyViewAbsoluteCentered message={t('library.error.label.empty')} />;
    }

    return (
        <Stack sx={{ p: 2 }}>
            <Box
                ref={gridWrapperRef}
                sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
                    gap: 1,
                }}
            >
                {filteredAnimes.map((anime: AnimeLibraryEntry) => {
                        const thumbnailSrc = anime.thumbnailUrl
                            ? requestManager.getValidImgUrlFor(`/api/v1/anime/${anime.id}/thumbnail`)
                            : '';

                        return (
                            <Box key={anime.id}>
                                <AnimeGridCard
                                    anime={{
                                        ...anime,
                                        thumbnailUrl: thumbnailSrc,
                                    }}
                                    linkTo={AppRoutes.anime.childRoutes.details.path(anime.id)}
                                    onLibraryChange={() => refetch()}
                                    selected={isSelectModeActive ? selectedItemIds.includes(anime.id) : null}
                                    onSelect={handleSelect}
                                />
                            </Box>
                        );
                },
                )}
            </Box>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
                <MenuItem
                    selected={sort === 'addedDesc'}
                    onClick={() => {
                        setSort('addedDesc');
                        setMenuAnchor(null);
                    }}
                >
                    Recently added
                </MenuItem>
                <MenuItem
                    selected={sort === 'addedAsc'}
                    onClick={() => {
                        setSort('addedAsc');
                        setMenuAnchor(null);
                    }}
                >
                    Added date (oldest)
                </MenuItem>
                <MenuItem
                    selected={sort === 'titleAsc'}
                    onClick={() => {
                        setSort('titleAsc');
                        setMenuAnchor(null);
                    }}
                >
                    Title (A-Z)
                </MenuItem>
                <MenuItem
                    selected={sort === 'titleDesc'}
                    onClick={() => {
                        setSort('titleDesc');
                        setMenuAnchor(null);
                    }}
                >
                    Title (Z-A)
                </MenuItem>
            </Menu>
        </Stack>
    );
};
