/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { StringParam, useQueryParam } from 'use-query-params';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import PushPinIcon from '@mui/icons-material/PushPin';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useElementSize } from '@mantine/hooks';
import IconButton from '@mui/material/IconButton';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { d } from 'koration';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { AppbarSearch } from '@/base/components/AppbarSearch.tsx';
import { useDebounce } from '@/base/hooks/useDebounce.ts';
import { MangaCardProps } from '@/features/manga/Manga.types.ts';
import { EmptyView } from '@/base/components/feedback/EmptyView.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { BaseMangaGrid } from '@/features/manga/components/BaseMangaGrid.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { translateExtensionLanguage } from '@/features/extension/Extensions.utils.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { Sources } from '@/features/source/services/Sources.ts';
import {
    SourceDisplayNameInfo,
    SourceIdInfo,
    SourceLanguageInfo,
    SourceMetaInfo,
    SourceNameInfo,
} from '@/features/source/Source.types.ts';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { useAppTitleAndAction } from '@/features/navigation-bar/hooks/useAppTitleAndAction.ts';
import { getSourceMetadata } from '@/features/source/services/SourceMetadata.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';
import { MetadataBrowseSettings } from '@/features/browse/Browse.types.ts';
import { SourceLanguageSelect } from '@/features/source/components/SourceLanguageSelect.tsx';
import { SearchParam } from '@/base/Base.types.ts';

type SourceLoadingState = { isLoading: boolean; hasResults: boolean; emptySearch: boolean; error: any };
type SourceToLoadingStateMap = Map<string, SourceLoadingState>;

const compareSourceByName = (sourceA: SourceDisplayNameInfo, sourceB: SourceDisplayNameInfo): number =>
    sourceA.displayName.localeCompare(sourceB.displayName);

const compareSourcesBySearchResult = (
    sourceA: SourceIdInfo & SourceMetaInfo,
    sourceB: SourceIdInfo & SourceMetaInfo,
    sourceToFetchedStateMap: SourceToLoadingStateMap,
): -1 | 0 | 1 => {
    const isSourceAPinned = getSourceMetadata(sourceA).isPinned;
    const isSourceBPinned = getSourceMetadata(sourceB).isPinned;

    const sourceAState = sourceToFetchedStateMap.get(sourceA.id);
    const sourceBState = sourceToFetchedStateMap.get(sourceB.id);

    const isSourceAFetched = !sourceAState?.isLoading;
    const hasSourceAError = !!sourceAState?.error;
    const isSourceASearchResultEmpty = !sourceAState?.hasResults && !hasSourceAError;

    const isSourceBFetched = !sourceBState?.isLoading;
    const hasSourceBError = !!sourceBState?.error;
    const isSourceBSearchResultEmpty = !sourceBState?.hasResults && !hasSourceBError;

    if (isSourceAFetched && !isSourceBFetched) {
        return -1;
    }
    if (!isSourceAFetched && isSourceBFetched) {
        return 1;
    }

    if (isSourceASearchResultEmpty && !isSourceBSearchResultEmpty) {
        return 1;
    }
    if (isSourceBSearchResultEmpty && !isSourceASearchResultEmpty) {
        return -1;
    }

    if (!hasSourceAError && hasSourceBError) {
        return -1;
    }
    if (hasSourceAError && !hasSourceBError) {
        return 1;
    }

    if (isSourceAPinned && !isSourceBPinned) {
        return -1;
    }
    if (!isSourceAPinned && isSourceBPinned) {
        return 1;
    }

    return 0;
};
const TRIGGER_SEARCH_THRESHOLD = d(1).seconds.inWholeMilliseconds;

const SourceSearchPreview = React.memo(
    ({
        source,
        onSearchRequestFinished,
        searchString,
        emptyQuery,
        mode,
        shouldShowOnlySourcesWithResults,
    }: {
        source: SourceIdInfo & SourceDisplayNameInfo & SourceNameInfo & SourceLanguageInfo;
        onSearchRequestFinished: (source: SourceIdInfo, state: SourceLoadingState) => void;
        searchString: string | null | undefined;
        emptyQuery: boolean;
    } & Pick<MangaCardProps, 'mode'> &
        Pick<MetadataBrowseSettings, 'shouldShowOnlySourcesWithResults'>) => {
        const { t } = useTranslation();

        const { id, name, lang } = source;

        const currentSearchString = useRef(searchString);
        const currentAbortRequest = useRef<(reason: any) => void>(() => {});

        const didSearchChange = currentSearchString.current !== searchString;
        if (didSearchChange) {
            currentSearchString.current = searchString;
            currentAbortRequest.current(new Error(`SourceSearchPreview(${id}, ${name}): search string changed`));
        }

        const [refetch, results] = requestManager.useSourceSearch(id, searchString ?? '', undefined, 1, {
            skipRequest: !searchString,
            addAbortSignal: true,
        });

        const { data: searchResult, isLoading, error, abortRequest } = results[0]!;
        currentAbortRequest.current = abortRequest;

        const mangas = searchResult?.fetchSourceManga?.mangas ?? [];
        const noMangasFound = !error && !isLoading && !mangas.length;

        useEffect(() => {
            onSearchRequestFinished(source, {
                isLoading,
                hasResults: !noMangasFound,
                emptySearch: !searchString,
                error,
            });
        }, [isLoading, noMangasFound, searchString, error]);

        let errorMessage: string | undefined;
        if (error) {
            errorMessage = t('search.error.label.source_search_failed');
        } else if (noMangasFound) {
            errorMessage = t('manga.error.label.no_mangas_found');
        }

        if ((!isLoading && !searchString) || emptyQuery) {
            return null;
        }

        if (shouldShowOnlySourcesWithResults && (noMangasFound || error)) {
            return null;
        }

        return (
            <Box sx={{ pb: 2 }}>
                <Card sx={{ mb: 1 }}>
                    <CardActionArea
                        component={Link}
                        to={AppRoutes.sources.childRoutes.browse.path(id, searchString)}
                        sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <Box>
                            <Typography variant="h5">{name}</Typography>
                            <Typography variant="caption">{translateExtensionLanguage(lang)}</Typography>
                        </Box>
                        <CustomTooltip title={t('global.button.show_more')}>
                            <IconButton {...MUIUtil.preventRippleProp()}>
                                <ArrowForwardIcon />
                            </IconButton>
                        </CustomTooltip>
                    </CardActionArea>
                </Card>
                {errorMessage ? (
                    <EmptyView
                        sx={{ alignItems: 'start', height: undefined }}
                        noFaces
                        message={errorMessage}
                        messageExtra={getErrorMessage(error)}
                        retry={
                            error
                                ? () =>
                                      refetch(1).catch(
                                          defaultPromiseErrorHandler(`SourceSearchPreview(${source.id})::refetch`),
                                      )
                                : undefined
                        }
                    />
                ) : (
                    <BaseMangaGrid
                        // the key needs to include filters and query to force a re-render of the virtuoso grid to prevent https://github.com/petyosi/react-virtuoso/issues/1242
                        key={searchString}
                        gridWrapperProps={{ sx: { px: 0 } }}
                        mangas={mangas}
                        isLoading={isLoading}
                        hasNextPage={false}
                        loadMore={() => undefined}
                        horizontal
                        noFaces
                        message={errorMessage}
                        inLibraryIndicator
                        mode={mode}
                    />
                )}
            </Box>
        );
    },
);

export const SearchAll: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { pathname, state } = useLocation<{ mangaTitle?: string; shouldShowOnlyPinnedSources?: boolean }>();
    const { ref: filterHeaderRef, height: filterHeaderHeight } = useElementSize();

    const shouldShowOnlyPinnedSources = state?.shouldShowOnlyPinnedSources ?? true;
    const isMigrateMode = pathname.startsWith('/migrate/source');

    const [query] = useQueryParam(SearchParam.QUERY, StringParam);
    const searchString = useDebounce(query, TRIGGER_SEARCH_THRESHOLD);

    const { languages: shownLangs, setLanguages: setShownLangs } = Sources.useLanguages();
    const {
        settings: { showNsfw, shouldShowOnlySourcesWithResults },
    } = useMetadataServerSettings();

    const { data, loading, error, refetch } = requestManager.useGetSourceList({ notifyOnNetworkStatusChange: true });
    const sources = useMemo(() => data?.sources.nodes ?? [], [data?.sources.nodes]);

    const [sourceToLoadingStateMap, setSourceToLoadingStateMap] = useState<SourceToLoadingStateMap>(new Map());
    const debouncedSourceToLoadingStateMap = useDebounce(sourceToLoadingStateMap, 500);

    const sourceLanguages = useMemo(() => Sources.getLanguages(sources), [sources]);

    const filteredSources = useMemo(
        () =>
            Sources.filter(sources, {
                showNsfw,
                languages: shownLangs,
                keepLocalSource: true,
                pinned: shouldShowOnlyPinnedSources,
                enabled: true,
            }),
        [sources, shownLangs, shouldShowOnlyPinnedSources],
    );
    const sourcesSortedByName = useMemo(() => [...filteredSources].toSorted(compareSourceByName), [filteredSources]);
    const sourcesSortedByResult = useMemo(
        () =>
            [...sourcesSortedByName].sort((sourceA, sourceB) =>
                compareSourcesBySearchResult(sourceA, sourceB, debouncedSourceToLoadingStateMap),
            ),
        [sourcesSortedByName, debouncedSourceToLoadingStateMap],
    );

    const updateSourceLoadingState = useCallback(
        ({ id }: SourceIdInfo, loadState: SourceLoadingState) => {
            setSourceToLoadingStateMap((currentMap) => {
                const mapCopy = new Map(currentMap);
                mapCopy.set(id, loadState);
                return mapCopy;
            });
        },
        [setSourceToLoadingStateMap],
    );

    const updateMetadataSettings = createUpdateMetadataServerSettings<'shouldShowOnlySourcesWithResults'>((e) =>
        makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
    );

    useAppTitleAndAction(
        t(isMigrateMode ? 'migrate.search.title' : 'search.title.global_search', { title: state?.mangaTitle }),
        <>
            <AppbarSearch isClosable={false} />
            <SourceLanguageSelect
                selectedLanguages={shownLangs}
                setSelectedLanguages={setShownLangs}
                languages={sourceLanguages}
                sources={sources ?? []}
            />
        </>,
        [shownLangs, setShownLangs, sourceLanguages, sources],
    );

    if (loading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('SearchAll::refetch'))}
            />
        );
    }

    return (
        <Box sx={{ position: 'relative', px: 1, pb: 1 }}>
            <Stack
                ref={filterHeaderRef}
                sx={{
                    width: '100%',
                    position: 'fixed',
                    zIndex: 1,
                    flexDirection: 'row',
                    gap: 2,
                    pt: 1,
                    pb: 2,
                    background: (theme) => theme.palette.background.default,
                }}
            >
                <Stack sx={{ flexDirection: 'row', gap: 1 }}>
                    <Button
                        startIcon={<PushPinIcon />}
                        variant={shouldShowOnlyPinnedSources ? 'contained' : 'outlined'}
                        onClick={() =>
                            navigate(
                                {
                                    pathname: '',
                                    search: query ? `query=${query}` : '',
                                },
                                {
                                    replace: true,
                                    state: { ...state, shouldShowOnlyPinnedSources: true },
                                },
                            )
                        }
                    >
                        {t('global.label.pinned')}
                    </Button>
                    <Button
                        startIcon={<DoneAllIcon />}
                        variant={!shouldShowOnlyPinnedSources ? 'contained' : 'outlined'}
                        onClick={() =>
                            navigate(
                                {
                                    pathname: '',
                                    search: query ? `query=${query}` : '',
                                },
                                {
                                    replace: true,
                                    state: { ...state, shouldShowOnlyPinnedSources: false },
                                },
                            )
                        }
                    >
                        {t('extension.language.all')}
                    </Button>
                </Stack>
                <Button
                    startIcon={<FilterListIcon />}
                    variant={shouldShowOnlySourcesWithResults ? 'contained' : 'outlined'}
                    onClick={() =>
                        updateMetadataSettings('shouldShowOnlySourcesWithResults', !shouldShowOnlySourcesWithResults)
                    }
                >
                    {t('search.filter.has_results')}
                </Button>
            </Stack>
            <Box sx={{ pt: `${filterHeaderHeight}px` }}>
                {sourcesSortedByResult.map((source) => (
                    <SourceSearchPreview
                        key={source.id}
                        source={source}
                        onSearchRequestFinished={updateSourceLoadingState}
                        searchString={searchString}
                        emptyQuery={!query}
                        mode={isMigrateMode ? 'migrate.select' : 'source'}
                        shouldShowOnlySourcesWithResults={shouldShowOnlySourcesWithResults}
                    />
                ))}
            </Box>
        </Box>
    );
};
