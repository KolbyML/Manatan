/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import List from '@mui/material/List';
import ListSubheader from '@mui/material/ListSubheader';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { SettingsTrackerCard } from '@/features/tracker/components/cards/SettingsTrackerCard.tsx';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { MetadataTrackingSettings } from '@/features/tracker/Tracker.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';

export const TrackingSettings = () => {
    const { t } = useTranslation();
    const location = useLocation();

    useAppTitle(t('tracking.title'));

    const {
        settings: { updateProgressAfterReading, updateProgressManualMarkRead },
        loading: areMetadataServerSettingsLoading,
        request: { error: metadataServerSettingsError, refetch: refetchServerMetadataSettings },
    } = useMetadataServerSettings();
    const updateTrackingSettings = createUpdateMetadataServerSettings<keyof MetadataTrackingSettings>((e) =>
        makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
    );

    const {
        data,
        loading: areTrackersLoading,
        error: trackersError,
        refetch: refetchTrackersList,
    } = requestManager.useGetTrackersSettings({ notifyOnNetworkStatusChange: true });
    const trackers = data?.trackers.nodes ?? [];

    useEffect(() => {
        const shouldRefresh = Boolean((location.state as { refreshTrackers?: boolean } | undefined)?.refreshTrackers);
        if (!shouldRefresh) {
            return;
        }
        refetchTrackersList().catch(defaultPromiseErrorHandler('TrackingSettings::refetchTrackersList'));
    }, [location.state, refetchTrackersList]);

    const loading = areMetadataServerSettingsLoading || areTrackersLoading;
    const error = metadataServerSettingsError ?? trackersError;

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => {
                    if (metadataServerSettingsError) {
                        refetchServerMetadataSettings().catch(
                            defaultPromiseErrorHandler('TrackingSettings::refetchMetadataServerSettings'),
                        );
                    }

                    if (trackersError) {
                        refetchTrackersList().catch(
                            defaultPromiseErrorHandler('TrackingSettings::refetchTrackersList'),
                        );
                    }
                }}
            />
        );
    }

    if (loading) {
        return <LoadingPlaceholder />;
    }

    return (
        <>
            <List sx={{ pt: 0 }}>
                <ListItem>
                    <ListItemText primary={t('tracking.settings.label.update_progress_reading')} />
                    <Switch
                        edge="end"
                        checked={updateProgressAfterReading}
                        onChange={(e) => updateTrackingSettings('updateProgressAfterReading', e.target.checked)}
                    />
                </ListItem>
                <ListItem>
                    <ListItemText
                        primary={t('tracking.settings.label.update_progress_manual')}
                        secondary={t('tracking.settings.label.update_progress_reading_description')}
                    />
                    <Switch
                        edge="end"
                        checked={updateProgressManualMarkRead}
                        onChange={(e) => updateTrackingSettings('updateProgressManualMarkRead', e.target.checked)}
                    />
                </ListItem>
            </List>
            <List
                subheader={
                    <ListSubheader component="div" id="tracking-trackers">
                        {t('tracking.settings.title.trackers')}
                    </ListSubheader>
                }
            >
                {trackers.map((tracker) => (
                    <SettingsTrackerCard
                        key={tracker.id}
                        tracker={tracker}
                        onAuthChange={() =>
                            refetchTrackersList().catch(
                                defaultPromiseErrorHandler('TrackingSettings::refetchTrackersList'),
                            )
                        }
                    />
                ))}
            </List>
        </>
    );
};
