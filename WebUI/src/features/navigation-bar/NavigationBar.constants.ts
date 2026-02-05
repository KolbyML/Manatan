/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import MenuBookIcon from '@mui/icons-material/MenuBook';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import MovieFilterOutlinedIcon from '@mui/icons-material/MovieFilterOutlined';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import TranslateIcon from '@mui/icons-material/Translate';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import NewReleasesOutlinedIcon from '@mui/icons-material/NewReleasesOutlined';
import HistoryIcon from '@mui/icons-material/History';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import ExploreIcon from '@mui/icons-material/Explore';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import GetAppIcon from '@mui/icons-material/GetApp';
import GetAppOutlinedIcon from '@mui/icons-material/GetAppOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoIcon from '@mui/icons-material/Info';
import { useTranslation } from 'react-i18next';
import { NavbarItem, NavBarItemMoreGroup } from '@/features/navigation-bar/NavigationBar.types.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { DownloaderState } from '@/lib/graphql/generated/graphql.ts';

type RestrictedNavBarItem<Show extends NavbarItem['show']> = Omit<NavbarItem, 'show'> & { show: Show };

const NAVIGATION_BAR_BASE_ITEMS = [
    {
        path: AppRoutes.anime.path as RestrictedNavBarItem<'both'>['path'],
        title: 'Anime',
        SelectedIconComponent: MovieFilterIcon,
        IconComponent: MovieFilterOutlinedIcon,
        show: 'both',
        moreGroup: NavBarItemMoreGroup.GENERAL,
    },
    {
        path: AppRoutes.library.path() as RestrictedNavBarItem<'both'>['path'],
        title: 'Manga',
        SelectedIconComponent: MenuBookIcon,
        IconComponent: MenuBookOutlinedIcon,
        show: 'both',
        moreGroup: NavBarItemMoreGroup.GENERAL,
    },
    {
        path: AppRoutes.ln.path as RestrictedNavBarItem<'both'>['path'],
        title: 'Novels',
        SelectedIconComponent: AutoStoriesIcon,
        IconComponent: AutoStoriesIcon,
        show: 'both',
        moreGroup: NavBarItemMoreGroup.GENERAL,
    },
    {
        path: AppRoutes.dictionary.path as RestrictedNavBarItem<'both'>['path'],
        title: 'Dictionary',
        SelectedIconComponent: TranslateIcon,
        IconComponent: TranslateOutlinedIcon,
        show: 'both',
        moreGroup: NavBarItemMoreGroup.GENERAL,
    },
    {
        path: AppRoutes.history.path,
        title: 'history.title',
        SelectedIconComponent: HistoryIcon,
        IconComponent: HistoryOutlinedIcon,
        show: 'desktop',
        moreGroup: NavBarItemMoreGroup.HIDDEN_ITEM,
    },
    {
        path: AppRoutes.browse.path() as RestrictedNavBarItem<'both'>['path'],
        title: 'global.label.browse',
        SelectedIconComponent: ExploreIcon,
        IconComponent: ExploreOutlinedIcon,
        show: 'both',
        moreGroup: NavBarItemMoreGroup.GENERAL,
        useBadge: () => {
            const { t } = useTranslation();
            const { data } = requestManager.useGetExtensionList({ fetchPolicy: 'cache-only' });

            const extensions = data?.extensions.nodes ?? [];
            const availableUpdates = extensions.filter((extension) => extension.hasUpdate).length;

            if (!availableUpdates) {
                return {
                    count: availableUpdates,
                    title: '',
                };
            }

            return {
                count: availableUpdates,
                title: t('extension.label.available_updates', { count: availableUpdates }),
            };
        },
    },
] as const satisfies RestrictedNavBarItem<'both'>[];

const NAVIGATION_BAR_DESKTOP_ITEMS = [
    {
        path: AppRoutes.updates.path,
        title: 'updates.title',
        SelectedIconComponent: NewReleasesIcon,
        IconComponent: NewReleasesOutlinedIcon,
        show: 'desktop',
        moreGroup: NavBarItemMoreGroup.GENERAL,
    },
    {
        path: AppRoutes.downloads.path,
        title: 'download.title.download',
        moreTitle: 'download.title.queue',
        SelectedIconComponent: GetAppIcon,
        IconComponent: GetAppOutlinedIcon,
        show: 'desktop',
        moreGroup: NavBarItemMoreGroup.HIDDEN_ITEM,
        useBadge: () => {
            const { t } = useTranslation();
            const { data } = requestManager.useGetDownloadStatus();
            const downloadStatus = data?.downloadStatus;

            const isPaused = downloadStatus?.state === DownloaderState.Stopped;
            const count = downloadStatus?.queue.length ?? 0;

            if (!count) {
                return {
                    count,
                    title: '',
                };
            }

            return {
                count,
                title: t(isPaused ? 'download.queue.info.paused' : 'download.queue.info.remaining', { count }),
            };
        },
    },
    {
        path: AppRoutes.settings.path,
        title: 'settings.title',
        SelectedIconComponent: SettingsIcon,
        IconComponent: SettingsIcon,
        show: 'desktop',
        moreGroup: NavBarItemMoreGroup.SETTING_INFO,
    },
    {
        path: AppRoutes.about.path,
        title: 'settings.about.title',
        SelectedIconComponent: InfoIcon,
        IconComponent: InfoIcon,
        show: 'desktop',
        moreGroup: NavBarItemMoreGroup.SETTING_INFO,
    },
] as const satisfies RestrictedNavBarItem<'desktop'>[];

export const NAVIGATION_BAR_MOBILE_ITEMS = [
    {
        path: AppRoutes.more.path,
        title: 'global.label.more',
        SelectedIconComponent: MoreHorizIcon,
        IconComponent: MoreHorizIcon,
        show: 'mobile',
        moreGroup: NavBarItemMoreGroup.GENERAL,
    },
] as const satisfies RestrictedNavBarItem<'mobile'>[];

export const NAVIGATION_BAR_ITEMS = [
    ...NAVIGATION_BAR_BASE_ITEMS,
    ...NAVIGATION_BAR_DESKTOP_ITEMS,
    ...NAVIGATION_BAR_MOBILE_ITEMS,
] as const satisfies NavbarItem[];
