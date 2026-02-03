/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useMemo } from 'react';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
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
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';

export function AnimeSources({ tabsMenuHeight }: { tabsMenuHeight: number }) {
    const { t } = useTranslation();
    const {
        settings: { showNsfw, animeSourceLanguages, lastUsedSourceId },
    } = useMetadataServerSettings();
    const updateMetadataServerSettings = createUpdateMetadataServerSettings<'animeSourceLanguages'>();

    const {
        data,
        loading: isLoading,
        error,
        refetch,
    } = requestManager.useGetAnimeSourceList({ notifyOnNetworkStatusChange: true });
    const refreshSources = useCallback(
        () => refetch().catch(defaultPromiseErrorHandler('AnimeSources::refetch')),
        [refetch],
    );
    const sources = data?.animeSources?.nodes as AnimeSourceInfo[] | undefined;
    const filteredSources = useMemo(
        () =>
            SourceService.filter(sources ?? [], {
                showNsfw,
                languages: animeSourceLanguages,
                keepLocalSource: true,
                enabled: true,
            }),
        [sources, showNsfw, animeSourceLanguages],
    );
    const sourcesForLanguageSelect = useMemo(
        () =>
            SourceService.filter(sources ?? [], {
                showNsfw,
                keepLocalSource: true,
            }),
        [sources, showNsfw],
    );
    const sourcesByLanguage = useMemo<Array<[string, AnimeSourceInfo[]]>>(() => {
        const lastUsedSource = SourceService.getLastUsedSource(lastUsedSourceId, filteredSources);
        const groupedByLanguageTuple = Object.entries(
            SourceService.groupByLanguage(filteredSources),
        ) as Array<[string, AnimeSourceInfo[]]>;

        if (lastUsedSource) {
            return [[DefaultLanguage.LAST_USED_SOURCE, [lastUsedSource]], ...groupedByLanguageTuple];
        }

        return groupedByLanguageTuple;
    }, [filteredSources, lastUsedSourceId]);

    const sourceLanguagesList = useMemo(
        () => SourceService.getLanguages(sourcesForLanguageSelect),
        [sourcesForLanguageSelect],
    );

    const visibleSources = useMemo<AnimeSourceInfo[]>(
        () => sourcesByLanguage.map(([, sourcesOfLanguage]) => sourcesOfLanguage).flat(1),
        [sourcesByLanguage],
    );
    const groupCounts = useMemo(() => sourcesByLanguage.map((sourceGroup) => sourceGroup[1].length), [sourcesByLanguage]);
    const computeItemKey = VirtuosoUtil.useCreateGroupedComputeItemKey(
        groupCounts,
        useCallback((index) => sourcesByLanguage[index]?.[0] ?? 'unknown', [sourcesByLanguage]),
        useCallback(
            (index, groupIndex) => `${sourcesByLanguage[groupIndex]?.[0] ?? 'unknown'}_${visibleSources[index].id}`,
            [visibleSources],
        ),
    );
    const appAction = useMemo(
        () => (
            <SourceLanguageSelect
                selectedLanguages={animeSourceLanguages}
                setSelectedLanguages={(languages: string[]) =>
                    updateMetadataServerSettings('animeSourceLanguages', languages)
                }
                languages={sourceLanguagesList}
                sources={sourcesForLanguageSelect}
            />
        ),
        [animeSourceLanguages, sourceLanguagesList, sourcesForLanguageSelect],
    );

    useAppAction(appAction, [appAction]);

    if (isLoading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('AnimeSources::refetch'))}
            />
        );
    }

    if (sources?.length === 0) {
        return <EmptyViewAbsoluteCentered message={t('source.error.label.no_sources_found')} />;
    }

    if (!filteredSources.length) {
        return <EmptyViewAbsoluteCentered message={t('global.error.label.no_matching_results' as any)} />;
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
                const language = sourcesByLanguage[groupIndex]?.[0] ?? 'unknown';
                const source = visibleSources[index];
                if (!source) {
                    return null;
                }
                return (
                    <StyledGroupItemWrapper>
                        <AnimeSourceCard
                            source={source}
                            showSourceRepo={true}
                            showLanguage={isPinnedOrLastUsedSource(language)}
                            onMetaUpdated={refreshSources}
                        />
                    </StyledGroupItemWrapper>
                );
            }}
        />
    );
}
