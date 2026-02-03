/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fromEvent } from 'file-selector';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useWindowEvent } from '@mantine/hooks';
import { StringParam, useQueryParam } from 'use-query-params';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { AppbarSearch } from '@/base/components/AppbarSearch.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { makeToast } from '@/base/utils/Toast.ts';
import { LanguageSelect } from '@/base/components/inputs/LanguageSelect.tsx';
import { StyledGroupedVirtuoso } from '@/base/components/virtuoso/StyledGroupedVirtuoso.tsx';
import { StyledGroupHeader } from '@/base/components/virtuoso/StyledGroupHeader.tsx';
import { StyledGroupItemWrapper } from '@/base/components/virtuoso/StyledGroupItemWrapper.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { VirtuosoUtil } from '@/lib/virtuoso/Virtuoso.util.tsx';
import {
    groupExtensionsByLanguage,
    getLanguagesFromExtensions,
    translateExtensionLanguage,
    filterExtensions,
} from '@/features/extension/Extensions.utils.ts';
import {
    ExtensionAction,
    ExtensionGroupState,
    ExtensionState,
    TExtension,
} from '@/features/extension/Extensions.types.ts';
import { EXTENSION_ACTION_TO_FAILURE_TRANSLATION_KEY_MAP } from '@/features/extension/Extensions.constants.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { MetadataBrowseSettings } from '@/features/browse/Browse.types.ts';
import { useAppAction } from '@/features/navigation-bar/hooks/useAppAction.ts';
import { SearchParam } from '@/base/Base.types.ts';
import { AnimeExtensionCard, AnimeExtensionInfo } from '@/features/browse/extensions/components/AnimeExtensionCard.tsx';
import { AuthManager } from '@/features/authentication/AuthManager.ts';

const LANGUAGE = 0;
const EXTENSIONS = 1;

export function AnimeExtensions({ tabsMenuHeight }: { tabsMenuHeight: number }) {
    const { t } = useTranslation();

    const {
        settings: { animeExtensionLanguages: shownLangs, showNsfw },
    } = useMetadataServerSettings();
    const updateMetadataServerSettings = createUpdateMetadataServerSettings<
        keyof Pick<MetadataBrowseSettings, 'animeExtensionLanguages'>
    >((e) => makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)));

    const [query] = useQueryParam(SearchParam.QUERY, StringParam);

    const [refetchExtensions, setRefetchExtensions] = useState({});
    const [updatingExtensionIds, setUpdatingExtensionIds] = useState<string[]>([]);

    const {
        data: serverSettingsData,
        loading: areServerSettingsLoading,
        error: serverSettingsError,
        refetch: refetchServerSettings,
    } = requestManager.useGetServerSettings({ notifyOnNetworkStatusChange: true });
    const [fetchExtensions, { data, loading: areExtensionsLoading, error: extensionsError }] =
        requestManager.useAnimeExtensionListFetch();

    const animeExtensionRepos = (serverSettingsData?.settings as { animeExtensionRepos?: string[] })
        ?.animeExtensionRepos;
    const areReposDefined = !!animeExtensionRepos?.length;
    const areMultipleReposInUse = (animeExtensionRepos?.length ?? 0) > 1;

    const isLoading = areServerSettingsLoading || areExtensionsLoading;
    const error = serverSettingsError ?? extensionsError;

    useEffect(() => {
        fetchExtensions();
    }, [refetchExtensions]);

    const allExtensions = data?.fetchAnimeExtensions?.extensions;
    const filteredExtensions = useMemo(
        () => filterExtensions(allExtensions ?? [], { selectedLanguages: shownLangs, showNsfw, query }),
        [allExtensions, shownLangs, showNsfw, query],
    ) as AnimeExtensionInfo[];

    const groupedExtensions = useMemo(
        () => groupExtensionsByLanguage(filteredExtensions as TExtension[]),
        [filteredExtensions],
    );
    const groupCounts = useMemo(
        () => groupedExtensions.map((extensionGroup) => extensionGroup[EXTENSIONS].length),
        [groupedExtensions],
    );
    const visibleExtensions = useMemo(
        () => groupedExtensions.map(([, extensionsOfLanguage]) => extensionsOfLanguage).flat(1) as AnimeExtensionInfo[],
        [groupedExtensions],
    );

    const computeItemKey = VirtuosoUtil.useCreateGroupedComputeItemKey(
        groupCounts,
        useCallback((index) => groupedExtensions[index][LANGUAGE], [groupedExtensions]),
        useCallback((index) => visibleExtensions[index].pkgName, [visibleExtensions]),
    );

    const handleExtensionUpdate = useCallback(() => setRefetchExtensions({}), []);

    const submitExternalExtension = (file: File) => {
        if (!file.name.toLowerCase().endsWith('apk')) {
            makeToast(t('global.error.label.invalid_file_type'), 'error');
            return;
        }

        makeToast(t('extension.label.installing_file'), 'info');

        const formData = new FormData();
        formData.append('file', file);

        const accessToken = AuthManager.getAccessToken();
        fetch(requestManager.getValidUrlFor('/anime/extension/install'), {
            method: 'POST',
            body: formData,
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
            credentials: 'include',
        })
            .then((response) => {
                if (![200, 201, 302].includes(response.status)) {
                    throw new Error(response.statusText);
                }
                handleExtensionUpdate();
                makeToast(t('extension.label.installed_successfully'), 'success');
            })
            .catch((e) => makeToast(t('extension.label.installation_failed'), 'error', getErrorMessage(e)));
    };

    useAppAction(
        <>
            <AppbarSearch />
            <CustomTooltip title={t('extension.action.label.install_external')}>
                <IconButton
                    onClick={() => {
                        const input = document.createElement('input');
                        input.style.display = 'none';
                        input.type = 'file';
                        input.onchange = () => {
                            const file = input.files?.[0];
                            if (file) {
                                submitExternalExtension(file);
                            }
                        };

                        document.documentElement.appendChild(input);
                        input.click();
                        document.documentElement.removeChild(input);
                    }}
                    color="inherit"
                >
                    <AddIcon />
                </IconButton>
            </CustomTooltip>

            <LanguageSelect
                selectedLanguages={shownLangs}
                setSelectedLanguages={(languages: string[]) =>
                    updateMetadataServerSettings('animeExtensionLanguages', languages)}
                languages={getLanguagesFromExtensions(allExtensions ?? [])}
            />
        </>,
        [shownLangs, allExtensions],
    );

    useWindowEvent('drop', async (e) => {
        e.preventDefault();
        const files = await fromEvent(e);
        submitExternalExtension(files[0] as File);
    });
    useWindowEvent('dragover', (e) => {
        e.preventDefault();
    });

    if (isLoading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => {
                    if (serverSettingsError) {
                        refetchServerSettings().catch(
                            defaultPromiseErrorHandler('AnimeExtensions::refetchServerSettings'),
                        );
                    }
                    if (extensionsError) {
                        fetchExtensions().catch(
                            defaultPromiseErrorHandler('AnimeExtensions::refetchExtensions'),
                        );
                    }
                }}
            />
        );
    }

    if (!(allExtensions ?? []).length && !areReposDefined) {
        return (
            <Stack
                sx={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    rowGap: '10px',
                    paddingTop: '20px',
                }}
            >
                <Typography>{t('extension.label.add_repository_info')}</Typography>
                <Button component={Link} variant="contained" to={AppRoutes.settings.childRoutes.browse.path}>
                    {t('settings.title')}
                </Button>
            </Stack>
        );
    }

    return (
        <StyledGroupedVirtuoso
            persistKey="anime-extensions"
            heightToSubtract={tabsMenuHeight}
            overscan={window.innerHeight * 0.5}
            groupCounts={groupCounts}
            groupContent={(index) => {
                const [groupName, groupExtensions] = groupedExtensions[index];
                const isUpdateGroup = groupName === ExtensionGroupState.UPDATE_PENDING;

                return (
                    <StyledGroupHeader
                        key={groupName}
                        isFirstItem={index === 0}
                        sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', pr: 1 }}
                    >
                        <Typography variant="h5" component="h2">
                            {translateExtensionLanguage(groupName)}
                        </Typography>
                        {isUpdateGroup && (
                            <Button
                                disabled={!!updatingExtensionIds.length}
                                variant="contained"
                                onClick={async () => {
                                    const ids = groupExtensions.map((extension) => extension.pkgName);
                                    setUpdatingExtensionIds(ids);

                                    try {
                                        await requestManager.updateAnimeExtensions(ids, { update: true }).response;
                                        handleExtensionUpdate();
                                    } catch (e) {
                                        makeToast(
                                            t(EXTENSION_ACTION_TO_FAILURE_TRANSLATION_KEY_MAP[ExtensionAction.UPDATE], {
                                                count: ids.length,
                                            }),
                                            'error',
                                            getErrorMessage(e),
                                        );
                                    } finally {
                                        setUpdatingExtensionIds([]);
                                    }
                                }}
                            >
                                {t('extension.action.label.update_all')}
                            </Button>
                        )}
                    </StyledGroupHeader>
                );
            }}
            computeItemKey={computeItemKey}
            itemContent={(index) => {
                const item = visibleExtensions[index];

                return (
                    <StyledGroupItemWrapper>
                        <AnimeExtensionCard
                            extension={item as AnimeExtensionInfo}
                            handleUpdate={handleExtensionUpdate}
                            showSourceRepo={true}
                            forcedState={
                                updatingExtensionIds.includes(item.pkgName) ? ExtensionState.UPDATING : undefined
                            }
                        />
                    </StyledGroupItemWrapper>
                );
            }}
        />
    );
}
