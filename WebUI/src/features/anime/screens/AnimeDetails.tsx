/*
 * Copyright (C) Contributors to the Manatan project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Warning from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { useAppTitleAndAction } from '@/features/navigation-bar/hooks/useAppTitleAndAction.ts';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { AnimeDetailsPanel } from '@/features/anime/components/details/AnimeDetailsPanel.tsx';
import { EpisodeList } from '@/features/anime/components/EpisodeList.tsx';

type AnimeDetailsResponse = {
    id: number;
    sourceId: string;
    url: string;
    title: string;
    thumbnailUrl?: string | null;
    backgroundUrl?: string | null;
    description?: string | null;
    genre?: string[] | null;
    artist?: string | null;
    author?: string | null;
    status?: string | null;
    inLibrary: boolean;
};

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

export const AnimeDetails = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<AnimeDetailsResponse | null>(null);
    const [episodes, setEpisodes] = useState<EpisodeResponse[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);
    const [libraryUpdating, setLibraryUpdating] = useState(false);

    useEffect(() => {
        if (!id) {
            setError('Missing anime id');
            setLoading(false);
            return;
        }

        let isMounted = true;
        const isRefresh = refreshToken > 0;

        setError(null);
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        const refreshQuery = isRefresh ? '?onlineFetch=true' : '';
        const fetchDetails = requestManager.getClient().fetcher(`/api/v1/anime/${id}${refreshQuery}`);
        const fetchEpisodes = requestManager.getClient().fetcher(`/api/v1/anime/${id}/episodes${refreshQuery}`);

        Promise.all([fetchDetails, fetchEpisodes])
            .then(async ([detailsResponse, episodesResponse]) => {
                const detailsData = (await detailsResponse.json()) as AnimeDetailsResponse;
                const episodesData = (await episodesResponse.json()) as EpisodeResponse[];
                if (!isMounted) {
                    return;
                }
                setData(detailsData);
                setEpisodes(episodesData);
            })
            .catch((fetchError) => {
                if (isMounted) {
                    setError(fetchError?.message ?? t('global.error.label.failed_to_load_data'));
                }
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                    setRefreshing(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [id, refreshToken, t]);

    useAppTitleAndAction(
        data?.title ?? t('anime.title' as any),
        <Stack direction="row" sx={{ alignItems: 'center' }}>
            {error && (
                <CustomTooltip
                    title={
                        <>
                            {t('global.error.label.failed_to_load_data')}
                            <br />
                            {getErrorMessage(error)}
                        </>
                    }
                >
                    <IconButton onClick={() => setRefreshToken((prev) => prev + 1)}>
                        <Warning color="error" />
                    </IconButton>
                </CustomTooltip>
            )}
            {data && (
                <CustomTooltip title={t('global.button.refresh')}>
                    <IconButton
                        onClick={() => setRefreshToken((prev) => prev + 1)}
                        disabled={loading || refreshing}
                    >
                        <RefreshIcon />
                    </IconButton>
                </CustomTooltip>
            )}
            {(loading || refreshing) && (
                <IconButton disabled>
                    <CircularProgress size={16} />
                </IconButton>
            )}
        </Stack>,
        [data?.title, error, loading, refreshing, t],
    );

    const handleToggleLibrary = async (nextInLibrary: boolean) => {
        if (!id) {
            return;
        }

        setLibraryUpdating(true);
        try {
            const response = await requestManager.updateAnime(Number(id), { inLibrary: nextInLibrary }).response;
            const updatedAnime = response.data?.updateAnime?.anime;
            if (updatedAnime) {
                setData((current) =>
                    current
                        ? {
                              ...current,
                              inLibrary: updatedAnime.inLibrary ?? nextInLibrary,
                          }
                        : current,
                );
            }
        } catch (libraryError: any) {
            setError(libraryError?.message ?? t('global.error.label.failed_to_load_data'));
        } finally {
            setLibraryUpdating(false);
        }
    };

    if (error && !data) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
            />
        );
    }

    return (
        <Box sx={{ display: { md: 'flex' }, overflow: 'hidden' }}>
            {loading && <LoadingPlaceholder />}
            {data && (
                <AnimeDetailsPanel
                    anime={data}
                    onToggleLibrary={handleToggleLibrary}
                    isLibraryUpdating={libraryUpdating}
                />
            )}
            {data && (
                <EpisodeList
                    episodes={episodes}
                    animeId={id ?? ''}
                    isRefreshing={refreshing}
                    isLoading={loading}
                    onEpisodesUpdate={setEpisodes}
                />
            )}
        </Box>
    );
};
