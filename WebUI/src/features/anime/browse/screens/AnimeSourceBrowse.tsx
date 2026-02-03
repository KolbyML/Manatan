/*
 * Copyright (C) Contributors to the Manatan project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { AnimeGridCard } from '@/features/anime/components/AnimeGridCard.tsx';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { AppbarSearch } from '@/base/components/AppbarSearch.tsx';
import { SourceGridLayout } from '@/features/source/components/SourceGridLayout.tsx';
import { useAppTitleAndAction } from '@/features/navigation-bar/hooks/useAppTitleAndAction.ts';
import { IconWebView } from '@/assets/icons/IconWebView.tsx';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { GridLayout } from '@/base/Base.types.ts';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { AnimeListCard } from '@/features/anime/components/AnimeListCard.tsx';
import { updateMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';

export enum AnimeSourceContentType {
    POPULAR = 'POPULAR',
    LATEST = 'LATEST',
    SEARCH = 'SEARCH',
}

type AnimeSourceBrowseResult = {
    id: number;
    title: string;
    thumbnailUrl?: string | null;
    sourceId: string;
    url?: string | null;
    inLibrary?: boolean;
};

export const AnimeSourceBrowse = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { sourceId } = useParams<{ sourceId: string }>();
    const [searchParams] = useSearchParams();
    const query = searchParams.get('query') ?? '';

    const locationState = (location.state ?? {}) as {
        contentType?: AnimeSourceContentType;
    };
    const initialContentType = locationState.contentType ?? AnimeSourceContentType.POPULAR;

    const [contentType, setContentType] = useState(initialContentType);
    const [animeEntries, setAnimeEntries] = useState<AnimeSourceBrowseResult[]>([]);
    const [gridLayout] = useLocalStorage('source-grid-layout', GridLayout.Compact);

    const {
        data: sourceData,
        loading: sourceLoading,
        error: sourceError,
    } = requestManager.useGetAnimeSourceBrowse(sourceId ?? '-1', { notifyOnNetworkStatusChange: true });
    const [fetchSourceAnimes, { data, loading: listLoading, error: listError }] =
        requestManager.useGetSourceAnimes();

    useEffect(() => {
        setContentType(initialContentType);
    }, [sourceId, initialContentType]);

    useEffect(() => {
        if (!sourceId) {
            navigate(AppRoutes.browse.path());
            return;
        }
        fetchSourceAnimes({
            variables: {
                input: {
                    source: sourceId,
                    type: contentType,
                    page: 1,
                    query: contentType === AnimeSourceContentType.SEARCH ? query : undefined,
                },
            },
        }).catch(() => {});
    }, [sourceId, contentType, query]);

    useEffect(() => {
        if (!query || contentType === AnimeSourceContentType.SEARCH) {
            return;
        }
        setContentType(AnimeSourceContentType.SEARCH);
    }, [query, contentType]);

    useEffect(() => {
        if (!sourceId) {
            return;
        }
        updateMetadataServerSettings('lastUsedSourceId', sourceId).catch(
            defaultPromiseErrorHandler('AnimeSourceBrowse::setLastUsedSourceId'),
        );
    }, [sourceId]);

    const source = sourceData?.animeSource;
    const animes = useMemo(() => data?.fetchSourceAnime?.animes ?? [], [data]);
    const isLoading = sourceLoading || listLoading;
    const error = sourceError ?? listError;

    useEffect(() => {
        setAnimeEntries(animes as AnimeSourceBrowseResult[]);
    }, [animes]);

    useAppTitleAndAction(
        source?.displayName ?? t('source.title_one'),
        <>
            <AppbarSearch />
            <SourceGridLayout />
            <CustomTooltip title={t('global.button.open_webview')} disabled={!source?.baseUrl}>
                <IconButton
                    disabled={!source?.baseUrl}
                    href={source?.baseUrl ? requestManager.getWebviewUrl(source.baseUrl) : ''}
                    rel="noreferrer"
                    target="_blank"
                    color="inherit"
                >
                    <IconWebView />
                </IconButton>
            </CustomTooltip>
        </>,
        [source],
    );

    if (isLoading) {
        return <LoadingPlaceholder />;
    }

    if (error || !source) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
            />
        );
    }

    if (!animeEntries.length) {
        return <EmptyViewAbsoluteCentered message="No anime found in this source." />;
    }

    return (
        <Stack gap={2} sx={{ p: 2 }}>
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h5" component="h1">
                    {source.displayName}
                </Typography>
                <Button
                    size="small"
                    variant={contentType === AnimeSourceContentType.POPULAR ? 'contained' : 'outlined'}
                    onClick={() => setContentType(AnimeSourceContentType.POPULAR)}
                >
                    {t('global.button.popular')}
                </Button>
                {source.supportsLatest && (
                    <Button
                        size="small"
                        variant={contentType === AnimeSourceContentType.LATEST ? 'contained' : 'outlined'}
                        onClick={() => setContentType(AnimeSourceContentType.LATEST)}
                    >
                        {t('global.button.latest')}
                    </Button>
                )}
                <Button
                    size="small"
                    variant={contentType === AnimeSourceContentType.SEARCH ? 'contained' : 'outlined'}
                    onClick={() => setContentType(AnimeSourceContentType.SEARCH)}
                >
                    {t('global.button.search' as any)}
                </Button>
            </Stack>
            <Grid container spacing={1}>
                {animeEntries.map((anime: AnimeSourceBrowseResult) => {
                    const thumbnailSrc = anime.thumbnailUrl
                        ? requestManager.getValidImgUrlFor(`/api/v1/anime/${anime.id}/thumbnail`)
                        : '';

                    return (
                        <Grid
                            key={anime.id}
                            size={gridLayout === GridLayout.List ? 12 : { xs: 6, sm: 4, md: 3, lg: 2 }}
                        >
                            {gridLayout === GridLayout.List ? (
                                <AnimeListCard
                                    anime={{
                                        ...anime,
                                        thumbnailUrl: thumbnailSrc,
                                    }}
                                    linkTo={AppRoutes.anime.childRoutes.details.path(anime.id)}
                                    mode="source"
                                    inLibraryIndicator
                                    onToggleLibrary={async () => {
                                        const nextState = !anime.inLibrary;
                                        await requestManager.updateAnime(anime.id, { inLibrary: nextState }).response;
                                        setAnimeEntries((current) =>
                                            current.map((entry) =>
                                                entry.id === anime.id ? { ...entry, inLibrary: nextState } : entry,
                                            ),
                                        );
                                    }}
                                />
                            ) : (
                                <AnimeGridCard
                                    anime={{
                                        ...anime,
                                        thumbnailUrl: thumbnailSrc,
                                    }}
                                    linkTo={AppRoutes.anime.childRoutes.details.path(anime.id)}
                                    gridLayout={gridLayout}
                                    mode="source"
                                    inLibraryIndicator
                                    onLibraryChange={(nextState) => {
                                        setAnimeEntries((current) =>
                                            current.map((entry) =>
                                                entry.id === anime.id ? { ...entry, inLibrary: nextState } : entry,
                                            ),
                                        );
                                    }}
                                />
                            )}
                        </Grid>
                    );
                })}
            </Grid>
        </Stack>
    );
};
