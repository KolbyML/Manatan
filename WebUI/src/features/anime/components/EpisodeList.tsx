/*
 * Copyright (C) Contributors to the Manatan project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import FilterListIcon from '@mui/icons-material/FilterList';
import { styled } from '@mui/material/styles';
import { useCallback, useMemo, useState } from 'react';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { VirtuosoPersisted } from '@/lib/virtuoso/Component/VirtuosoPersisted.tsx';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { useResizeObserver } from '@/base/hooks/useResizeObserver.tsx';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { shouldForwardProp } from '@/base/utils/ShouldForwardProp.ts';
import { DEFAULT_FULL_FAB_HEIGHT } from '@/base/components/buttons/StyledFab.tsx';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { useTranslation } from 'react-i18next';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { HttpMethod } from '@/lib/requests/client/RestClient.ts';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { EpisodeCard } from '@/features/anime/components/cards/EpisodeCard.tsx';
import { EpisodeDownloadDialog } from '@/features/anime/components/actions/EpisodeDownloadDialog.tsx';

type EpisodeResponse = {
    id: number;
    name: string;
    episodeNumber: number;
    uploadDate: number;
    scanlator?: string | null;
    summary?: string | null;
    fillermark?: boolean | null;
    index: number;
    isRead: boolean;
    isDownloaded: boolean;
    realUrl?: string | null;
};

type EpisodeListHeaderProps = {
    scrollbarWidth: number;
};

const EpisodeListHeader = styled(Stack, {
    shouldForwardProp: shouldForwardProp<EpisodeListHeaderProps>(['scrollbarWidth']),
})<EpisodeListHeaderProps>(({ theme, scrollbarWidth }) => ({
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

type EpisodeFilter = 'all' | 'watched' | 'unwatched' | 'downloaded';
type EpisodeSort = 'episodeAsc' | 'episodeDesc' | 'dateAsc' | 'dateDesc';

export const EpisodeList = ({
    episodes,
    animeId,
    isRefreshing,
    isLoading,
    onEpisodesUpdate,
}: {
    episodes: EpisodeResponse[];
    animeId: string;
    isRefreshing: boolean;
    isLoading: boolean;
    onEpisodesUpdate: (updater: EpisodeResponse[] | ((episodes: EpisodeResponse[]) => EpisodeResponse[])) => void;
}) => {
    const { t } = useTranslation();
    const { appBarHeight } = useNavBarContext();
    const isMobileWidth = MediaQuery.useIsBelowWidth('md');
    const [listHeaderHeight, setListHeaderHeight] = useState(50);
    const [listHeaderRef, setListHeaderRef] = useState<HTMLDivElement | null>(null);
    const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<number[]>([]);
    const [filter, setFilter] = useLocalStorage<EpisodeFilter | 'read' | 'unread'>(
        `anime-${animeId}-episode-filter`,
        'all',
    );
    const [sort, setSort] = useLocalStorage<EpisodeSort>(`anime-${animeId}-episode-sort`, 'episodeDesc');
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [downloadTarget, setDownloadTarget] = useState<EpisodeResponse | null>(null);
    useResizeObserver(
        listHeaderRef,
        useCallback(() => setListHeaderHeight(listHeaderRef?.offsetHeight ?? 0), [listHeaderRef]),
    );

    const scrollbarWidth = MediaQuery.useGetScrollbarSize('width');
    const isSelecting = selectedEpisodeIds.length > 0;
    const resolvedFilter: EpisodeFilter =
        filter === 'read' ? 'watched' : filter === 'unread' ? 'unwatched' : filter;

    const filteredEpisodes = useMemo(() => {
        switch (resolvedFilter) {
            case 'watched':
                return episodes.filter((episode) => episode.isRead);
            case 'unwatched':
                return episodes.filter((episode) => !episode.isRead);
            case 'downloaded':
                return episodes.filter((episode) => episode.isDownloaded);
            default:
                return episodes;
        }
    }, [episodes, resolvedFilter]);
    const visibleEpisodes = useMemo(() => {
        const sorted = [...filteredEpisodes];
        sorted.sort((a, b) => {
            const episodeNumberA = a.episodeNumber || a.index;
            const episodeNumberB = b.episodeNumber || b.index;
            switch (sort) {
                case 'episodeAsc':
                    return episodeNumberA - episodeNumberB;
                case 'episodeDesc':
                    return episodeNumberB - episodeNumberA;
                case 'dateAsc':
                    return a.uploadDate - b.uploadDate;
                case 'dateDesc':
                    return b.uploadDate - a.uploadDate;
                default:
                    return episodeNumberB - episodeNumberA;
            }
        });
        return sorted;
    }, [filteredEpisodes, sort]);
    const episodeCount = visibleEpisodes.length;
    const totalCount = episodes.length;
    const episodeIds = useMemo(() => visibleEpisodes.map((episode) => episode.id), [visibleEpisodes]);
    const areAllSelected = episodeIds.length > 0 && episodeIds.every((id) => selectedEpisodeIds.includes(id));
    const areSomeSelected = selectedEpisodeIds.length > 0 && !areAllSelected;
    const selectionTargetIds = selectedEpisodeIds.length ? selectedEpisodeIds : episodeIds;

    const isEmpty = episodeCount === 0;
    const shouldShowLoading = (isLoading || isRefreshing) && isEmpty;

    if (shouldShowLoading) {
        return (
            <Stack sx={{ justifyContent: 'center', alignItems: 'center', position: 'relative', flexGrow: 1 }}>
                <LoadingPlaceholder />
            </Stack>
        );
    }

    if (isEmpty) {
        return (
            <Stack sx={{ justifyContent: 'center', position: 'relative', flexGrow: 1 }}>
                <EmptyViewAbsoluteCentered message="No episodes found." />
            </Stack>
        );
    }

    const updateEpisodes = async (change: { isRead?: boolean; isDownloaded?: boolean }, ids?: number[]) => {
        const targetIds = ids ?? selectionTargetIds;
        if (!targetIds.length || isActionLoading) {
            return;
        }

        setIsActionLoading(true);
        try {
            await requestManager.getClient().fetcher('/api/v1/anime/episode/batch', {
                httpMethod: HttpMethod.POST,
                data: {
                    episodeIds: targetIds,
                    change,
                },
                checkResponseIsJson: false,
            });
            onEpisodesUpdate((currentEpisodes) =>
                currentEpisodes.map((episode) => {
                    if (!targetIds.includes(episode.id)) {
                        return episode;
                    }
                    return {
                        ...episode,
                        isRead: change.isRead ?? episode.isRead,
                        isDownloaded: change.isDownloaded ?? episode.isDownloaded,
                    };
                }),
            );
            if (!ids) {
                setSelectedEpisodeIds([]);
            }
        } catch {
            // handled by global error boundary
        } finally {
            setIsActionLoading(false);
        }
    };

    const deleteEpisodeDownloads = async (episodeIndex: number, episodeId: number) => {
        if (isActionLoading) {
            return;
        }
        setIsActionLoading(true);
        try {
            await requestManager.getClient().fetcher(`/api/v1/anime/${animeId}/episode/${episodeIndex}/download`, {
                httpMethod: HttpMethod.DELETE,
                checkResponseIsJson: false,
            });
            onEpisodesUpdate((currentEpisodes) =>
                currentEpisodes.map((episode) =>
                    episode.id === episodeId ? { ...episode, isDownloaded: false } : episode,
                ),
            );
        } catch {
            // handled by global error boundary
        } finally {
            setIsActionLoading(false);
        }
    };

    const markPreviousWatched = (episode: EpisodeResponse) => {
        const sortedEpisodes = [...episodes].sort((a, b) => b.index - a.index);
        const currentIndex = sortedEpisodes.findIndex((entry) => entry.id === episode.id);
        if (currentIndex < 0) {
            return;
        }
        const previousIds = sortedEpisodes.slice(currentIndex + 1).filter((entry) => !entry.isRead).map((entry) => entry.id);
        if (!previousIds.length) {
            return;
        }
        updateEpisodes({ isRead: true }, previousIds);
    };

    const handleSelect = (episodeId: number, selected: boolean, _isShiftKey?: boolean) => {
        setSelectedEpisodeIds((current) => {
            if (selected) {
                return current.includes(episodeId) ? current : [...current, episodeId];
            }
            return current.filter((id) => id !== episodeId);
        });
    };

    const handleSelectAll = (checked: boolean) => {
        setSelectedEpisodeIds(checked ? episodeIds : []);
    };

    return (
        <Stack direction="column" sx={{ position: 'relative', flexBasis: '60%' }}>
            <EpisodeListHeader
                ref={setListHeaderRef}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                scrollbarWidth={scrollbarWidth}
            >
                <Stack>
                    <Typography variant="h5" component="h3">
                        Episodes ({episodeCount}{totalCount !== episodeCount ? `/${totalCount}` : ''})
                    </Typography>
                </Stack>
                <Stack direction="row" alignItems="center">
                    <CustomTooltip title="Mark all watched">
                        <span>
                            <IconButton
                                onClick={() => updateEpisodes({ isRead: true })}
                                disabled={isActionLoading || !selectionTargetIds.length}
                                color="inherit"
                            >
                                <DoneAllIcon />
                            </IconButton>
                        </span>
                    </CustomTooltip>
                    <CustomTooltip title={t('chapter.action.filter_and_sort.label')}>
                        <span>
                            <IconButton onClick={(event) => setMenuAnchor(event.currentTarget)} color="inherit">
                                <FilterListIcon />
                            </IconButton>
                        </span>
                    </CustomTooltip>
                    <CustomTooltip title={t('global.button.select_all')}>
                        <span>
                            <Checkbox
                                sx={{
                                    padding: '8px',
                                    color: 'inherit',
                                    '&.Mui-checked, &.MuiCheckbox-indeterminate': {
                                        color: 'inherit',
                                    },
                                }}
                                checked={areAllSelected}
                                indeterminate={areSomeSelected}
                                onChange={(_, checked) => handleSelectAll(checked)}
                            />
                        </span>
                    </CustomTooltip>
                </Stack>
            </EpisodeListHeader>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
                <MenuItem
                    selected={resolvedFilter === 'all'}
                    onClick={() => {
                        setFilter('all');
                        setMenuAnchor(null);
                    }}
                >
                    All episodes
                </MenuItem>
                <MenuItem
                    selected={resolvedFilter === 'unwatched'}
                    onClick={() => {
                        setFilter('unwatched');
                        setMenuAnchor(null);
                    }}
                >
                    Unwatched episodes
                </MenuItem>
                <MenuItem
                    selected={resolvedFilter === 'watched'}
                    onClick={() => {
                        setFilter('watched');
                        setMenuAnchor(null);
                    }}
                >
                    Watched episodes
                </MenuItem>
                <MenuItem
                    selected={resolvedFilter === 'downloaded'}
                    onClick={() => {
                        setFilter('downloaded');
                        setMenuAnchor(null);
                    }}
                >
                    Downloaded episodes
                </MenuItem>
                <Divider />
                <MenuItem
                    selected={sort === 'episodeDesc'}
                    onClick={() => {
                        setSort('episodeDesc');
                        setMenuAnchor(null);
                    }}
                >
                    Episode number (desc)
                </MenuItem>
                <MenuItem
                    selected={sort === 'episodeAsc'}
                    onClick={() => {
                        setSort('episodeAsc');
                        setMenuAnchor(null);
                    }}
                >
                    Episode number (asc)
                </MenuItem>
                <MenuItem
                    selected={sort === 'dateDesc'}
                    onClick={() => {
                        setSort('dateDesc');
                        setMenuAnchor(null);
                    }}
                >
                    Upload date (desc)
                </MenuItem>
                <MenuItem
                    selected={sort === 'dateAsc'}
                    onClick={() => {
                        setSort('dateAsc');
                        setMenuAnchor(null);
                    }}
                >
                    Upload date (asc)
                </MenuItem>
            </Menu>
            <StyledVirtuoso
                persistKey={`anime-${animeId}-episode-list`}
                topOffset={appBarHeight + listHeaderHeight}
                style={{ height: 'undefined' }}
                components={{ Footer: () => <Box sx={{ paddingBottom: DEFAULT_FULL_FAB_HEIGHT }} /> }}
                totalCount={episodeCount}
                computeItemKey={(index) => visibleEpisodes[index].id}
                itemContent={(index: number) => {
                    const episode = visibleEpisodes[index];
                    return (
                        <EpisodeCard
                            episode={episode}
                            animeId={animeId}
                            selected={isSelecting ? selectedEpisodeIds.includes(episode.id) : null}
                            onSelect={handleSelect}
                            onDownload={() => setDownloadTarget(episode)}
                            onDeleteDownload={() => deleteEpisodeDownloads(episode.index, episode.id)}
                            onMarkWatched={() => updateEpisodes({ isRead: true }, [episode.id])}
                            onMarkUnwatched={() => updateEpisodes({ isRead: false }, [episode.id])}
                            onMarkPreviousWatched={() => markPreviousWatched(episode)}
                        />
                    );
                }}
                useWindowScroll={isMobileWidth}
                overscan={window.innerHeight * 0.5}
            />
            {downloadTarget && (
                <EpisodeDownloadDialog
                    open={!!downloadTarget}
                    animeId={Number(animeId)}
                    episodeIndex={downloadTarget.index}
                    episodeName={downloadTarget.name || `Episode ${downloadTarget.episodeNumber || downloadTarget.index}`}
                    onClose={() => setDownloadTarget(null)}
                    onDownloaded={() =>
                        onEpisodesUpdate((currentEpisodes) =>
                            currentEpisodes.map((episode) =>
                                episode.id === downloadTarget.id
                                    ? { ...episode, isDownloaded: true }
                                    : episode,
                            ),
                        )
                    }
                />
            )}
        </Stack>
    );
};
