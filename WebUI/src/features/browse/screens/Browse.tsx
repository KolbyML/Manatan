/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Tab from '@mui/material/Tab';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParam } from 'use-query-params';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Sources } from '@/features/browse/sources/Sources.tsx';
import { Extensions } from '@/features/browse/extensions/Extensions.tsx';
import { AnimeSources } from '@/features/browse/sources/AnimeSources.tsx';
import { AnimeExtensions } from '@/features/browse/extensions/AnimeExtensions.tsx';
import { TabPanel } from '@/base/components/tabs/TabPanel.tsx';
import { TabsWrapper } from '@/base/components/tabs/TabsWrapper.tsx';
import { TabsMenu } from '@/base/components/tabs/TabsMenu.tsx';
import { Migration } from '@/features/migration/screens/Migration.tsx';
import { AnimeMigration } from '@/features/migration/screens/AnimeMigration.tsx';
import { useResizeObserver } from '@/base/hooks/useResizeObserver.tsx';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { BrowseTab } from '@/features/browse/Browse.types.ts';
import { GROUPED_VIRTUOSO_Z_INDEX } from '@/lib/virtuoso/Virtuoso.constants.ts';
import { SearchParam } from '@/base/Base.types.ts';

export function Browse() {
    const { t } = useTranslation();
    useAppTitle(t('global.label.browse'));
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const tabLabelSx = isMobile
        ? {
              textTransform: 'none',
              whiteSpace: 'normal',
              lineHeight: 1.1,
              textAlign: 'center',
              minWidth: 96,
              px: 1,
          }
        : { textTransform: 'none' };

    const tabsMenuRef = useRef<HTMLDivElement | null>(null);
    const [tabsMenuHeight, setTabsMenuHeight] = useState(0);
    useResizeObserver(
        tabsMenuRef,
        useCallback(() => setTabsMenuHeight(tabsMenuRef.current!.offsetHeight), [tabsMenuRef.current]),
    );

    const [tabSearchParam, setTabSearchParam] = useQueryParam(SearchParam.TAB, StringParam, {});
    const tabName = (tabSearchParam as BrowseTab) ?? BrowseTab.MANGA_SOURCES;

    useEffect(() => {
        if (!tabSearchParam) {
            setTabSearchParam(tabName, 'replaceIn');
        }
    }, [tabSearchParam, tabName, setTabSearchParam]);

    return (
        <TabsWrapper>
            <TabsMenu
                ref={tabsMenuRef}
                sx={{ zIndex: GROUPED_VIRTUOSO_Z_INDEX }}
                variant={isMobile ? 'scrollable' : 'fullWidth'}
                value={tabName}
                onChange={(_, newTab) => setTabSearchParam(newTab, 'replaceIn')}
            >
                <Tab
                    value={BrowseTab.ANIME_SOURCES}
                    sx={tabLabelSx}
                    label={isMobile ? (
                        <span>
                            Anime
                            <br />
                            Sources
                        </span>
                    ) : (
                        'Anime Sources'
                    )}
                />
                <Tab
                    value={BrowseTab.MANGA_SOURCES}
                    sx={tabLabelSx}
                    label={isMobile ? (
                        <span>
                            Manga
                            <br />
                            Sources
                        </span>
                    ) : (
                        'Manga Sources'
                    )}
                />
                <Tab
                    value={BrowseTab.ANIME_EXTENSIONS}
                    sx={tabLabelSx}
                    label={isMobile ? (
                        <span>
                            Anime
                            <br />
                            Extensions
                        </span>
                    ) : (
                        'Anime Extensions'
                    )}
                />
                <Tab value={BrowseTab.MANGA_EXTENSIONS} sx={tabLabelSx} label="Manga Extensions" />
                <Tab value={BrowseTab.ANIME_MIGRATE} sx={tabLabelSx} label="Migrate Anime" />
                <Tab value={BrowseTab.MANGA_MIGRATE} sx={tabLabelSx} label="Migrate Manga" />
            </TabsMenu>
            <TabPanel index={BrowseTab.SOURCE_DEPRECATED} currentIndex={tabName}>
                <Sources tabsMenuHeight={tabsMenuHeight} />
            </TabPanel>
            <TabPanel index={BrowseTab.ANIME_SOURCES} currentIndex={tabName}>
                <AnimeSources tabsMenuHeight={tabsMenuHeight} />
            </TabPanel>
            <TabPanel index={BrowseTab.MANGA_SOURCES} currentIndex={tabName}>
                <Sources tabsMenuHeight={tabsMenuHeight} />
            </TabPanel>
            <TabPanel index={BrowseTab.ANIME_EXTENSIONS} currentIndex={tabName}>
                <AnimeExtensions tabsMenuHeight={tabsMenuHeight} />
            </TabPanel>
            <TabPanel index={BrowseTab.MANGA_EXTENSIONS} currentIndex={tabName}>
                <Extensions tabsMenuHeight={tabsMenuHeight} />
            </TabPanel>
            <TabPanel index={BrowseTab.ANIME_MIGRATE} currentIndex={tabName}>
                <AnimeMigration tabsMenuHeight={tabsMenuHeight} />
            </TabPanel>
            <TabPanel index={BrowseTab.MANGA_MIGRATE} currentIndex={tabName}>
                <Migration tabsMenuHeight={tabsMenuHeight} />
            </TabPanel>
        </TabsWrapper>
    );
}
