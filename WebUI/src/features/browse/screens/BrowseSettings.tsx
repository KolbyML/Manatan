/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Trans, useTranslation } from 'react-i18next';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { NumberSetting } from '@/base/components/settings/NumberSetting.tsx';
import { MutableListSetting } from '@/base/components/settings/MutableListSetting.tsx';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { MetadataBrowseSettings } from '@/features/browse/Browse.types.ts';
import { ServerSettings as GqlServerSettings } from '@/features/settings/Settings.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';

type ExtensionsSettings = Omit<GqlServerSettings, 'localSourcePath'> & {
    localSourcePath: string[];
    localAnimeSourcePath: string[];
    animeExtensionRepos: string[];
};

const coerceStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length ? [trimmed] : [];
    }

    return [];
};

export const BrowseSettings = () => {
    const { t } = useTranslation();

    useAppTitle(t('global.label.browse'));

    const { data, loading, error, refetch } = requestManager.useGetServerSettings({
        notifyOnNetworkStatusChange: true,
    });
    const [mutateSettings] = requestManager.useUpdateServerSettings();

    const updateSetting = <Setting extends keyof ExtensionsSettings>(
        setting: Setting,
        value: ExtensionsSettings[Setting],
    ) => {
        mutateSettings({ variables: { input: { settings: { [setting]: value } as Record<string, unknown> } } }).catch(
            (e) => makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
        );
    };

    const {
        settings: { hideLibraryEntries, showNsfw },
    } = useMetadataServerSettings();
    const updateMetadataServerSettings = createUpdateMetadataServerSettings<keyof MetadataBrowseSettings>((e) =>
        makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
    );

    if (loading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('BrowseSettings::refetch'))}
            />
        );
    }

    const serverSettings = data!.settings as unknown as ExtensionsSettings;
    const defaults = (data as any)?.defaults;
    const animeExtensionRepos = coerceStringArray((serverSettings as any).animeExtensionRepos);
    const localSourcePaths = coerceStringArray((serverSettings as any).localSourcePath);
    const localAnimeSourcePaths = coerceStringArray((serverSettings as any).localAnimeSourcePath);
    const defaultLocalSourcePaths = coerceStringArray(defaults?.localSourcePath);
    const defaultLocalAnimeSourcePaths = coerceStringArray(defaults?.localAnimeSourcePath);

    const isValidExtensionRepo = (repo: string) => {
        const trimmed = repo.trim();
        if (!trimmed) {
            return false;
        }

        const githubPattern =
            /https:\/\/(www\.|raw\.)?(github|githubusercontent)\.com\/([^/]+)\/([^/]+)((\/tree|\/blob)?\/([^/\n]*))?(\/([^/\n]*\.json)?)?/g;
        const urlPattern = /^https?:\/\/.+/i;
        return !!trimmed.match(githubPattern) || urlPattern.test(trimmed);
    };

    return (
        <List sx={{ pt: 0 }}>
            <ListItem>
                <ListItemText primary={t('settings.label.hide_library_entries')} />
                <Switch
                    edge="end"
                    checked={hideLibraryEntries}
                    onChange={() => updateMetadataServerSettings('hideLibraryEntries', !hideLibraryEntries)}
                />
            </ListItem>
            <ListItem>
                <ListItemText
                    primary={t('settings.label.show_nsfw')}
                    secondary={t('settings.label.show_nsfw_description')}
                />
                <Switch
                    edge="end"
                    checked={showNsfw}
                    onChange={() => updateMetadataServerSettings('showNsfw', !showNsfw)}
                />
            </ListItem>
            <NumberSetting
                settingTitle={t('settings.server.requests.sources.parallel.label.title')}
                settingValue={t('settings.server.requests.sources.parallel.label.value', {
                    value: serverSettings.maxSourcesInParallel,
                    count: serverSettings.maxSourcesInParallel,
                })}
                valueUnit={t('source.title_one')}
                value={serverSettings.maxSourcesInParallel}
                defaultValue={6}
                minValue={1}
                maxValue={20}
                showSlider
                stepSize={1}
                handleUpdate={(parallelSources) => updateSetting('maxSourcesInParallel', parallelSources)}
            />
            <MutableListSetting
                settingName={`Manga ${t('extension.settings.repositories.custom.label.title')}`}
                description={t('extension.settings.repositories.custom.label.description')}
                dialogDisclaimer={
                    <Trans i18nKey="extension.settings.repositories.custom.label.disclaimer">
                        <strong>Manatan does not provide any support for 3rd party repositories or extensions!</strong>
                        <br />
                        Use with caution as there could be malicious actors making those repositories.
                        <br />
                        You as the user need to verify the security and that you trust any repository or extension.
                    </Trans>
                }
                handleChange={(repos) => {
                    updateSetting('extensionRepos', repos);
                    requestManager.clearExtensionCache();
                }}
                valueInfos={serverSettings.extensionRepos.map((extensionRepo) => [extensionRepo])}
                addItemButtonTitle={t('extension.settings.repositories.custom.dialog.action.button.add')}
                placeholder="https://github.com/MY_ACCOUNT/MY_REPO/tree/repo"
                validateItem={isValidExtensionRepo}
                invalidItemError={t('extension.settings.repositories.custom.error.label.invalid_url')}
            />
            <MutableListSetting
                settingName={`Anime ${t('extension.settings.repositories.custom.label.title')}`}
                description={t('extension.settings.repositories.custom.label.description')}
                dialogDisclaimer={
                    <Trans i18nKey="extension.settings.repositories.custom.label.disclaimer">
                        <strong>Manatan does not provide any support for 3rd party repositories or extensions!</strong>
                        <br />
                        Use with caution as there could be malicious actors making those repositories.
                        <br />
                        You as the user need to verify the security and that you trust any repository or extension.
                    </Trans>
                }
                handleChange={(repos) => {
                    updateSetting('animeExtensionRepos', repos);
                    requestManager.clearAnimeExtensionCache();
                }}
                valueInfos={animeExtensionRepos.map((extensionRepo) => [extensionRepo])}
                addItemButtonTitle={t('extension.settings.repositories.custom.dialog.action.button.add')}
                placeholder="https://github.com/MY_ACCOUNT/MY_REPO/tree/repo"
                validateItem={isValidExtensionRepo}
                invalidItemError={t('extension.settings.repositories.custom.error.label.invalid_url')}
            />
            <MutableListSetting
                settingName={t('settings.server.local_source.path.label.title')}
                description={t('settings.server.local_source.path.label.description')}
                valueInfos={localSourcePaths.map((path) => [path])}
                resetToDefaultValues={defaultLocalSourcePaths}
                handleChange={(paths) => updateSetting('localSourcePath', paths)}
            />
            <MutableListSetting
                settingName={t('settings.server.local_anime_source.path.label.title')}
                description={t('settings.server.local_anime_source.path.label.description')}
                valueInfos={localAnimeSourcePaths.map((path) => [path])}
                resetToDefaultValues={defaultLocalAnimeSourcePaths}
                handleChange={(paths) => updateSetting('localAnimeSourcePath', paths)}
            />
        </List>
    );
};
