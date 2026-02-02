/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { StyledGroupedVirtuoso } from '@/base/components/virtuoso/StyledGroupedVirtuoso.tsx';
import { StyledGroupHeader } from '@/base/components/virtuoso/StyledGroupHeader.tsx';
import { StyledGroupItemWrapper } from '@/base/components/virtuoso/StyledGroupItemWrapper.tsx';
import { VirtuosoUtil } from '@/lib/virtuoso/Virtuoso.util.tsx';
import { isPinnedOrLastUsedSource, translateExtensionLanguage } from '@/features/extension/Extensions.utils.ts';
import { useAppAction } from '@/features/navigation-bar/hooks/useAppAction.ts';
import { DefaultLanguage } from '@/base/utils/Languages.ts';
import { AnimeSourceCard, AnimeSourceInfo } from '@/features/browse/sources/components/AnimeSourceCard.tsx';
import { Sources as SourceService } from '@/features/source/services/Sources.ts';
import { SourceLanguageSelect } from '@/features/source/components/SourceLanguageSelect.tsx';

export function AnimeSources({ tabsMenuHeight }: { tabsMenuHeight: number }) {
    const { t } = useTranslation();
    const {
        settings: { showNsfw, animeSourceLanguages, lastUsedSourceId },
    } = useMetadataServerSettings();
    const updateMetadataServerSettings = createUpdateMetadataServerSettings<'animeSourceLanguages'>();

    const [refreshToken, setRefreshToken] = useState(0);

    const {
        data,
        loading: isLoading,
        error,
        refetch,
    } = requestManager.useGetAnimeSourceList({ notifyOnNetworkStatusChange: true });
    const { data: sourcesData } = requestManager.useGetSourceList();

    const refresh = useCallback(() => setRefreshToken((prev) => prev + 1), []);

    useEffect(() => {
        refetch().catch(() => {});
    }, [refreshToken]);

    const localSource = useMemo(() => {
        const source = sourcesData?.sources?.nodes?.find((item) => SourceService.isLocalSource(item));
        if (!source) {
            return null;
        }

        return {
            id: source.id,
            name: source.name,
            displayName: source.displayName,
            lang: source.lang || 'unknown',
            iconUrl: source.iconUrl,
            isNsfw: source.isNsfw,
            isConfigurable: source.isConfigurable,
            supportsLatest: source.supportsLatest,
            baseUrl: null,
            meta: source.meta ?? [],
            extension: source.extension ?? { repo: null },
        } satisfies AnimeSourceInfo;
    }, [sourcesData?.sources?.nodes]);

    const sources = useMemo(() => {
        const animeSources = ((data?.animeSources?.nodes ?? []) as AnimeSourceInfo[])
            .filter(Boolean)
            .map((source) => ({
                ...source,
                extension: source.extension ?? { repo: null },
                meta: source.meta ?? [],
                lang: source.lang || 'unknown',
            }));

        if (!localSource || animeSources.some((source) => SourceService.isLocalSource(source))) {
            return animeSources;
        }

        return [localSource, ...animeSources];
    }, [data?.animeSources?.nodes, localSource]);
    const filteredSources = useMemo(
        () =>
            SourceService.filter(sources, {
                showNsfw,
                languages: animeSourceLanguages,
                keepLocalSource: true,
                enabled: true,
            }),
        [sources, showNsfw, animeSourceLanguages],
    );
    const sourcesByLanguage = useMemo(() => {
        const lastUsedSource = SourceService.getLastUsedSource(lastUsedSourceId, filteredSources);
        const groupedByLanguageTuple = Object.entries(SourceService.groupByLanguage(filteredSources));

        if (lastUsedSource) {
            return [[DefaultLanguage.LAST_USED_SOURCE, [lastUsedSource]], ...groupedByLanguageTuple];
        }

        return groupedByLanguageTuple;
    }, [filteredSources, lastUsedSourceId]);

    const sourceLanguagesList = useMemo(() => SourceService.getLanguages(sources ?? []), [sources]);
    const areSourcesFromDifferentRepos = useMemo(
        () => SourceService.areFromMultipleRepos(filteredSources),
        [filteredSources],
    );

    const visibleSources = useMemo(
        () => sourcesByLanguage.map(([, sourcesOfLanguage]) => sourcesOfLanguage).flat(1),
        [sourcesByLanguage],
    );
    const groupCounts = useMemo(() => sourcesByLanguage.map((sourceGroup) => sourceGroup[1].length), [sourcesByLanguage]);
    const computeItemKey = VirtuosoUtil.useCreateGroupedComputeItemKey(
        groupCounts,
        useCallback((index) => sourcesByLanguage[index][0], [sourcesByLanguage]),
        useCallback(
            (index, groupIndex) => `${sourcesByLanguage[groupIndex][0]}_${visibleSources[index].id}`,
            [visibleSources],
        ),
    );
    const appAction = useMemo(
        () => (
            <>
                <IconButton onClick={refresh} color="inherit">
                    <RefreshIcon />
                </IconButton>
                <SourceLanguageSelect
                    selectedLanguages={animeSourceLanguages}
                    setSelectedLanguages={(languages: string[]) =>
                        updateMetadataServerSettings('animeSourceLanguages', languages)
                    }
                    languages={sourceLanguagesList}
                    sources={sources ?? []}
                />
            </>
        ),
        [refresh, animeSourceLanguages, sourceLanguagesList, sources],
    );

    useAppAction(appAction, [appAction]);

    if (isLoading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={error?.message}
                retry={() => refresh()}
            />
        );
    }

    if (!sources.length) {
        return <EmptyViewAbsoluteCentered message="No anime sources found." />;
    }

    if (!filteredSources.length) {
        return <EmptyViewAbsoluteCentered message={t('global.error.label.no_matching_results')} />;
    }

    return (
        <StyledGroupedVirtuoso
            persistKey="anime-sources"
            heightToSubtract={tabsMenuHeight}
            overscan={window.innerHeight * 0.5}
            groupCounts={groupCounts}
            computeItemKey={computeItemKey}
            groupContent={(index) => (
                <StyledGroupHeader isFirstItem={!index}>
                    <Typography variant="h5" component="h2">
                        {translateExtensionLanguage(sourcesByLanguage[index]?.[0] ?? 'unknown')}
                    </Typography>
                </StyledGroupHeader>
            )}
            itemContent={(index, groupIndex) => {
                const language = sourcesByLanguage[groupIndex][0];
                const source = visibleSources[index];
                if (!source) {
                    return null;
                }
                return (
                    <StyledGroupItemWrapper>
                        <AnimeSourceCard
                            source={source}
                            showSourceRepo={areSourcesFromDifferentRepos}
                            showLanguage={isPinnedOrLastUsedSource(language)}
                        />
                    </StyledGroupItemWrapper>
                );
            }}
        />
    );
}
