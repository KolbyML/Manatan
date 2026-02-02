/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useMemo } from 'react';
import IconButton from '@mui/material/IconButton';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Typography from '@mui/material/Typography';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { DefaultLanguage } from '@/base/utils/Languages.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { SourceCard } from '@/features/browse/sources/components/SourceCard.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { isPinnedOrLastUsedSource, translateExtensionLanguage } from '@/features/extension/Extensions.utils.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { Sources as SourceService } from '@/features/source/services/Sources.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { useAppAction } from '@/features/navigation-bar/hooks/useAppAction.ts';
import { StyledGroupedVirtuoso } from '@/base/components/virtuoso/StyledGroupedVirtuoso.tsx';
import { VirtuosoUtil } from '@/lib/virtuoso/Virtuoso.util.tsx';
import { StyledGroupHeader } from '@/base/components/virtuoso/StyledGroupHeader.tsx';
import { StyledGroupItemWrapper } from '@/base/components/virtuoso/StyledGroupItemWrapper.tsx';
import { SourceLanguageSelect } from '@/features/source/components/SourceLanguageSelect.tsx';

export function Sources({ tabsMenuHeight }: { tabsMenuHeight: number }) {
    const { t } = useTranslation();

    const { languages: shownLangs, setLanguages: setShownLangs } = SourceService.useLanguages();
    const {
        settings: { showNsfw, lastUsedSourceId },
    } = useMetadataServerSettings();

    const {
        data,
        loading: isLoading,
        error,
        refetch,
    } = requestManager.useGetSourceList({ notifyOnNetworkStatusChange: true });
    const sources = data?.sources.nodes;
    const filteredSources = useMemo(
        () =>
            SourceService.filter(sources ?? [], {
                showNsfw,
                languages: shownLangs,
                keepLocalSource: true,
                enabled: true,
            }),
        [sources, shownLangs],
    );
    const sourcesByLanguage = useMemo(() => {
        const lastUsedSource = SourceService.getLastUsedSource(lastUsedSourceId, filteredSources);
        const groupedByLanguageTuple = Object.entries(SourceService.groupByLanguage(filteredSources));

        if (lastUsedSource) {
            return [
                [DefaultLanguage.LAST_USED_SOURCE, [lastUsedSource]],
                ...groupedByLanguageTuple,
            ] satisfies typeof groupedByLanguageTuple;
        }

        return groupedByLanguageTuple;
    }, [filteredSources]);

    const sourceLanguages = useMemo(() => SourceService.getLanguages(sources ?? []), [sources]);
    const areSourcesFromDifferentRepos = useMemo(
        () => SourceService.areFromMultipleRepos(filteredSources),
        [filteredSources],
    );
    const visibleSources = useMemo(
        () => sourcesByLanguage.map(([, sourcesOfLanguage]) => sourcesOfLanguage).flat(1),
        [sourcesByLanguage],
    );

    const groupCounts = useMemo(
        () => sourcesByLanguage.map((sourceGroup) => sourceGroup[1].length),
        [sourcesByLanguage],
    );
    const computeItemKey = VirtuosoUtil.useCreateGroupedComputeItemKey(
        groupCounts,
        useCallback((index) => sourcesByLanguage[index][0], [sourcesByLanguage]),
        useCallback(
            (index, groupIndex) => `${sourcesByLanguage[groupIndex][0]}_${visibleSources[index].id}`,
            [visibleSources],
        ),
    );

    const navigate = useNavigate();

    const appAction = useMemo(
        () => (
            <>
                <CustomTooltip title={t('search.title.global_search')}>
                    <IconButton onClick={() => navigate(AppRoutes.sources.childRoutes.searchAll.path())} color="inherit">
                        <TravelExploreIcon />
                    </IconButton>
                </CustomTooltip>
                <SourceLanguageSelect
                    selectedLanguages={shownLangs}
                    setSelectedLanguages={setShownLangs}
                    languages={sourceLanguages}
                    sources={sources ?? []}
                />
            </>
        ),
        [t, navigate, shownLangs, sourceLanguages, sources],
    );

    useAppAction(appAction, [appAction]);

    if (isLoading) return <LoadingPlaceholder />;

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('Sources::refetch'))}
            />
        );
    }

    if (sources?.length === 0) {
        return <EmptyViewAbsoluteCentered message={t('source.error.label.no_sources_found')} />;
    }

    return (
        <StyledGroupedVirtuoso
            persistKey="sources"
            heightToSubtract={tabsMenuHeight}
            overscan={window.innerHeight * 0.5}
            groupCounts={groupCounts}
            computeItemKey={computeItemKey}
            groupContent={(index) => {
                const [language] = sourcesByLanguage[index];

                return (
                    <StyledGroupHeader isFirstItem={!index}>
                        <Typography variant="h5" component="h2">
                            {translateExtensionLanguage(language)}
                        </Typography>
                    </StyledGroupHeader>
                );
            }}
            itemContent={(index, groupIndex) => {
                const language = sourcesByLanguage[groupIndex][0];
                const source = visibleSources[index];

                return (
                    <StyledGroupItemWrapper>
                        <SourceCard
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
