/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import List from '@mui/material/List';
import ListSubheader from '@mui/material/ListSubheader';
import { useTranslation } from 'react-i18next';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import {
    CategoriesInclusionSetting,
    CategoriesInclusionSettingProps,
} from '@/features/category/components/CategoriesInclusionSetting.tsx';
import { GlobalUpdateSettingsEntries } from '@/features/settings/components/globalUpdate/GlobalUpdateSettingsEntries.tsx';
import { GlobalUpdateSettingsInterval } from '@/features/settings/components/globalUpdate/GlobalUpdateSettingsInterval.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { LibrarySettingsType, ServerSettings } from '@/features/settings/Settings.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';

export const GlobalUpdateSettings = ({
    serverSettings,
    categories,
}: {
    serverSettings: ServerSettings;
    categories: CategoriesInclusionSettingProps['categories'];
}) => {
    const { t } = useTranslation();

    const { updateMangas } = serverSettings;
    const [mutateSettings] = requestManager.useUpdateServerSettings();

    const updateSetting = async <Setting extends keyof LibrarySettingsType>(
        setting: Setting,
        value: LibrarySettingsType[Setting],
    ) => {
        try {
            await mutateSettings({ variables: { input: { settings: { [setting]: value } } } });
        } catch (e) {
            makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e));
        }
    };

    return (
        <List
            subheader={
                <ListSubheader component="div" id="global-update-settings">
                    {t('library.settings.global_update.title')}
                </ListSubheader>
            }
        >
            <GlobalUpdateSettingsInterval globalUpdateInterval={serverSettings.globalUpdateInterval} />
            <GlobalUpdateSettingsEntries serverSettings={serverSettings} />
            <CategoriesInclusionSetting
                categories={categories}
                includeField="includeInUpdate"
                dialogText={t('library.settings.global_update.categories.label.info')}
            />
            <ListItem>
                <ListItemText
                    primary={t('library.settings.global_update.metadata.label.title')}
                    secondary={t('library.settings.global_update.metadata.label.description')}
                />
                <Switch
                    edge="end"
                    checked={updateMangas}
                    onChange={(e) => updateSetting('updateMangas', e.target.checked)}
                />
            </ListItem>
        </List>
    );
};
