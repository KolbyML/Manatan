/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import ListItemButton from '@mui/material/ListItemButton';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { ListItemLink } from '@/base/components/lists/ListItemLink.tsx';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { ImageCache } from '@/lib/service-worker/ImageCache.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';

export const ImagesSettings = () => {
    const { t } = useTranslation();

    useAppTitle(t('settings.images.title'));

    const [triggerClearServerCache, { loading: isClearingServerCache }] = requestManager.useClearServerCache();

    const clearCache = async () => {
        try {
            await Promise.all([triggerClearServerCache(), ImageCache.clear()]);
            makeToast(t('settings.clear_cache.label.success'), 'success');
        } catch (e) {
            makeToast(t('settings.clear_cache.label.failure'), 'error', getErrorMessage(e));
        }
    };

    return (
        <List sx={{ pt: 0 }}>
            <ListItemButton disabled={isClearingServerCache} onClick={clearCache}>
                <ListItemText
                    primary={t('settings.clear_cache.label.title')}
                    secondary={t('settings.clear_cache.label.description')}
                />
            </ListItemButton>
            <List
                subheader={
                    <ListSubheader component="div" id="image-processing-settings">
                        {t('settings.images.processing.title')}
                    </ListSubheader>
                }
            >
                <ListItemLink to={AppRoutes.settings.childRoutes.images.childRoutes.processingDownloads.path}>
                    <ListItemText primary={t('download.settings.conversion.title')} />
                </ListItemLink>
                <ListItemLink to={AppRoutes.settings.childRoutes.images.childRoutes.processingServe.path}>
                    <ListItemText primary={t('settings.images.processing.serve.title')} />
                </ListItemLink>
            </List>
        </List>
    );
};
