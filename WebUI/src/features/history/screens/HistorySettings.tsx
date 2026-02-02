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
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { MetadataHistorySettings } from '@/features/history/History.types.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';

export const HistorySettings = () => {
    const { t } = useTranslation();

    useAppTitle(t('history.title'));

    const {
        settings: { hideHistory },
        request: { loading, error, refetch },
    } = useMetadataServerSettings();
    const updateMetadataServerSettings = createUpdateMetadataServerSettings<keyof MetadataHistorySettings>((e) =>
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
                retry={() => refetch().catch(defaultPromiseErrorHandler('HistorySettings::refetch'))}
            />
        );
    }

    return (
        <List sx={{ pt: 0 }}>
            <ListItem>
                <ListItemText primary={t('history.settings.hide')} />
                <Switch
                    edge="end"
                    checked={hideHistory}
                    onChange={() => updateMetadataServerSettings('hideHistory', !hideHistory)}
                />
            </ListItem>
        </List>
    );
};
