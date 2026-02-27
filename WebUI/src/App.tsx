/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import CssBaseline from '@mui/material/CssBaseline';
import React, { useEffect, useLayoutEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { loadable } from 'react-lazily/loadable';
import Box from '@mui/material/Box';
import { AwaitableComponent } from 'awaitable-component';
import { AppContext } from '@/base/contexts/AppContext.tsx';
import { DefaultNavBar } from '@/features/navigation-bar/components/DefaultNavBar.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { lazyLoadFallback } from '@/base/utils/LazyLoad.tsx';
import { ErrorBoundary } from '@/base/components/feedback/ErrorBoundary.tsx';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { BrowseTab } from '@/features/browse/Browse.types.ts';
import { useNavigationSettings } from '@/features/navigation-bar/NavigationBar.hooks.ts';
import { LoginPage } from '@/features/authentication/screens/LoginPage.tsx';
import { AuthGuard } from '@/features/authentication/components/AuthGuard.tsx';
import { SearchParam } from '@/base/Base.types.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { ReactRouter } from '@/lib/react-router/ReactRouter.ts';
import { AuthManager } from '@/features/authentication/AuthManager.ts';
import { ImageProcessingType } from '@/features/settings/Settings.types.ts';

// Manatan OCR Desktop Script Initialization
import { OCRProvider } from '@/Manatan/context/OCRContext';
import { OCRManager } from '@/Manatan/OCRManager.tsx';

// Manatan Sync Provider
import { SyncProvider } from '@/features/sync/services/SyncContext';
import { MembershipPerksPopup } from '@/features/membership/components/MembershipPerksPopup.tsx';

const { Browse } = loadable(() => import('@/features/browse/screens/Browse.tsx'), lazyLoadFallback);
const { DownloadQueue } = loadable(() => import('@/features/downloads/screens/DownloadQueue.tsx'), lazyLoadFallback);
const { Library } = loadable(() => import('@/features/library/screens/Library.tsx'), lazyLoadFallback);
const { AnimeLibrary } = loadable(() => import('@/features/anime/screens/AnimeLibrary.tsx'), lazyLoadFallback);
const { AnimeDetails } = loadable(() => import('@/features/anime/screens/AnimeDetails.tsx'), lazyLoadFallback);
const { AnimeEpisode } = loadable(() => import('@/features/anime/reader/screens/AnimeEpisode.tsx'), lazyLoadFallback);
const { AnimeSourceBrowse } = loadable(
    () => import('@/features/anime/browse/screens/AnimeSourceBrowse.tsx'),
    lazyLoadFallback,
);
const { AnimeSourceConfigure } = loadable(
    () => import('@/features/source/configuration/screens/AnimeSourceConfigure.tsx'),
    lazyLoadFallback,
);
const { Manga } = loadable(() => import('@/features/manga/screens/Manga.tsx'), lazyLoadFallback);
const { SearchAll } = loadable(() => import('@/features/global-search/screens/SearchAll.tsx'), lazyLoadFallback);
const { Settings } = loadable(() => import('@/features/settings/screens/Settings.tsx'), lazyLoadFallback);
const { About } = loadable(() => import('@/features/settings/screens/About.tsx'), lazyLoadFallback);
const { Backup } = loadable(() => import('@/features/backup/screens/Backup.tsx'), lazyLoadFallback);
const { CategorySettings } = loadable(
    () => import('@/features/category/screens/CategorySettings.tsx'),
    lazyLoadFallback,
);
const { SourceConfigure } = loadable(
    () => import('@/features/source/configuration/screens/SourceConfigure.tsx'),
    lazyLoadFallback,
);
const { SourceMangas } = loadable(() => import('@/features/source/browse/screens/SourceMangas.tsx'), lazyLoadFallback);
const { ExtensionInfo } = loadable(
    () => import('@/features/extension/info/screens/ExtensionInfo.tsx'),
    lazyLoadFallback,
);
const { AnimeExtensionInfo } = loadable(
    () => import('@/features/extension/info/screens/AnimeExtensionInfo.tsx'),
    lazyLoadFallback,
);
const { Updates } = loadable(() => import('@/features/updates/screens/Updates.tsx'), lazyLoadFallback);
const { History } = loadable(() => import('@/features/history/screens/History.tsx'), lazyLoadFallback);
const { LibrarySettings } = loadable(() => import('@/features/library/screens/LibrarySettings.tsx'), lazyLoadFallback);
const { DownloadSettings } = loadable(
    () => import('@/features/downloads/screens/DownloadSettings.tsx'),
    lazyLoadFallback,
);
const { ImagesSettings } = loadable(() => import('@/features/settings/screens/ImagesSettings.tsx'), lazyLoadFallback);
const { ImageProcessingSetting } = loadable(
    () => import('@/features/settings/screens/ImageProcessingSetting.tsx'),
    lazyLoadFallback,
);
const { ServerSettings } = loadable(() => import('@/features/settings/screens/ServerSettings.tsx'), lazyLoadFallback);
const { BrowseSettings } = loadable(() => import('@/features/browse/screens/BrowseSettings.tsx'), lazyLoadFallback);
const { Migrate } = loadable(() => import('@/features/migration/screens/Migrate.tsx'), lazyLoadFallback);
const { DeviceSetting } = loadable(() => import('@/features/device/screens/DeviceSetting.tsx'), lazyLoadFallback);
const { TrackingSettings } = loadable(
    () => import('@/features/tracker/screens/TrackingSettings.tsx'),
    lazyLoadFallback,
);
const { TrackerOAuthLogin } = loadable(
    () => import('@/features/tracker/screens/TrackerOAuthLogin.tsx'),
    lazyLoadFallback,
);
const { LibraryDuplicates } = loadable(
    () => import('@/features/library/screens/LibraryDuplicates.tsx'),
    lazyLoadFallback,
);
const { Appearance } = loadable(() => import('@/features/settings/screens/Appearance.tsx'), lazyLoadFallback);
const { GlobalReaderSettings } = loadable(
    () => import('@/features/reader/settings/screens/GlobalReaderSettings.tsx'),
    lazyLoadFallback,
);
const { More } = loadable(() => import('@/features/settings/screens/More.tsx'), lazyLoadFallback);
const { Reader } = loadable(() => import('@/features/reader/screens/Reader.tsx'), lazyLoadFallback);
const { HistorySettings } = loadable(() => import('@/features/history/screens/HistorySettings.tsx'), lazyLoadFallback);
const { LNLibrary } = loadable(() => import('@/features/ln/screens/LNLibrary.tsx'), lazyLoadFallback);
const { LNReaderScreen } = loadable(() => import('@/features/ln/reader/screens/LNReaderScreen.tsx'), lazyLoadFallback);
const { Dictionary } = loadable(() => import('@/features/dictionary/Dictionary.tsx'), lazyLoadFallback);
const { SyncSettings } = loadable(() => import('@/features/sync/screens/SyncSettings.tsx'), lazyLoadFallback);

if (import.meta.env.DEV) {
    // Adds messages only in a dev environment
}

const ScrollToTop = () => {
    const { pathname } = useLocation();

    useLayoutEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
};

const InitialBackgroundRequests = () => {
    // Load the full download status once on startup to fill the cache
    requestManager.useGetDownloadStatus({ nextFetchPolicy: 'standby' });

    const [fetchExtensionList] = requestManager.useExtensionListFetch();

    useEffect(() => {
        // Fetch extension list on startup to show up-to-date number of available extension updates in the navigation bar
        // without having to open the extensions page.
        fetchExtensionList().catch(defaultPromiseErrorHandler('App::InitialBackgroundRequests: extension list'));

        // Trigger LN migration from IndexedDB to server
        import('@/lib/storage/AppStorage').then(({ AppStorage }) => {
            AppStorage.migrateLnMetadata().catch(err => console.error('[App] LN migration failed:', err));
        });
    }, []);

    return null;
};

/**
 * Creates permanent subscriptions to always have the latest data.
 *
 * E.g. in case a view is open, which does not subscribe to the download updates, finished downloads are never received
 * and thus, data of existing chapters/mangas in the cache get outdated
 */
const BackgroundSubscriptions = () => {
    const { isAuthRequired, accessToken } = AuthManager.useSession();

    const skipConnection = isAuthRequired === null || (isAuthRequired && !accessToken);

    requestManager.useDownloadSubscription({ skip: skipConnection });
    requestManager.useUpdaterSubscription({ skip: skipConnection });
    requestManager.useServerSettingsSubscription({ skip: skipConnection });
    requestManager.useGlobalMetaSubscription({ skip: skipConnection });

    return null;
};

const ReactRouterSetter = () => {
    const navigate = useNavigate();

    useEffect(() => {
        ReactRouter.setNavigateFn(navigate);
    }, []);

    return null;
};

const PrivateRoutes = () => {
    const isAuthenticated = AuthManager.useIsAuthenticated();

    if (!isAuthenticated) {
        return (
            <Navigate
                to={{
                    pathname: AppRoutes.authentication.childRoutes.login.path,
                    search: `${SearchParam.REDIRECT}=${window.location.pathname}`,
                }}
                replace
            />
        );
    }

    return <Outlet />;
};

const MainApp = () => {
    const { navBarWidth, appBarHeight, bottomBarHeight } = useNavBarContext();

    const {
        settings: { hideHistory },
    } = useMetadataServerSettings();
    const { defaultStartupPage } = useNavigationSettings();

    return (
        <Box
            id="appMainContainer"
            component="main"
            sx={{
                minHeight: `calc(100vh - ${appBarHeight + bottomBarHeight}px)`,
                width: `calc(100vw - (100vw - 100%) - ${navBarWidth}px)`,
                minWidth: `calc(100vw - (100vw - 100%) - ${navBarWidth}px)`,
                maxWidth: `calc(100vw - (100vw - 100%) - ${navBarWidth}px)`,
                position: 'relative',
                mt: `${appBarHeight}px`,
                pb: `calc(${bottomBarHeight}px + ${!bottomBarHeight ? 'env(safe-area-inset-bottom)' : '0px'})`,
                pr: 'env(safe-area-inset-right)',
            }}
        >
            <ErrorBoundary>
                <Routes>
                    <Route path={AppRoutes.authentication.match}>
                        <Route path={AppRoutes.authentication.childRoutes.login.match} element={<LoginPage />} />
                    </Route>

                    <Route element={<PrivateRoutes />}>
                        {/* General Routes */}
                        <Route path={AppRoutes.root.match} element={<Navigate to={defaultStartupPage} replace />} />
                        <Route
                            path={AppRoutes.matchAll.match}
                            element={<Navigate to={AppRoutes.root.path} replace />}
                        />
                        <Route path={AppRoutes.more.match} element={<More />} />
                        <Route path={AppRoutes.about.match} element={<About />} />
                        <Route path={AppRoutes.settings.match}>
                            <Route index element={<Settings />} />
                            <Route
                                path={AppRoutes.settings.childRoutes.categories.match}
                                element={<CategorySettings />}
                            />
                            <Route
                                path={AppRoutes.settings.childRoutes.reader.match}
                                element={<GlobalReaderSettings />}
                            />
                            <Route path={AppRoutes.settings.childRoutes.library.match}>
                                <Route index element={<LibrarySettings />} />
                                <Route
                                    path={AppRoutes.settings.childRoutes.library.childRoutes.duplicates.match}
                                    element={<LibraryDuplicates />}
                                />
                            </Route>
                            <Route path={AppRoutes.settings.childRoutes.download.match}>
                                <Route index element={<DownloadSettings />} />
                                {/* TODO: deprecated - got moved to "settings/images/processing/downloads" */}
                                <Route
                                    path={AppRoutes.settings.childRoutes.download.childRoutes.conversions.match}
                                    element={
                                        <Navigate
                                            to={
                                                AppRoutes.settings.childRoutes.images.childRoutes.processingDownloads
                                                    .path
                                            }
                                            replace
                                        />
                                    }
                                />
                            </Route>
                            <Route path={AppRoutes.settings.childRoutes.images.match}>
                                <Route index element={<ImagesSettings />} />
                                <Route
                                    path={AppRoutes.settings.childRoutes.images.childRoutes.processingDownloads.match}
                                    element={<ImageProcessingSetting type={ImageProcessingType.DOWNLOAD} />}
                                />
                                <Route
                                    path={AppRoutes.settings.childRoutes.images.childRoutes.processingServe.match}
                                    element={<ImageProcessingSetting type={ImageProcessingType.SERVE} />}
                                />
                            </Route>
                            <Route path={AppRoutes.settings.childRoutes.backup.match} element={<Backup />} />
                            <Route path={AppRoutes.settings.childRoutes.server.match} element={<ServerSettings />} />
                            <Route path={AppRoutes.settings.childRoutes.browse.match} element={<BrowseSettings />} />
                            <Route path={AppRoutes.settings.childRoutes.history.match} element={<HistorySettings />} />
                            <Route path={AppRoutes.settings.childRoutes.device.match} element={<DeviceSetting />} />
                            <Route
                                path={AppRoutes.settings.childRoutes.tracking.match}
                                element={<TrackingSettings />}
                            />
                            <Route path={AppRoutes.settings.childRoutes.sync.match} element={<SyncSettings />} />
                            <Route path={AppRoutes.settings.childRoutes.appearance.match} element={<Appearance />} />
                        </Route>

                        {/* Manga Routes */}

                        <Route path={AppRoutes.sources.match}>
                            {/* TODO: deprecated - "source" and "extension" page got merged into "browse" */}
                            <Route
                                index
                                element={<Navigate to={AppRoutes.browse.path(BrowseTab.MANGA_SOURCES)} replace />}
                            />
                            <Route path={AppRoutes.sources.childRoutes.browse.match} element={<SourceMangas />} />
                            <Route path={AppRoutes.sources.childRoutes.configure.match} element={<SourceConfigure />} />
                            <Route path={AppRoutes.sources.childRoutes.searchAll.match} element={<SearchAll />} />
                        </Route>
                        <Route path={AppRoutes.animeSources.match}>
                            <Route
                                path={AppRoutes.animeSources.childRoutes.browse.match}
                                element={<AnimeSourceBrowse />}
                            />
                            <Route
                                path={AppRoutes.animeSources.childRoutes.configure.match}
                                element={<AnimeSourceConfigure />}
                            />
                        </Route>
                        <Route path={AppRoutes.extension.match}>
                            {/* TODO: deprecated - "source" and "extension" page got merged into "browse" */}
                            <Route
                                index
                                element={<Navigate to={AppRoutes.browse.path(BrowseTab.MANGA_EXTENSIONS)} replace />}
                            />
                            <Route path={AppRoutes.extension.childRoutes.info.match} element={<ExtensionInfo />} />
                        </Route>

                        <Route path={AppRoutes.animeExtension.match}>
                            <Route
                                index
                                element={<Navigate to={AppRoutes.browse.path(BrowseTab.ANIME_EXTENSIONS)} replace />}
                            />
                            <Route
                                path={AppRoutes.animeExtension.childRoutes.info.match}
                                element={<AnimeExtensionInfo />}
                            />
                        </Route>
                        <Route path={AppRoutes.downloads.match} element={<DownloadQueue />} />
                        <Route path={AppRoutes.manga.match}>
                            <Route path={AppRoutes.manga.childRoutes.reader.match} element={null} />
                            <Route index element={<Manga />} />
                        </Route>
                        <Route path={AppRoutes.anime.match}>
                            <Route path={AppRoutes.anime.childRoutes.episode.match} element={<AnimeEpisode />} />
                            <Route path={AppRoutes.anime.childRoutes.details.match} element={<AnimeDetails />} />
                            <Route index element={<AnimeLibrary />} />
                        </Route>
                        <Route path={AppRoutes.library.match} element={<Library />} />
                        <Route path={AppRoutes.dictionary.match} element={<Dictionary />} />
                        <Route path={AppRoutes.updates.match} element={<Updates />} />
                        {!hideHistory && <Route path={AppRoutes.history.match} element={<History />} />}
                        <Route path={AppRoutes.browse.match} element={<Browse />} />
                        <Route path={AppRoutes.migrate.match}>
                            <Route index element={<Migrate />} />
                            <Route path={AppRoutes.migrate.childRoutes.search.match} element={<SearchAll />} />
                        </Route>
                        {/* LN Library Route */}
                        <Route path={AppRoutes.ln.match} element={<LNLibrary />} />
                        <Route path={AppRoutes.tracker.match} element={<TrackerOAuthLogin />} />
                    </Route>
                </Routes>
            </ErrorBoundary>
        </Box>
    );
};

const ReaderApp = () => (
    <ErrorBoundary>
        <Routes>
            <Route element={<PrivateRoutes />}>
                <Route path={AppRoutes.matchAll.match} element={<Reader />} />
            </Route>
        </Routes>
    </ErrorBoundary>
);

const ReaderLayout = () => (
    <Box sx={{ display: 'flex' }}>
        <Box sx={{ flexShrink: 0, position: 'relative', height: '100vh' }}>
            <DefaultNavBar />
        </Box>
        <ReaderApp />
    </Box>
);

const LNReaderApp = () => (
    <ErrorBoundary>
        <Routes>
            <Route element={<PrivateRoutes />}>
                <Route path="*" element={<LNReaderScreen />} />
            </Route>
        </Routes>
    </ErrorBoundary>
);

export const App: React.FC = () => (
    <AppContext>
        <ScrollToTop />
        <AwaitableComponent.Root />

        <AuthGuard>
            <InitialBackgroundRequests />
            <BackgroundSubscriptions />

            <ReactRouterSetter />

            <CssBaseline enableColorScheme />
            <MembershipPerksPopup />
            <OCRProvider>
                <OCRManager />
                <SyncProvider>
                    <Routes>
                        {/* Fullscreen Reader Routes */}
                        <Route
                            path={`${AppRoutes.ln.match}/${AppRoutes.ln.childRoutes.reader.match}/*`}
                            element={<LNReaderApp />}
                        />
                        <Route path={AppRoutes.reader.match} element={<ReaderLayout />} />

                        {/* Main App Layout with Sidebar */}
                        <Route
                            path="*"
                            element={
                                <Box sx={{ display: 'flex' }}>
                                    <Box sx={{ flexShrink: 0, position: 'relative', height: '100vh' }}>
                                        <DefaultNavBar />
                                    </Box>
                                    <MainApp />
                                </Box>
                            }
                        />
                    </Routes>
                </SyncProvider>
            </OCRProvider>
        </AuthGuard>
    </AppContext>
);
