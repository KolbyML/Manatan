/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import ListSubheader from '@mui/material/ListSubheader';
import { t as translate } from 'i18next';
import { GlobalUpdateSettings } from '@/features/settings/components/globalUpdate/GlobalUpdateSettings.tsx';
import { makeToast } from '@/base/utils/Toast.ts';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { Mangas } from '@/features/manga/services/Mangas.ts';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { ListItemLink } from '@/base/components/lists/ListItemLink.tsx';
import {
    GetCategoriesSettingsQuery,
    GetCategoriesSettingsQueryVariables,
    GetMangasBaseQuery,
    GetMangasBaseQueryVariables,
} from '@/lib/graphql/generated/graphql.ts';
import { GET_CATEGORIES_SETTINGS } from '@/lib/graphql/category/CategoryQuery.ts';
import { GET_MANGAS_BASE } from '@/lib/graphql/manga/MangaQuery.ts';
import { MetadataLibrarySettings } from '@/features/library/Library.types.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';

const removeNonLibraryMangasFromCategories = async (): Promise<void> => {
    try {
        const nonLibraryMangas = await requestManager.getMangas<GetMangasBaseQuery, GetMangasBaseQueryVariables>(
            GET_MANGAS_BASE,
            {
                filter: { inLibrary: { equalTo: false }, categoryId: { isNull: false } },
            },
            { fetchPolicy: 'no-cache' },
        ).response;

        const mangaIdsToRemove = Mangas.getIds(nonLibraryMangas.data.mangas.nodes);

        if (mangaIdsToRemove.length) {
            await requestManager.updateMangasCategories(mangaIdsToRemove, {
                clearCategories: true,
            }).response;
        }
        makeToast(translate('library.settings.advanced.database.cleanup.label.success'), 'success');
    } catch (e) {
        makeToast(translate('library.settings.advanced.database.cleanup.label.error'), 'error', getErrorMessage(e));
    }
};

export function LibrarySettings() {
    const { t } = useTranslation();

    useAppTitle(t('library.title'));

    const categories = requestManager.useGetCategories<GetCategoriesSettingsQuery, GetCategoriesSettingsQueryVariables>(
        GET_CATEGORIES_SETTINGS,
    );
    const serverSettings = requestManager.useGetServerSettings({ notifyOnNetworkStatusChange: true });
    const {
        settings,
        loading: areMetadataServerSettingsLoading,
        request: { error: metadataServerSettingsError, refetch: refetchMetadataServerSettings },
    } = useMetadataServerSettings();

    const setSettingValue = createUpdateMetadataServerSettings<keyof MetadataLibrarySettings>((e) =>
        makeToast(t('search.error.label.failed_to_save_settings'), 'error', getErrorMessage(e)),
    );

    // -1 for the DEFAULT category
    const categoryCount = (categories.data?.categories.nodes.length ?? 1) - 1;

    const loading = serverSettings.loading || areMetadataServerSettingsLoading || categories.loading;
    if (loading) {
        return <LoadingPlaceholder />;
    }

    const error = serverSettings.error ?? metadataServerSettingsError ?? categories.error;
    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => {
                    if (serverSettings.error) {
                        serverSettings
                            ?.refetch()
                            .catch(defaultPromiseErrorHandler('LibrarySettings::refetchServerSettings'));
                    }

                    if (metadataServerSettingsError) {
                        refetchMetadataServerSettings().catch(
                            defaultPromiseErrorHandler('LibrarySettings::refetchMetadataServerSettings'),
                        );
                    }

                    if (categories.error) {
                        categories.refetch().catch(defaultPromiseErrorHandler('LibrarySettings::refetchCategories'));
                    }
                }}
            />
        );
    }

    return (
        <List sx={{ pt: 0 }}>
            <List
                subheader={
                    <ListSubheader component="div" id="library-category-settings">
                        {t('category.title.category_other')}
                    </ListSubheader>
                }
            >
                <ListItemLink to={AppRoutes.settings.childRoutes.categories.path}>
                    <ListItemText
                        primary={t('category.dialog.title.edit_category_other')}
                        secondary={t('category.value', { count: categoryCount })}
                    />
                </ListItemLink>
                <ListItem>
                    <ListItemText
                        primary={t('library.settings.general.add_to_library.category_selection.label.title')}
                        secondary={t('library.settings.general.add_to_library.category_selection.label.description')}
                    />
                    <Switch
                        edge="end"
                        checked={settings.showAddToLibraryCategorySelectDialog}
                        onChange={(e) => setSettingValue('showAddToLibraryCategorySelectDialog', e.target.checked)}
                    />
                </ListItem>
                <ListItem>
                    <ListItemText
                        primary={t('library.settings.general.remove_from_library.remove_from_categories.label.title')}
                        secondary={t(
                            'library.settings.general.remove_from_library.remove_from_categories.label.description',
                        )}
                    />
                    <Switch
                        edge="end"
                        checked={settings.removeMangaFromCategories}
                        onChange={(e) => setSettingValue('removeMangaFromCategories', e.target.checked)}
                    />
                </ListItem>
            </List>
            <List
                subheader={
                    <ListSubheader component="div" id="library-general-settings">
                        {t('global.label.general')}
                    </ListSubheader>
                }
            >
                <ListItem>
                    <ListItemText
                        primary={t('library.settings.general.search.ignore_filters.label.title')}
                        secondary={t('library.settings.general.search.ignore_filters.label.description')}
                    />
                    <Switch
                        edge="end"
                        checked={settings.ignoreFilters}
                        onChange={(e) => setSettingValue('ignoreFilters', e.target.checked)}
                    />
                </ListItem>
            </List>
            <GlobalUpdateSettings
                serverSettings={serverSettings.data!.settings}
                categories={categories.data!.categories.nodes}
            />
            <List
                subheader={
                    <ListSubheader component="div" id="library-advanced">
                        {t('global.label.advanced')}
                    </ListSubheader>
                }
            >
                <ListItemButton onClick={() => removeNonLibraryMangasFromCategories()}>
                    <ListItemText
                        primary={t('library.settings.advanced.database.cleanup.label.title')}
                        secondary={t('library.settings.advanced.database.cleanup.label.description')}
                    />
                </ListItemButton>
                <ListItemLink to={AppRoutes.settings.childRoutes.library.childRoutes.duplicates.path}>
                    <ListItemText
                        primary={t('library.settings.advanced.duplicates.label.title')}
                        secondary={t('library.settings.advanced.duplicates.label.description')}
                    />
                </ListItemLink>
            </List>
        </List>
    );
}
