/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import List from '@mui/material/List';
import BackupIcon from '@mui/icons-material/Backup';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useTranslation } from 'react-i18next';
import CollectionsOutlinedBookmarkIcon from '@mui/icons-material/CollectionsBookmarkOutlined';
import GetAppOutlinedIcon from '@mui/icons-material/GetAppOutlined';
import DnsIcon from '@mui/icons-material/Dns';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import DevicesIcon from '@mui/icons-material/Devices';
import SyncIcon from '@mui/icons-material/Sync';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import PaletteIcon from '@mui/icons-material/Palette';
import HistoryIcon from '@mui/icons-material/History';
import ImageIcon from '@mui/icons-material/Image';
import { ListItemLink } from '@/base/components/lists/ListItemLink.tsx';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';

export function Settings() {
    const { t } = useTranslation();

    useAppTitle(t('settings.title'));

    return (
        <List sx={{ padding: 0 }}>
            <ListItemLink to={AppRoutes.settings.childRoutes.appearance.path}>
                <ListItemIcon>
                    <PaletteIcon />
                </ListItemIcon>
                <ListItemText primary={t('settings.appearance.title')} />
            </ListItemLink>
            <ListItemLink to={AppRoutes.settings.childRoutes.reader.path}>
                <ListItemIcon>
                    <AutoStoriesIcon />
                </ListItemIcon>
                <ListItemText primary={t('reader.settings.title.reader')} />
            </ListItemLink>
            <ListItemLink to={AppRoutes.settings.childRoutes.library.path}>
                <ListItemIcon>
                    <CollectionsOutlinedBookmarkIcon />
                </ListItemIcon>
                <ListItemText primary={t('library.title')} />
            </ListItemLink>
            <ListItemLink to={AppRoutes.settings.childRoutes.download.path}>
                <ListItemIcon>
                    <GetAppOutlinedIcon />
                </ListItemIcon>
                <ListItemText primary={t('download.title.download')} />
            </ListItemLink>
            <ListItemLink to={AppRoutes.settings.childRoutes.images.path}>
                <ListItemIcon>
                    <ImageIcon />
                </ListItemIcon>
                <ListItemText primary={t('settings.images.title')} />
            </ListItemLink>
            <ListItemLink to={AppRoutes.settings.childRoutes.tracking.path}>
                <ListItemIcon>
                    <SyncIcon />
                </ListItemIcon>
                <ListItemText primary={t('tracking.title')} />
            </ListItemLink>
            <ListItemLink to={AppRoutes.settings.childRoutes.sync.path}>
                <ListItemIcon>
                    <CloudSyncIcon />
                </ListItemIcon>
                <ListItemText primary={t('sync.title')} />
            </ListItemLink>
            <ListItemLink to={AppRoutes.settings.childRoutes.backup.path}>
                <ListItemIcon>
                    <BackupIcon />
                </ListItemIcon>
                <ListItemText primary={t('settings.backup.title')} />
            </ListItemLink>

            <ListItemLink to={AppRoutes.settings.childRoutes.browse.path}>
                <ListItemIcon>
                    <ExploreOutlinedIcon />
                </ListItemIcon>
                <ListItemText primary={t('global.label.browse')} />
            </ListItemLink>
            <ListItemLink to={AppRoutes.settings.childRoutes.history.path}>
                <ListItemIcon>
                    <HistoryIcon />
                </ListItemIcon>
                <ListItemText primary={t('history.title')} />
            </ListItemLink>
            <ListItemLink to={AppRoutes.settings.childRoutes.device.path}>
                <ListItemIcon>
                    <DevicesIcon />
                </ListItemIcon>
                <ListItemText primary={t('settings.device.title.device')} />
            </ListItemLink>
            <ListItemLink to={AppRoutes.settings.childRoutes.server.path}>
                <ListItemIcon>
                    <DnsIcon />
                </ListItemIcon>
                <ListItemText primary={t('settings.server.title.server')} />
            </ListItemLink>
        </List>
    );
}
