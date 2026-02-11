/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { RequestError } from '@/lib/requests/RequestError.ts';
import { DefaultLanguage } from '@/base/utils/Languages.ts';
import { UrlUtil } from '@/lib/UrlUtil.ts';
import { NetworkStatus } from '@/lib/requests/RequestStatus.ts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { d } from 'koration';
import { HttpMethod, IRestClient, RestClient } from '@/lib/requests/client/RestClient.ts';
import { BaseClient } from '@/lib/requests/client/BaseClient.ts';
import {
    ChapterConditionInput,
    CheckForServerUpdatesQuery,
    CheckForServerUpdatesQueryVariables,
    ClearCachedImagesInput,
    ClearDownloaderMutation,
    ClearDownloaderMutationVariables,
    ClearServerCacheMutation,
    ClearServerCacheMutationVariables,
    CreateCategoryInput,
    CreateCategoryMutation,
    CreateCategoryMutationVariables,
    DeleteCategoryMetadataMutation,
    DeleteCategoryMetadataMutationVariables,
    DeleteCategoryMutation,
    DeleteCategoryMutationVariables,
    DeleteChapterMetadataMutation,
    DeleteChapterMetadataMutationVariables,
    DeleteDownloadedChapterMutation,
    DeleteDownloadedChapterMutationVariables,
    DeleteDownloadedChaptersMutation,
    DeleteDownloadedChaptersMutationVariables,
    DeleteGlobalMetadataMutation,
    DeleteGlobalMetadataMutationVariables,
    DeleteMangaMetadataMutation,
    DeleteMangaMetadataMutationVariables,
    DeleteSourceMetadataMutation,
    DeleteSourceMetadataMutationVariables,
    DequeueChapterDownloadMutation,
    DequeueChapterDownloadMutationVariables,
    DequeueChapterDownloadsMutation,
    DequeueChapterDownloadsMutationVariables,
    DownloadStatusSubscription,
    DownloadStatusSubscriptionVariables,
    EnqueueChapterDownloadMutation,
    EnqueueChapterDownloadMutationVariables,
    EnqueueChapterDownloadsMutation,
    EnqueueChapterDownloadsMutationVariables,
    FetchSourceMangaInput,
    FetchSourceMangaType,
    FilterChangeInput,
    GetAboutQuery,
    GetAboutQueryVariables,
    GetCategoriesBaseQuery,
    GetCategoriesBaseQueryVariables,
    GetCategoriesLibraryQuery,
    GetCategoriesLibraryQueryVariables,
    GetCategoriesSettingsQuery,
    GetCategoriesSettingsQueryVariables,
    GetChapterPagesFetchMutation,
    GetChapterPagesFetchMutationVariables,
    GetChaptersMangaQuery,
    GetChaptersMangaQueryVariables,
    GetChaptersUpdatesQuery,
    GetChaptersUpdatesQueryVariables,
    GetChaptersHistoryQuery,
    GetChaptersHistoryQueryVariables,
    GetDownloadStatusQuery,
    GetDownloadStatusQueryVariables,
    GetExtensionsFetchMutation,
    GetExtensionsFetchMutationVariables,
    GetExtensionsQuery,
    GetExtensionsQueryVariables,
    GetGlobalMetadatasQuery,
    GetGlobalMetadatasQueryVariables,
    GetLibraryMangaCountQuery,
    GetLibraryMangaCountQueryVariables,
    GetLastUpdateTimestampQuery,
    GetLastUpdateTimestampQueryVariables,
    GetMangaChaptersFetchMutation,
    GetMangaChaptersFetchMutationVariables,
    GetMangaFetchMutation,
    GetMangaFetchMutationVariables,
    GetMangaCategoriesQuery,
    GetMangaCategoriesQueryVariables,
    GetMangasDuplicatesQuery,
    GetMangasDuplicatesQueryVariables,
    GetMangasChapterIdsWithStateQuery,
    GetMangasChapterIdsWithStateQueryVariables,
    GetMangasBaseQuery,
    GetMangasBaseQueryVariables,
    GetMangasLibraryQuery,
    GetMangasLibraryQueryVariables,
    GetMangaToMigrateQuery,
    GetMangaToMigrateToFetchMutation,
    GetMigratableSourceMangasQuery,
    GetMigratableSourceMangasQueryVariables,
    GetMigratableSourcesQuery,
    GetMigratableSourcesQueryVariables,
    GetRestoreStatusQuery,
    GetRestoreStatusQueryVariables,
    GetServerSettingsQuery,
    GetServerSettingsQueryVariables,
    GetSourceMangasFetchMutation,
    GetSourceMangasFetchMutationVariables,
    GetSourcesListQuery,
    GetSourcesListQueryVariables,
    GetUpdateStatusQuery,
    GetUpdateStatusQueryVariables,
    InstallExternalExtensionMutation,
    InstallExternalExtensionMutationVariables,
    ReorderChapterDownloadMutation,
    ReorderChapterDownloadMutationVariables,
    RestoreBackupMutation,
    RestoreBackupMutationVariables,
    SetCategoryMetadataMutation,
    SetCategoryMetadataMutationVariables,
    SetChapterMetadataMutation,
    SetChapterMetadataMutationVariables,
    SetGlobalMetadataMutation,
    SetGlobalMetadataMutationVariables,
    SetMangaMetadataMutation,
    SetMangaMetadataMutationVariables,
    SetSourceMetadataMutation,
    SetSourceMetadataMutationVariables,
    SourcePreferenceChangeInput,
    StartDownloaderMutation,
    StartDownloaderMutationVariables,
    StopDownloaderMutation,
    StopDownloaderMutationVariables,
    StopUpdaterMutation,
    StopUpdaterMutationVariables,
    TrackerBindMutation,
    TrackerBindMutationVariables,
    TrackerFetchBindMutation,
    TrackerFetchBindMutationVariables,
    TrackerLoginCredentialsMutation,
    TrackerLoginCredentialsMutationVariables,
    TrackerLoginOauthMutation,
    TrackerLoginOauthMutationVariables,
    TrackerLogoutMutation,
    TrackerLogoutMutationVariables,
    TrackerSearchQuery,
    TrackerSearchQueryVariables,
    TrackerUnbindMutation,
    TrackerUnbindMutationVariables,
    TrackerUpdateBindMutation,
    TrackerUpdateBindMutationVariables,
    UpdateCategoryMutation,
    UpdateCategoryMutationVariables,
    UpdateCategoryOrderMutation,
    UpdateCategoryOrderMutationVariables,
    UpdateCategoryPatchInput,
    UpdateChapterMutation,
    UpdateChapterMutationVariables,
    UpdateChapterPatchInput,
    UpdateChaptersMutation,
    UpdateChaptersMutationVariables,
    UpdateExtensionMutation,
    UpdateExtensionMutationVariables,
    UpdateExtensionPatchInput,
    UpdateExtensionsMutation,
    UpdateExtensionsMutationVariables,
    UpdateMangaCategoriesMutation,
    UpdateMangaCategoriesMutationVariables,
    UpdateMangaCategoriesPatchInput,
    UpdateMangaMutation,
    UpdateMangaMutationVariables,
    UpdateMangaPatchInput,
    UpdateMangasCategoriesMutation,
    UpdateMangasCategoriesMutationVariables,
    UpdateMangasMutation,
    UpdateMangasMutationVariables,
    UpdaterSubscription,
    UpdaterSubscriptionVariables,
    UpdateServerSettingsMutation,
    UpdateServerSettingsMutationVariables,
    UpdateSourcePreferencesMutation,
    UpdateSourcePreferencesMutationVariables,
    UpdateTrackInput,
    ValidateBackupQuery,
    ValidateBackupQueryVariables,
    UpdateLibraryMutation,
    UpdateLibraryMutationVariables,
    GetChaptersReaderQuery,
    GetChaptersReaderQueryVariables,
    GetExtensionQuery,
    GetExtensionQueryVariables,
    GetMangaReaderQuery,
    GetMangaReaderQueryVariables,
    GetMangaScreenQuery,
    GetMangaScreenQueryVariables,
    GetMangaTrackRecordsQuery,
    GetMangaTrackRecordsQueryVariables,
    GetSourceBrowseQuery,
    GetSourceBrowseQueryVariables,
    GetSourceMigratableQuery,
    GetSourceMigratableQueryVariables,
    GetSourceSettingsQuery,
    GetSourceSettingsQueryVariables,
    GetTrackersBindQuery,
    GetTrackersBindQueryVariables,
    GetTrackersSettingsQuery,
    GetTrackersSettingsQueryVariables,
    UserLoginMutation,
    UserLoginMutationVariables,
    UserRefreshMutation,
    UserRefreshMutationVariables,
    CreateBackupInput,
    CreateBackupMutation,
    CreateBackupMutationVariables,
    RestoreBackupInput,
    KoSyncLoginMutation,
    KoSyncLoginMutationVariables,
    KoSyncLogoutMutation,
    KoSyncLogoutMutationVariables,
    GetKoSyncStatusQuery,
    GetKoSyncStatusQueryVariables,
} from '@/lib/requests/types.ts';
import { CustomCache } from '@/lib/storage/CustomCache.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { QueuePriority } from '@/lib/Queue.ts';
import { SourceAwareQueue } from '@/lib/SourceAwareQueue.ts';
import { ControlledPromise } from '@/lib/ControlledPromise.ts';
import { MetadataMigrationSettings } from '@/features/migration/Migration.types.ts';
import { MangaIdInfo } from '@/features/manga/Manga.types.ts';
import { AuthManager } from '@/features/authentication/AuthManager.ts';
import {
    applyDownloadStatusUpdate,
    setDownloadStatusSnapshot,
} from '@/features/downloads/services/DownloadStatusStore.ts';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { ImageCache } from '@/lib/service-worker/ImageCache.ts';
import { Sources } from '@/features/source/services/Sources.ts';

type OperationVariables = Record<string, any>;
type MaybeMasked<T> = T;

type FetchResult<Data = any> = {
    data?: Data;
    errors?: unknown;
};

type ApolloQueryResult<Data = any> = {
    data?: Data;
    loading?: boolean;
    networkStatus?: NetworkStatus;
    error?: RequestError;
};

type QueryResult<Data = any, Variables extends OperationVariables = OperationVariables> = {
    client?: unknown;
    data?: Data;
    error?: RequestError;
    loading: boolean;
    networkStatus: NetworkStatus;
    refetch: () => Promise<ApolloQueryResult<Data>>;
    called: boolean;
    variables?: Variables;
    fetchMore: (...args: unknown[]) => Promise<ApolloQueryResult<Data>>;
    subscribeToMore: (...args: unknown[]) => () => void;
    startPolling: (interval?: number) => void;
    stopPolling: () => void;
    updateQuery: (...args: unknown[]) => void;
    reobserve: () => Promise<ApolloQueryResult<Data>>;
    reobserveCacheFirst: () => Promise<ApolloQueryResult<Data>>;
    observable?: unknown;
    previousData?: Data;
};

type MutationResult<Data = any> = {
    client?: unknown;
    data?: Data;
    error?: RequestError;
    loading: boolean;
    called: boolean;
    reset?: () => void;
};

type MutationTuple<Data = any, Variables extends OperationVariables = OperationVariables> = [
    (options?: MutationOptions<Data, Variables>) => Promise<FetchResult<Data>>,
    MutationResult<Data>,
];

type SubscriptionResult<Data = any, Variables extends OperationVariables = OperationVariables> = {
    data?: Data;
    error?: RequestError;
    loading: boolean;
    variables?: Variables;
};

type CustomRequestOptions = {
    /**
     * When enabled, an abort signal is included in the request context.
     * Avoid enabling by default to prevent argument churn and request spam on rerenders.
     */
    addAbortSignal?: boolean;
};
type RequestContext = { fetchOptions?: { signal?: AbortSignal } };
type RequestBaseOptions<Data = any, Variables extends OperationVariables = OperationVariables> = {
    variables?: Variables;
    skip?: boolean;
    notifyOnNetworkStatusChange?: boolean;
    onCompleted?: (data: Data) => void;
    onError?: (error: RequestError) => void;
    context?: RequestContext;
    refetchQueries?: unknown;
    awaitRefetchQueries?: boolean;
    fetchPolicy?: string;
    nextFetchPolicy?: string;
    errorPolicy?: string;
    pollInterval?: number;
};
type QueryOptions<Variables extends OperationVariables = OperationVariables, Data = any> = Partial<
    RequestBaseOptions<Data, Variables>
> &
    CustomRequestOptions;
type QueryHookOptions<Data = any, Variables extends OperationVariables = OperationVariables> = Partial<
    RequestBaseOptions<Data, Variables>
> &
    CustomRequestOptions;
type MutationHookOptions<Data = any, Variables extends OperationVariables = OperationVariables> = Partial<
    RequestBaseOptions<Data, Variables>
> &
    CustomRequestOptions;
type MutationOptions<Data = any, Variables extends OperationVariables = OperationVariables> = Partial<
    RequestBaseOptions<Data, Variables>
> &
    CustomRequestOptions;
type ApolloPaginatedMutationOptions<Data = any, Variables extends OperationVariables = OperationVariables> = Partial<
    MutationHookOptions<Data, Variables>
> & { skipRequest?: boolean };
type SubscriptionHookOptions<Data = any, Variables extends OperationVariables = OperationVariables> = Partial<
    RequestBaseOptions<Data, Variables>
> &
    Omit<CustomRequestOptions, 'addAbortSignal'> & { addAbortSignal?: never };

type AbortableRequest = { abortRequest: AbortController['abort'] };

export type ImageRequest = { response: Promise<string>; cleanup: () => void; fromCache: boolean } & AbortableRequest;
type ImageRequestOptions = {
    priority?: QueuePriority;
    shouldDecode?: boolean;
    disableCors?: boolean;
    ignoreQueue?: boolean;
};

export type AbortabaleApolloQueryResponse<Data = any> = {
    response: Promise<ApolloQueryResult<MaybeMasked<Data>>>;
} & AbortableRequest;
export type AbortableApolloUseQueryResponse<
    Data = any,
    Variables extends OperationVariables = OperationVariables,
> = QueryResult<MaybeMasked<Data>, Variables> & AbortableRequest;
export type AbortableApolloUseMutationResponse<
    Data = any,
    Variables extends OperationVariables = OperationVariables,
> = [MutationTuple<Data, Variables>[0], MutationTuple<Data, Variables>[1] & AbortableRequest];
export type AbortableApolloUseMutationPaginatedResponse<
    Data = any,
    Variables extends OperationVariables = OperationVariables,
> = [
    (page: number) => Promise<FetchResult<MaybeMasked<Data>>>,
    (Omit<MutationTuple<Data, Variables>[1], 'loading'> &
        AbortableRequest & {
            size: number;
            /**
             * Indicates whether any request is currently active.
             * In case only "isLoading" is true, it means that it's the initial request
             */
            isLoading: boolean;
            /**
             * Indicates if a next page is being fetched, which is not part of the initial pages
             */
            isLoadingMore: boolean;
            /**
             * Indicates if the cached pages are currently getting revalidated
             */
            isValidating: boolean;
        })[],
];
export type AbortableApolloMutationResponse<Data = any> = {
    response: Promise<FetchResult<MaybeMasked<Data>>>;
} & AbortableRequest;

const EXTENSION_LIST_CACHE_KEY = 'useExtensionListFetch';
const ANIME_EXTENSION_LIST_CACHE_KEY = 'useAnimeExtensionListFetch';

const CACHE_INITIAL_PAGES_FETCHING_KEY = 'GET_SOURCE_MANGAS_FETCH_FETCHING_INITIAL_PAGES';
const CACHE_PAGES_KEY = 'GET_SOURCE_MANGAS_FETCH_PAGES';
const CACHE_RESULTS_KEY = 'GET_SOURCE_MANGAS_FETCH';

export const SPECIAL_ED_SOURCES = {
    REVALIDATION_UNSUPPORTED: [
        '57122881048805941', // e-hentai
    ],
    REVALIDATION_SKIP_TTL: [Sources.LOCAL_SOURCE_ID],
};

// TODO - extract logic to reduce the size of this file... grew waaaaaaaaaaaaay too big peepoFat
// TODO - correctly update cache after all mutations instead of refetching queries
export class RequestManager {
    public static readonly API_VERSION = '/api/v1/';

    private readonly restClient: RestClient = new RestClient(this.refreshUser.bind(this));

    private readonly cache = new CustomCache();

    private readonly imageQueue: SourceAwareQueue;

    private serverSettingsSnapshot?: GetServerSettingsQuery;

    private readonly serverSettingsListeners = new Set<(settings?: GetServerSettingsQuery) => void>();

    private globalMetaSnapshot?: GetGlobalMetadatasQuery;

    private readonly globalMetaListeners = new Set<(meta?: GetGlobalMetadatasQuery) => void>();

    constructor() {
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const isHttp2 = isHttps && this.detectHttp2();

        this.imageQueue = new SourceAwareQueue(!isHttp2, 5);

        BaseClient.setTokenRefreshCompleteCallback(() => {
            this.processQueues();
        });
    }

    private detectHttp2(): boolean {
        const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];

        if (!entries.length) {
            return false;
        }

        return ['h2', 'h3'].includes(entries[0].nextHopProtocol);
    }

    public getClient(): IRestClient {
        return this.restClient;
    }

    public updateClient(config: RequestInit): void {
        this.restClient.updateConfig(config);
    }

    public reset(): void {
        AuthManager.setAuthRequired(null);
        AuthManager.setAuthInitialized(false);
        AuthManager.removeTokens();

        this.restClient.reset();

        this.cache.clear();
        this.imageQueue.clear();
        this.setServerSettingsSnapshot(undefined);
        this.setGlobalMetaSnapshot(undefined);
    }

    public processQueues(): void {
        this.restClient.processQueue();
    }

    public getBaseUrl(): string {
        return this.restClient.getBaseUrl();
    }

    private setServerSettingsSnapshot(settings?: GetServerSettingsQuery): void {
        this.serverSettingsSnapshot = settings;
        this.serverSettingsListeners.forEach((listener) => listener(settings));
    }

    private subscribeServerSettings(listener: (settings?: GetServerSettingsQuery) => void): () => void {
        this.serverSettingsListeners.add(listener);
        return () => this.serverSettingsListeners.delete(listener);
    }

    private buildGlobalMetaSnapshot(
        nodes: NonNullable<GetGlobalMetadatasQuery['metas']>['nodes'],
    ): GetGlobalMetadatasQuery {
        return {
            metas: {
                nodes,
                totalCount: nodes.length,
                pageInfo: {
                    endCursor: null,
                    hasNextPage: false,
                    hasPreviousPage: false,
                    startCursor: null,
                },
            },
        } as GetGlobalMetadatasQuery;
    }

    private setGlobalMetaSnapshot(meta?: GetGlobalMetadatasQuery): void {
        this.globalMetaSnapshot = meta;
        this.globalMetaListeners.forEach((listener) => listener(meta));
    }

    private subscribeGlobalMeta(listener: (meta?: GetGlobalMetadatasQuery) => void): () => void {
        this.globalMetaListeners.add(listener);
        return () => this.globalMetaListeners.delete(listener);
    }

    private upsertGlobalMetaSnapshot(key: string, value: string): void {
        const currentNodes = this.globalMetaSnapshot?.metas?.nodes ?? [];
        const filteredNodes = currentNodes.filter((node) => node.key !== key);
        const nodes = [...filteredNodes, { key, value }].sort((a, b) => a.key.localeCompare(b.key));
        this.setGlobalMetaSnapshot(this.buildGlobalMetaSnapshot(nodes));
    }

    private removeGlobalMetaSnapshot(key: string): void {
        const currentNodes = this.globalMetaSnapshot?.metas?.nodes ?? [];
        const nodes = currentNodes.filter((node) => node.key !== key);
        this.setGlobalMetaSnapshot(this.buildGlobalMetaSnapshot(nodes));
    }

    public useBaseUrl() {
        return useLocalStorage(BaseClient.BASE_URL_KEY, () => this.getBaseUrl());
    }

    public getValidUrlFor(endpoint: string, apiVersion: string = RequestManager.API_VERSION): string {
        if (
            endpoint.startsWith('http://') ||
            endpoint.startsWith('https://') ||
            endpoint.startsWith('data:') ||
            endpoint.startsWith('blob:')
        ) {
            return endpoint;
        }
        return `${this.getBaseUrl()}${apiVersion}${endpoint}`;
    }

    public getWebviewUrl(url: string): string {
        return `${this.getValidUrlFor('webview')}#${url}`;
    }

    public clearBrowseCacheFor(sourceId: string) {
        const cacheKeys = this.cache.getMatchingKeys(
            new RegExp(`${CACHE_INITIAL_PAGES_FETCHING_KEY}|${CACHE_PAGES_KEY}|${CACHE_RESULTS_KEY}.*${sourceId}`),
        );

        this.cache.clearFor(...cacheKeys);
    }

    public clearExtensionCache() {
        this.cache.clearFor(this.cache.getKeyFor(EXTENSION_LIST_CACHE_KEY, undefined));
    }

    public clearAnimeExtensionCache() {
        this.cache.clearFor(this.cache.getKeyFor(ANIME_EXTENSION_LIST_CACHE_KEY, undefined));
    }

    private createAbortController(): { signal: AbortSignal } & AbortableRequest {
        const abortController = new AbortController();
        const abortRequest = (reason?: any): void => {
            if (!abortController.signal.aborted) {
                abortController.abort(reason);
            }
        };

        return { signal: abortController.signal, abortRequest };
    }

    private buildPageInfo() {
        return {
            endCursor: null,
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
        };
    }

    private normalizeMangaPayload(manga: any) {
        if (!manga) {
            return manga;
        }

        const chaptersTotalCount =
            manga?.chapters?.totalCount ?? manga?.chapterCount ?? manga?.chapters?.nodes?.length ?? 0;
        const trackRecords = manga?.trackRecords ?? { totalCount: 0, nodes: [] };
        const meta = Array.isArray(manga?.meta)
            ? manga.meta
            : manga?.meta && typeof manga.meta === 'object'
              ? Object.entries(manga.meta).map(([key, value]) => ({ key, value: `${value ?? ''}` }))
              : [];
        const genre = Array.isArray(manga?.genre)
            ? manga.genre
            : manga?.genre
              ? [manga.genre]
              : [];
        const chaptersField = manga?.chapters;
        const chapters = chaptersField && !Array.isArray(chaptersField)
            ? chaptersField
            : { totalCount: chaptersTotalCount };

        return {
            ...manga,
            genre,
            meta,
            chapters,
            unreadCount: manga?.unreadCount ?? 0,
            downloadCount: manga?.downloadCount ?? 0,
            bookmarkCount: manga?.bookmarkCount ?? 0,
            hasDuplicateChapters: manga?.hasDuplicateChapters ?? false,
            firstUnreadChapter: manga?.firstUnreadChapter ?? null,
            lastReadChapter: manga?.lastReadChapter ?? null,
            latestReadChapter: manga?.latestReadChapter ?? null,
            latestFetchedChapter: manga?.latestFetchedChapter ?? null,
            latestUploadedChapter: manga?.latestUploadedChapter ?? null,
            trackRecords,
        };
    }

    private normalizeSourcePayload(source: any) {
        if (!source) {
            return source;
        }

        const meta = Array.isArray(source?.meta)
            ? source.meta
            : source?.meta && typeof source.meta === 'object'
              ? Object.entries(source.meta).map(([key, value]) => ({ key, value: `${value ?? ''}` }))
              : [];
        const extensionPkgName =
            source?.extension?.pkgName ?? source?.extensionPkgName ?? source?.extension_pkg_name ?? '';
        const extensionRepo = source?.extension?.repo ?? source?.extensionRepo ?? source?.extension_repo ?? '';
        const extension = { pkgName: extensionPkgName, repo: extensionRepo };
        const filters = Array.isArray(source?.filters) ? source.filters : [];
        const preferences = Array.isArray(source?.preferences) ? source.preferences : [];

        return {
            ...source,
            meta,
            extension,
            filters,
            preferences,
            displayName: source?.displayName ?? source?.name,
        };
    }

    private normalizeExtensionPayload(extension: any) {
        if (!extension) {
            return extension;
        }

        const pkgName = extension?.pkgName ?? extension?.pkg_name ?? extension?.package_name ?? '';
        const name = extension?.name ?? '';
        let lang = extension?.lang ?? extension?.language ?? '';
        if (!lang) {
            lang = DefaultLanguage.ALL;
        }
        const versionCode = Number(extension?.versionCode ?? extension?.version_code ?? 0);
        const versionName = extension?.versionName ?? extension?.version_name ?? '';
        const repo = extension?.repo ?? extension?.repository ?? null;
        const isNsfw = extension?.isNsfw ?? extension?.is_nsfw ?? false;
        const isInstalled = extension?.isInstalled ?? extension?.installed ?? extension?.is_installed ?? false;
        const isObsolete = extension?.isObsolete ?? extension?.obsolete ?? extension?.is_obsolete ?? false;
        const hasUpdate = extension?.hasUpdate ?? extension?.has_update ?? false;
        const apkName = extension?.apkName ?? extension?.apk_name ?? '';
        let iconUrl = extension?.iconUrl ?? extension?.icon_url ?? '';
        if (!iconUrl && apkName) {
            iconUrl = this.getExtensionIconUrl(apkName);
        }

        return {
            ...extension,
            pkgName,
            name,
            lang,
            versionCode,
            versionName,
            iconUrl,
            repo,
            isNsfw,
            isInstalled,
            isObsolete,
            hasUpdate,
            installed: extension?.installed ?? isInstalled,
            obsolete: extension?.obsolete ?? isObsolete,
            apkName,
        };
    }

    private normalizeExtensionsPayload(payload: any) {
        const items = Array.isArray(payload)
            ? payload
            : payload?.extensions?.nodes ??
              payload?.extensions ??
              payload?.fetchExtensions?.extensions ??
              payload?.fetchAnimeExtensions?.extensions ??
              [];
        return items.map((extension: any) => this.normalizeExtensionPayload(extension));
    }

    private normalizeSourcePreferencePayload(raw: any): any | null {
        if (!raw || typeof raw !== 'object') {
            return null;
        }

        // Runtime preference payloads may come in the form: { type: string, props: { ... } }
        // while the WebUI expects the GraphQL-style union objects.
        const type = raw?.type ?? raw?.__typename;
        const props = raw?.props && typeof raw.props === 'object' ? raw.props : raw;

        switch (type) {
            case 'SwitchPreferenceCompat':
            case 'SwitchPreference':
                return {
                    __typename: 'SwitchPreference',
                    type: 'SwitchPreference',
                    key: props?.key ?? null,
                    summary: props?.summary ?? null,
                    SwitchPreferenceTitle: props?.title ?? null,
                    SwitchPreferenceDefault: props?.defaultValue ?? false,
                    SwitchPreferenceCurrentValue: props?.currentValue ?? null,
                };
            case 'CheckBoxPreference':
                return {
                    __typename: 'CheckBoxPreference',
                    type: 'CheckBoxPreference',
                    key: props?.key ?? null,
                    summary: props?.summary ?? null,
                    CheckBoxTitle: props?.title ?? null,
                    CheckBoxDefault: props?.defaultValue ?? false,
                    CheckBoxCheckBoxCurrentValue: props?.currentValue ?? null,
                };
            case 'ListPreference': {
                const entries = Array.isArray(props?.entries) ? props.entries : [];
                const entryValues = Array.isArray(props?.entryValues) ? props.entryValues : entries;
                return {
                    __typename: 'ListPreference',
                    type: 'ListPreference',
                    key: props?.key ?? null,
                    summary: props?.summary ?? null,
                    entries,
                    entryValues,
                    ListPreferenceTitle: props?.title ?? null,
                    ListPreferenceDefault: props?.defaultValue ?? null,
                    ListPreferenceCurrentValue: props?.currentValue ?? null,
                };
            }
            case 'EditTextPreference':
                return {
                    __typename: 'EditTextPreference',
                    type: 'EditTextPreference',
                    key: props?.key ?? null,
                    summary: props?.summary ?? null,
                    text: props?.text ?? null,
                    dialogTitle: props?.dialogTitle ?? null,
                    dialogMessage: props?.dialogMessage ?? null,
                    EditTextPreferenceTitle: props?.title ?? null,
                    EditTextPreferenceDefault: props?.defaultValue ?? null,
                    EditTextPreferenceCurrentValue: props?.currentValue ?? null,
                };
            case 'MultiSelectListPreference': {
                const entries = Array.isArray(props?.entries) ? props.entries : [];
                const entryValues = Array.isArray(props?.entryValues) ? props.entryValues : entries;
                return {
                    __typename: 'MultiSelectListPreference',
                    type: 'MultiSelectListPreference',
                    key: props?.key ?? null,
                    summary: props?.summary ?? null,
                    dialogTitle: props?.dialogTitle ?? null,
                    dialogMessage: props?.dialogMessage ?? null,
                    entries,
                    entryValues,
                    MultiSelectListPreferenceTitle: props?.title ?? null,
                    MultiSelectListPreferenceDefault: props?.defaultValue ?? null,
                    MultiSelectListPreferenceCurrentValue: props?.currentValue ?? null,
                };
            }
            default:
                return null;
        }
    }

    private normalizeSourceMangaPayload(manga: any, sourceId?: string) {
        if (!manga) {
            return manga;
        }

        const id = Number(manga?.id ?? manga?.mangaId ?? 0);
        const title = manga?.title ?? manga?.name ?? '';
        const thumbnailUrl = manga?.thumbnailUrl ?? manga?.thumbnail_url ?? manga?.coverUrl ?? '';
        const thumbnailUrlLastFetched =
            manga?.thumbnailUrlLastFetched ?? manga?.thumbnail_url_last_fetched ?? null;
        const inLibrary = manga?.inLibrary ?? manga?.in_library ?? false;
        const initialized = manga?.initialized ?? manga?.inLibraryAt != null;
        const resolvedSourceId = manga?.sourceId ?? manga?.source_id ?? sourceId ?? '';

        return {
            ...manga,
            id,
            title,
            thumbnailUrl,
            thumbnailUrlLastFetched,
            inLibrary,
            initialized,
            sourceId: resolvedSourceId,
        };
    }

    private normalizeSourceAnimePayload(anime: any, sourceId?: string) {
        if (!anime) {
            return anime;
        }

        const id = Number(anime?.id ?? anime?.animeId ?? 0);
        const title = anime?.title ?? anime?.name ?? '';
        const thumbnailUrl = anime?.thumbnailUrl ?? anime?.thumbnail_url ?? anime?.coverUrl ?? '';
        const resolvedSourceId = anime?.sourceId ?? anime?.source_id ?? sourceId ?? '';
        const url = anime?.url ?? anime?.webUrl ?? anime?.web_url ?? null;
        const inLibrary = anime?.inLibrary ?? anime?.in_library ?? false;

        return {
            ...anime,
            id,
            title,
            thumbnailUrl,
            sourceId: resolvedSourceId,
            url,
            inLibrary,
        };
    }

    private async fetchSourceMangasRest(input: FetchSourceMangaInput, signal: AbortSignal) {
        const sourceId = input.source ?? (input as { sourceId?: string }).sourceId ?? '';
        const page = input.page ?? 1;
        const params = new URLSearchParams();
        params.set('page', String(page));
        if (input.query) {
            params.set('query', input.query);
        }
        const endpointBase = `/api/v1/source/${sourceId}`;
        const endpoint =
            input.type === FetchSourceMangaType.Popular
                ? `${endpointBase}/popular`
                : input.type === FetchSourceMangaType.Latest
                  ? `${endpointBase}/latest`
                  : `${endpointBase}/search`;

        if (input.filters?.length) {
            await this.restClient.fetcher(`${endpointBase}/filters`, {
                httpMethod: HttpMethod.POST,
                data: { filters: input.filters },
                config: { signal },
            });
        }

        const response = await this.restClient.fetcher(`${endpoint}?${params.toString()}`, {
            config: { signal, cache: 'no-store' },
        });
        const payload = await response.json();
        const rawList =
            payload?.mangaList ?? payload?.mangas ?? payload?.nodes ?? payload?.results ?? payload ?? [];
        const mangas = Array.isArray(rawList) ? rawList : rawList?.nodes ?? [];
        const hasNextPage = payload?.hasNextPage ?? payload?.has_next_page ?? false;
        const rawSourceIds = mangas
            .map((manga: any) =>
                manga?.sourceId ??
                manga?.source_id ??
                manga?.source ??
                manga?.source?.id ??
                manga?.source?.sourceId ??
                manga?.source?.source_id ??
                manga?.manga?.sourceId ??
                manga?.manga?.source_id ??
                manga?.manga?.source ??
                manga?.manga?.source?.id ??
                manga?.manga?.source?.sourceId ??
                manga?.manga?.source?.source_id,
            )
            .filter((value: any) => value != null)
            .map((value: any) => `${value}`);
        const uniqueSourceIds = [...new Set(rawSourceIds)];
        if (uniqueSourceIds.length > 1 || (uniqueSourceIds[0] && uniqueSourceIds[0] !== `${sourceId}`)) {
            console.info('[source] mixed sourceIds', {
                sourceId,
                page,
                uniqueSourceIds,
                sample: rawSourceIds.slice(0, 10),
            });
        }
        const expectedSourceId = `${sourceId}`;
        const normalized = mangas
            .map((manga: any) => {
                const rawSourceId =
                    manga?.sourceId ??
                    manga?.source_id ??
                    manga?.source ??
                    manga?.source?.id ??
                    manga?.source?.sourceId ??
                    manga?.source?.source_id ??
                    manga?.manga?.sourceId ??
                    manga?.manga?.source_id ??
                    manga?.manga?.source ??
                    manga?.manga?.source?.id ??
                    manga?.manga?.source?.sourceId ??
                    manga?.manga?.source?.source_id;
                return {
                    rawSourceId,
                    normalized: this.normalizeSourceMangaPayload(manga, sourceId),
                };
            })
            .filter(({ rawSourceId }) => rawSourceId != null && `${rawSourceId}` === expectedSourceId)
            .map(({ normalized }) => normalized);
        return {
            fetchSourceManga: {
                mangas: normalized,
                hasNextPage,
            },
        } as GetSourceMangasFetchMutation;
    }

    private async fetchSourceAnimesRest(input: any, signal: AbortSignal) {
        const sourceId = input?.source ?? input?.sourceId ?? '';
        const page = input?.page ?? 1;
        const params = new URLSearchParams();
        params.set('page', String(page));
        if (input?.query) {
            params.set('query', input.query);
        }
        const endpointBase = `/api/v1/anime/source/${sourceId}`;
        const endpoint =
            input?.type === 'POPULAR'
                ? `${endpointBase}/popular`
                : input?.type === 'LATEST'
                  ? `${endpointBase}/latest`
                  : `${endpointBase}/search`;
        const response = await this.restClient.fetcher(`${endpoint}?${params.toString()}`, {
            config: { signal },
        });
        const payload = await response.json();
        const rawList =
            payload?.animeList ?? payload?.animes ?? payload?.nodes ?? payload?.results ?? payload ?? [];
        const animes = Array.isArray(rawList) ? rawList : rawList?.nodes ?? [];
        const hasNextPage = payload?.hasNextPage ?? payload?.has_next_page ?? false;
        const expectedSourceId = `${sourceId}`;
        const normalized = animes
            .map((anime: any) => {
                const rawSourceId =
                    anime?.sourceId ??
                    anime?.source_id ??
                    anime?.source ??
                    anime?.source?.id ??
                    anime?.source?.sourceId ??
                    anime?.source?.source_id ??
                    anime?.anime?.sourceId ??
                    anime?.anime?.source_id ??
                    anime?.anime?.source ??
                    anime?.anime?.source?.id ??
                    anime?.anime?.source?.sourceId ??
                    anime?.anime?.source?.source_id;
                return {
                    rawSourceId,
                    normalized: this.normalizeSourceAnimePayload(anime, sourceId),
                };
            })
            .filter(({ rawSourceId }) => rawSourceId != null && `${rawSourceId}` === expectedSourceId)
            .map(({ normalized }) => normalized);
        return {
            fetchSourceAnime: {
                animes: normalized,
                hasNextPage,
            },
        };
    }

    private async refreshExtensionListCache(
        signal: AbortSignal,
        { refresh = true, anime = false }: { refresh?: boolean; anime?: boolean } = {},
    ) {
        const endpoint = anime ? '/api/v1/anime/extension/list' : '/api/v1/extension/list';
        const url = refresh ? `${endpoint}?refresh=true` : endpoint;
        const response = await this.restClient.fetcher(url, { config: { signal } });
        const payload = await response.json();
        const extensions = this.normalizeExtensionsPayload(payload);
        const cacheKey = anime ? ANIME_EXTENSION_LIST_CACHE_KEY : EXTENSION_LIST_CACHE_KEY;
        const settings = (this.serverSettingsSnapshot as any)?.settings;
        const cacheKeyData = anime
            ? settings?.animeExtensionRepos ?? settings?.extensionRepos ?? []
            : settings?.extensionRepos ?? [];
        const data = anime
            ? { fetchAnimeExtensions: { extensions } }
            : { fetchExtensions: { extensions } };
        this.cache.cacheResponse(cacheKey, cacheKeyData, {
            data,
            loading: false,
            called: true,
        });
        // Also cache under a legacy key so pages can update immediately even if settings snapshot
        // isn't ready yet (e.g. extension install right after page load).
        this.cache.cacheResponse(cacheKey, undefined, {
            data,
            loading: false,
            called: true,
        });
        return extensions;
    }

    private normalizeTrackerPayload(tracker: any) {
        if (!tracker) {
            return tracker;
        }

        const id = tracker?.id ?? tracker?.trackerId ?? tracker?.tracker_id ?? 0;
        const name = tracker?.name ?? tracker?.trackerName ?? tracker?.tracker_name ?? '';
        const icon = tracker?.icon ?? tracker?.iconUrl ?? tracker?.icon_url ?? '';
        const authUrl = tracker?.authUrl ?? tracker?.auth_url ?? '';
        const isLoggedIn = tracker?.isLoggedIn ?? tracker?.is_logged_in ?? false;
        const isTokenExpired = tracker?.isTokenExpired ?? tracker?.is_token_expired ?? false;
        const supportsTrackDeletion =
            tracker?.supportsTrackDeletion ?? tracker?.supports_track_deletion ?? false;
        const supportsPrivateTracking =
            tracker?.supportsPrivateTracking ?? tracker?.supports_private_tracking ?? false;
        const scores = Array.isArray(tracker?.scores) ? tracker.scores : [];
        const statuses = Array.isArray(tracker?.statuses) ? tracker.statuses : [];

        return {
            ...tracker,
            id,
            name,
            icon,
            authUrl,
            isLoggedIn,
            isTokenExpired,
            supportsTrackDeletion,
            supportsPrivateTracking,
            scores,
            statuses,
        };
    }

    private normalizeTrackerSearchPayload(trackSearch: any) {
        if (!trackSearch) {
            return trackSearch;
        }

        const id = trackSearch?.id ?? trackSearch?.remoteId ?? trackSearch?.remote_id ?? 0;
        const remoteId = `${trackSearch?.remoteId ?? trackSearch?.remote_id ?? trackSearch?.id ?? ''}`;
        const title = trackSearch?.title ?? trackSearch?.name ?? '';
        const summary = trackSearch?.summary ?? trackSearch?.description ?? '';
        const coverUrl = trackSearch?.coverUrl ?? trackSearch?.cover_url ?? '';
        const trackingUrl = trackSearch?.trackingUrl ?? trackSearch?.tracking_url ?? trackSearch?.url ?? '';
        const publishingType = trackSearch?.publishingType ?? trackSearch?.publishing_type ?? '';
        const publishingStatus = trackSearch?.publishingStatus ?? trackSearch?.publishing_status ?? '';
        const startDate = trackSearch?.startDate ?? trackSearch?.start_date ?? '';
        const score = Number(trackSearch?.score ?? 0);
        const totalChapters = Number(trackSearch?.totalChapters ?? trackSearch?.total_chapters ?? 0);

        return {
            ...trackSearch,
            id,
            remoteId,
            title,
            summary,
            coverUrl,
            trackingUrl,
            publishingType,
            publishingStatus,
            startDate,
            score,
            totalChapters,
        };
    }

    private normalizeTrackRecordPayload(
        trackRecord: any,
        fallback?: { mangaId?: number; trackerId?: number; remoteId?: string },
    ) {
        if (!trackRecord) {
            trackRecord = {};
        }

        const id = trackRecord?.id ?? trackRecord?.recordId ?? trackRecord?.record_id ?? 0;
        const trackerId = trackRecord?.trackerId ?? trackRecord?.tracker_id ?? fallback?.trackerId ?? 0;
        const remoteId = `${trackRecord?.remoteId ?? trackRecord?.remote_id ?? fallback?.remoteId ?? ''}`;
        const remoteUrl = trackRecord?.remoteUrl ?? trackRecord?.remote_url ?? trackRecord?.url ?? '';
        const title = trackRecord?.title ?? trackRecord?.name ?? '';
        const status = Number(trackRecord?.status ?? 0);
        const lastChapterRead = Number(trackRecord?.lastChapterRead ?? trackRecord?.last_chapter_read ?? 0);
        const totalChapters = Number(trackRecord?.totalChapters ?? trackRecord?.total_chapters ?? 0);
        const score = Number(trackRecord?.score ?? 0);
        const displayScore = trackRecord?.displayScore ?? trackRecord?.display_score ?? `${score}`;
        const startDate = trackRecord?.startDate ?? trackRecord?.start_date ?? '';
        const finishDate = trackRecord?.finishDate ?? trackRecord?.finish_date ?? '';
        const isPrivate = trackRecord?.private ?? trackRecord?.is_private ?? false;

        const mangaId =
            trackRecord?.manga?.id ?? trackRecord?.mangaId ?? trackRecord?.manga_id ?? fallback?.mangaId ?? 0;
        const trackRecordNodes =
            trackRecord?.manga?.trackRecords?.nodes ?? trackRecord?.manga?.track_records?.nodes ?? [];
        const normalizedNodes = Array.isArray(trackRecordNodes)
            ? trackRecordNodes.map((node: any) => ({
                  id: node?.id ?? 0,
                  trackerId: node?.trackerId ?? node?.tracker_id ?? 0,
              }))
            : [];
        const totalCount =
            trackRecord?.manga?.trackRecords?.totalCount ??
            trackRecord?.manga?.track_records?.totalCount ??
            normalizedNodes.length;
        const hasMangaInfo = mangaId !== 0 || !!trackRecord?.manga || fallback?.mangaId != null;

        return {
            ...trackRecord,
            id,
            trackerId,
            remoteId,
            remoteUrl,
            title,
            status,
            lastChapterRead,
            totalChapters,
            score,
            displayScore,
            startDate,
            finishDate,
            private: isPrivate,
            ...(hasMangaInfo
                ? {
                      manga: {
                          id: mangaId,
                          trackRecords: {
                              totalCount,
                              nodes: normalizedNodes,
                          },
                      },
                  }
                : {}),
        };
    }

    private async parseJsonSafe(response: Response) {
        try {
            return await response.json();
        } catch {
            return undefined;
        }
    }

    private useRestQuery<Data, Variables extends OperationVariables = OperationVariables>(
        fetcher: (signal: AbortSignal) => Promise<Data>,
        deps: unknown[],
        options?: QueryHookOptions<Data, Variables>,
    ): AbortableApolloUseQueryResponse<Data, Variables> {
        const skip = options?.skip ?? false;
        const [data, setData] = useState<Data | undefined>(undefined);
        const [error, setError] = useState<RequestError | undefined>(undefined);
        const [loading, setLoading] = useState<boolean>(!skip);
        const [networkStatus, setNetworkStatus] = useState<number>(
            skip ? NetworkStatus.ready : NetworkStatus.loading,
        );
        const abortRef = useRef<AbortController | null>(null);
        const isMountedRef = useRef(true);

        useEffect(() => {
            isMountedRef.current = true;
            return () => {
                isMountedRef.current = false;
                abortRef.current?.abort();
            };
        }, []);

        const execute = useCallback(
            async (isRefetch: boolean) => {
                abortRef.current?.abort();
                const controller = new AbortController();
                abortRef.current = controller;

                setLoading(true);
                setError(undefined);
                setNetworkStatus(isRefetch ? NetworkStatus.refetch : NetworkStatus.loading);

                try {
                    const result = await fetcher(controller.signal);
                    if (!isMountedRef.current || controller.signal.aborted) {
                        return result;
                    }
                    setData(result);
                    setLoading(false);
                    setNetworkStatus(NetworkStatus.ready);
                    options?.onCompleted?.(result);
                    return result;
                } catch (caught: any) {
                    if (controller.signal.aborted) {
                        return undefined;
                    }
                    const requestError =
                        caught instanceof RequestError
                            ? caught
                            : new RequestError(caught?.message ?? caught?.toString?.() ?? 'Request failed', caught);
                    if (isMountedRef.current) {
                        setError(requestError);
                        setLoading(false);
                        setNetworkStatus(NetworkStatus.error);
                    }
                    options?.onError?.(requestError);
                    throw requestError;
                }
            },
            [...deps, options?.onCompleted, options?.onError],
        );

        useEffect(() => {
            if (skip) {
                setLoading(false);
                setNetworkStatus(NetworkStatus.ready);
                return;
            }
            execute(false).catch(defaultPromiseErrorHandler('RequestManager::useRestQuery'));
        }, [skip, execute]);

        useEffect(() => {
            if (skip || !options?.pollInterval) {
                return undefined;
            }

            const intervalId = setInterval(() => {
                execute(true).catch(defaultPromiseErrorHandler('RequestManager::useRestQuery::poll'));
            }, options.pollInterval);

            return () => {
                clearInterval(intervalId);
            };
        }, [skip, options?.pollInterval, execute]);

        const refetch = async () => {
            const refetched = await execute(true);
            return {
                data: (refetched ?? data) as Data,
                loading: false,
                networkStatus: NetworkStatus.ready,
            } as ApolloQueryResult<MaybeMasked<Data>>;
        };

        const abortRequest = (reason?: any): void => {
            abortRef.current?.abort(reason);
        };

        const clientStub = undefined as unknown as QueryResult<MaybeMasked<Data>, Variables>['client'];

        return {
            client: clientStub,
            data: data as MaybeMasked<Data>,
            error,
            loading,
            networkStatus,
            refetch,
            called: !skip,
            variables: undefined as unknown as Variables,
            fetchMore: async () =>
                ({
                    data: data as MaybeMasked<Data>,
                    loading: false,
                    networkStatus: NetworkStatus.ready,
                }) as ApolloQueryResult<MaybeMasked<Data>>,
            subscribeToMore: () => () => {},
            startPolling: () => {},
            stopPolling: () => {},
            updateQuery: () => {},
            reobserve: () => Promise.resolve({} as ApolloQueryResult<MaybeMasked<Data>>),
            reobserveCacheFirst: () => Promise.resolve({} as ApolloQueryResult<MaybeMasked<Data>>),
            observable: undefined as unknown as QueryResult<MaybeMasked<Data>, Variables>['observable'],
            previousData: undefined,
            abortRequest,
        } as AbortableApolloUseQueryResponse<Data, Variables>;
    }

    private useRestMutation<Data, Variables extends OperationVariables>(
        fetcher: (variables: Variables | undefined, signal: AbortSignal) => Promise<Data>,
    ): AbortableApolloUseMutationResponse<Data, Variables> {
        const clientStub = undefined as unknown as MutationResult<Data>['client'];
        const [result, setResult] = useState<MutationResult<Data>>({
            loading: false,
            called: false,
            client: clientStub,
        } as MutationResult<Data>);
        const abortRef = useRef<AbortController | null>(null);

        const reset = () => {
            setResult({
                loading: false,
                called: false,
                client: clientStub,
            } as MutationResult<Data>);
        };

        const mutate = async (mutateOptions?: MutationOptions<Data, Variables>) => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            setResult((prev) => ({ ...prev, loading: true, called: true, error: undefined }));

            try {
                const data = await fetcher(mutateOptions?.variables, controller.signal);
                if (controller.signal.aborted) {
                    return { data: undefined } as FetchResult<MaybeMasked<Data>>;
                }
                setResult((prev) => ({ ...prev, loading: false, data, called: true }));
                mutateOptions?.onCompleted?.(data);
                return { data: data as MaybeMasked<Data> } as FetchResult<MaybeMasked<Data>>;
            } catch (caught: any) {
                if (controller.signal.aborted) {
                    return { data: undefined } as FetchResult<MaybeMasked<Data>>;
                }
                const requestError =
                    caught instanceof RequestError
                        ? caught
                        : new RequestError(caught?.message ?? caught?.toString?.() ?? 'Request failed', caught);
                setResult((prev) => ({ ...prev, loading: false, error: requestError, called: true }));
                mutateOptions?.onError?.(requestError);
                throw requestError;
            }
        };

        const abortRequest = (reason?: any): void => {
            abortRef.current?.abort(reason);
        };

        return [mutate, { ...result, abortRequest, reset }] as AbortableApolloUseMutationResponse<Data, Variables>;
    }

    private doRestMutation<Data>(
        request: (signal: AbortSignal) => Promise<Data>,
    ): AbortableApolloMutationResponse<Data> {
        const { signal, abortRequest } = this.createAbortController();
        return {
            abortRequest,
            response: request(signal).then((data) => ({
                data: data as MaybeMasked<Data>,
            })) as Promise<FetchResult<MaybeMasked<Data>>>,
        };
    }

    private doRestQuery<Data>(
        request: (signal: AbortSignal) => Promise<Data>,
    ): AbortabaleApolloQueryResponse<Data> {
        const { signal, abortRequest } = this.createAbortController();
        return {
            abortRequest,
            response: request(signal).then((data) => ({
                data: data as MaybeMasked<Data>,
                loading: false,
                networkStatus: NetworkStatus.ready,
            })) as Promise<ApolloQueryResult<MaybeMasked<Data>>>,
        };
    }

    private createPaginatedResult<Result extends AbortableApolloUseMutationPaginatedResponse[1][number]>(
        result: Partial<Result> | undefined | null,
        defaultPage: number,
        page?: number,
    ): Result {
        const isLoading = !result?.error && (result?.isLoading || !result?.called);
        const size = page ?? result?.size ?? defaultPage;
        return {
            client: undefined as unknown as Result['client'],
            abortRequest: () => {},
            reset: () => {},
            called: false,
            data: undefined,
            error: undefined,
            size,
            isLoading,
            isLoadingMore: isLoading && size > 1,
            isValidating: !!result?.isValidating,
            ...result,
        } as Result;
    }

    private async revalidatePage<Data = any, Variables extends OperationVariables = OperationVariables>(
        sourceId: string,
        cacheResultsKey: string,
        cachePagesKey: string,
        getVariablesFor: (page: number) => Variables,
        checkIfCachedPageIsInvalid: (
            cachedResult: AbortableApolloUseMutationPaginatedResponse<Data, Variables>[1][number] | undefined,
            revalidatedResult: FetchResult<MaybeMasked<Data>>,
        ) => boolean,
        hasNextPage: (revalidatedResult: FetchResult<MaybeMasked<Data>>) => boolean,
        pageToRevalidate: number,
        maxPage: number,
        signal: AbortSignal,
    ): Promise<void> {
        if (SPECIAL_ED_SOURCES.REVALIDATION_UNSUPPORTED.includes(sourceId)) {
            return;
        }

        const isFirstPage = pageToRevalidate === 1;
        const isTtlReached =
            Date.now() - (this.cache.getFetchTimestampFor(cacheResultsKey, getVariablesFor(pageToRevalidate)) ?? 0) >=
            d(5).minutes.inWholeMilliseconds;

        if (isFirstPage && !isTtlReached && !SPECIAL_ED_SOURCES.REVALIDATION_SKIP_TTL.includes(sourceId)) {
            return;
        }

        const variables = getVariablesFor(pageToRevalidate);
        const revalidationResponse = {
            data: await this.fetchSourceMangasRest((variables as any).input, signal),
        } as FetchResult<MaybeMasked<Data>>;
        const cachedPageData = this.cache.getResponseFor<
            AbortableApolloUseMutationPaginatedResponse<Data, Variables>[1][number]
        >(cacheResultsKey, getVariablesFor(pageToRevalidate));
        const isCachedPageInvalid = checkIfCachedPageIsInvalid(cachedPageData, revalidationResponse);

        this.cache.cacheResponse(cacheResultsKey, getVariablesFor(pageToRevalidate), {
            ...revalidationResponse,
            called: true,
            isLoading: false,
            size: pageToRevalidate,
        });

        if (!hasNextPage(revalidationResponse)) {
            const currentCachedPages = this.cache.getResponseFor<Set<number>>(cachePagesKey, getVariablesFor(0))!;
            this.cache.cacheResponse(
                cachePagesKey,
                getVariablesFor(0),
                [...currentCachedPages].filter((cachedPage) => cachedPage <= pageToRevalidate),
            );
            [...currentCachedPages]
                .filter((cachedPage) => cachedPage > pageToRevalidate)
                .forEach((cachedPage) =>
                    this.cache.cacheResponse(cacheResultsKey, getVariablesFor(cachedPage), undefined),
                );
            return;
        }

        if (isCachedPageInvalid && pageToRevalidate < maxPage) {
            await this.revalidatePage(
                sourceId,
                cacheResultsKey,
                cachePagesKey,
                getVariablesFor,
                checkIfCachedPageIsInvalid,
                hasNextPage,
                pageToRevalidate + 1,
                maxPage,
                signal,
            );
        }
    }

    private async revalidatePages<Variables extends OperationVariables = OperationVariables>(
        activeRevalidationRef:
            | [ForInput: Variables, Request: Promise<unknown>, AbortRequest: AbortableRequest['abortRequest']]
            | null,
        setRevalidationDone: (isDone: boolean) => void,
        setActiveRevalidation: (
            activeRevalidation:
                | [ForInput: Variables, Request: Promise<unknown>, AbortRequest: AbortableRequest['abortRequest']]
                | null,
        ) => void,
        getVariablesFor: (page: number) => Variables,
        setValidating: (isValidating: boolean) => void,
        revalidatePage: (pageToRevalidate: number, maxPage: number, signal: AbortSignal) => Promise<void>,
        maxPage: number,
        abortRequest: AbortableRequest['abortRequest'],
        signal: AbortSignal,
    ): Promise<void> {
        setRevalidationDone(true);

        const [currRevVars, currRevPromise, currRevAbortRequest] = activeRevalidationRef ?? [];

        const isActiveRevalidationForInput = JSON.stringify(currRevVars) === JSON.stringify(getVariablesFor(0));

        setValidating(true);

        if (!isActiveRevalidationForInput) {
            currRevAbortRequest?.(new Error('Abort revalidation for different input'));
        }

        let revalidationPromise = currRevPromise;
        if (!isActiveRevalidationForInput) {
            revalidationPromise = revalidatePage(1, maxPage, signal);
            setActiveRevalidation([getVariablesFor(0), revalidationPromise, abortRequest]);
        }

        try {
            await revalidationPromise;
            setActiveRevalidation(null);
        } catch (e) {
            defaultPromiseErrorHandler(`RequestManager..revalidatePages(${getVariablesFor(0)})`)(e);
        } finally {
            setValidating(false);
        }
    }

    private async fetchPaginatedMutationPage<
        Data = any,
        Variables extends OperationVariables = OperationVariables,
        ResultIdInfo extends Record<string, any> = any,
    >(
        getVariablesFor: (page: number) => Variables,
        setAbortRequest: (abortRequest: AbortableRequest['abortRequest']) => void,
        getResultIdInfo: () => ResultIdInfo,
        createPaginatedResult: (
            result: Partial<AbortableApolloUseMutationPaginatedResponse<Data, Variables>[1][number]>,
        ) => AbortableApolloUseMutationPaginatedResponse<Data, Variables>[1][number],
        setResult: (
            result: AbortableApolloUseMutationPaginatedResponse<Data, Variables>[1][number] & ResultIdInfo,
        ) => void,
        revalidate: (
            maxPage: number,
            abortRequest: AbortableRequest['abortRequest'],
            signal: AbortSignal,
        ) => Promise<void>,
        cachePagesKey: string,
        cacheResultsKey: string,
        cachedPages: Set<number>,
        newPage: number,
    ): Promise<FetchResult<MaybeMasked<Data>>> {
        const basePaginatedResult: Partial<AbortableApolloUseMutationPaginatedResponse<Data, Variables>[1][number]> = {
            size: newPage,
            isLoading: false,
            isLoadingMore: false,
            called: true,
        };

        let response: FetchResult<MaybeMasked<Data>> = {};
        try {
            const { signal, abortRequest } = this.createAbortController();
            setAbortRequest(abortRequest);

            const isRefetch = newPage === [...cachedPages][cachedPages.size - 1];
            if (isRefetch) {
                this.cache.cacheResponse(
                    cachePagesKey,
                    getVariablesFor(0),
                    new Set([...cachedPages].slice(0, cachedPages.size - 1)),
                );
                this.cache.clearFor(this.cache.getKeyFor(cacheResultsKey, getVariablesFor(newPage)));
            }

            setResult({
                ...getResultIdInfo(),
                ...createPaginatedResult({ isLoading: true, abortRequest, size: newPage, called: true }),
            });

            if (newPage !== 1 && cachedPages.size) {
                await revalidate(newPage, abortRequest, signal);
            }

            const variables = getVariablesFor(newPage);
            response = {
                data: (await this.fetchSourceMangasRest((variables as any).input, signal)) as any,
            } as FetchResult<MaybeMasked<Data>>;

            basePaginatedResult.data = response.data;
        } catch (error: any) {
            defaultPromiseErrorHandler('RequestManager::fetchPaginatedMutationPage')(error);
            basePaginatedResult.error =
                error instanceof RequestError
                    ? error
                    : new RequestError(error?.message ?? error.toString(), error);
        }

        const fetchPaginatedResult = {
            ...getResultIdInfo(),
            ...createPaginatedResult(basePaginatedResult),
        };

        setResult(fetchPaginatedResult);

        const currentCachedPages = this.cache.getResponseFor<Set<number>>(cachePagesKey, getVariablesFor(0)) ?? [];
        this.cache.cacheResponse(cachePagesKey, getVariablesFor(0), new Set([...currentCachedPages, newPage]));
        this.cache.cacheResponse(cacheResultsKey, getVariablesFor(newPage), fetchPaginatedResult);

        return response;
    }

    private fetchInitialPages<Data = any, Variables extends OperationVariables = OperationVariables>(
        options: ApolloPaginatedMutationOptions<Data, Variables> | undefined,
        areFetchingInitialPages: boolean,
        areInitialPagesFetched: boolean,
        setRevalidationDone: (isDone: boolean) => void,
        cacheFetchingInitialPagesKey: string,
        getVariablesFor: (page: number) => Variables,
        initialPages: number,
        fetchPage: (page: number) => Promise<FetchResult<Data>>,
        hasNextPage: (result: FetchResult<Data>) => boolean,
    ): void {
        useEffect(() => {
            const shouldFetchInitialPages =
                !options?.skipRequest && !areFetchingInitialPages && !areInitialPagesFetched;
            if (!shouldFetchInitialPages) {
                return;
            }

            setRevalidationDone(true);
            this.cache.cacheResponse(cacheFetchingInitialPagesKey, getVariablesFor(0), true);

            const loadInitialPages = async (initialPage: number) => {
                const areAllPagesFetched = initialPage > initialPages;
                if (areAllPagesFetched) {
                    return;
                }

                const pageResult = await fetchPage(initialPage);

                if (hasNextPage(pageResult)) {
                    await loadInitialPages(initialPage + 1);
                }
            };

            loadInitialPages(1).finally(() =>
                this.cache.cacheResponse(cacheFetchingInitialPagesKey, getVariablesFor(0), false),
            );
        }, [!options?.skipRequest, !areFetchingInitialPages, !areInitialPagesFetched]);
    }

    private returnPaginatedMutationResult<Data = any, Variables extends OperationVariables = OperationVariables>(
        areInitialPagesFetched: boolean,
        cachedResults: AbortableApolloUseMutationPaginatedResponse<Data, Variables>[1][number][],
        getVariablesFor: (page: number) => Variables,
        paginatedResult: AbortableApolloUseMutationPaginatedResponse<Data, Variables>[1][number],
        fetchPage: (page: number) => Promise<FetchResult<MaybeMasked<Data>>>,
        hasCachedResult: boolean,
        createPaginatedResult: (
            result: Partial<AbortableApolloUseMutationPaginatedResponse<Data, Variables>[1][number]>,
        ) => AbortableApolloUseMutationPaginatedResponse<Data, Variables>[1][number],
    ): AbortableApolloUseMutationPaginatedResponse<Data, Variables> {
        const doCachedResultsExist = areInitialPagesFetched && cachedResults.length;
        if (!doCachedResultsExist) {
            return [fetchPage, [paginatedResult]];
        }

        const areAllPagesCached = doCachedResultsExist && hasCachedResult;
        if (!areAllPagesCached) {
            return [fetchPage, [...cachedResults, paginatedResult]];
        }

        return [
            fetchPage,
            [
                ...cachedResults.slice(0, cachedResults.length - 1),
                createPaginatedResult({
                    ...cachedResults[cachedResults.length - 1],
                    isValidating: paginatedResult.isValidating,
                }),
            ],
        ];
    }

    private revalidateInitialPages<Variables extends OperationVariables = OperationVariables>(
        isRevalidationDone: boolean,
        cachedResultsLength: number,
        cachedPages: Set<number>,
        setRevalidationDone: (isDone: boolean) => void,
        getVariablesFor: (page: number) => Variables,
        triggerRerender: () => void,
        revalidate: (
            maxPage: number,
            abortRequest: AbortableRequest['abortRequest'],
            signal: AbortSignal,
        ) => Promise<void>,
    ): void {
        const isMountedRef = useRef(false);

        useEffect(() => {
            const isRevalidationRequired = isMountedRef.current && cachedResultsLength;
            if (!isRevalidationRequired) {
                return;
            }

            setRevalidationDone(false);
            triggerRerender();
        }, [JSON.stringify(getVariablesFor(0))]);

        useEffect(() => {
            const shouldRevalidateData = isMountedRef.current && !isRevalidationDone && cachedResultsLength;
            if (shouldRevalidateData) {
                setRevalidationDone(true);

                const { signal, abortRequest } = this.createAbortController();
                revalidate(Math.max(...cachedPages), abortRequest, signal);
            }
        }, [isMountedRef.current, isRevalidationDone]);

        useEffect(() => {
            isMountedRef.current = true;
        }, []);
    }

    public getValidImgUrlFor(imageUrl: string, apiVersion: string = ''): string {
        // server provided image urls already contain the api version
        return `${this.getValidUrlFor(imageUrl, apiVersion)}`;
    }

    /**
     * Aborts pending image requests
     *
     * prevents aborting image requests that are already in progress
     * e.g. for source image requests, ongoing requests are already handled by the server and aborting them
     * will just cause new source image requests to be sent to the server, which then will cause the server
     * to become really slow for image requests to the same source
     */
    private abortImageRequest(key: string, sourceId: string | null, abort: () => void): void {
        if (this.imageQueue.isProcessing(sourceId, key)) {
            return;
        }

        abort();
    }

    private async optionallyDecodeImage(url: string, shouldDecode?: boolean, disableCors?: boolean): Promise<string> {
        if (!shouldDecode) {
            return url;
        }

        const decodePromise = new ControlledPromise();

        const img = new Image();

        if (!disableCors) {
            img.crossOrigin = 'anonymous';
        }
        img.src = url;

        img.onload = async () => {
            try {
                await img.decode();
            } catch (error) {
                decodePromise.reject(error);
            }

            decodePromise.resolve();
        };

        img.onerror = (error) => decodePromise.reject(error);
        img.onabort = (error) => decodePromise.reject(error);

        await decodePromise.promise;

        return url;
    }

    private getSourceIdFromUrl(url: string): string | null {
        try {
            return new URL(url).searchParams.get('sourceId');
        } catch {
            return null;
        }
    }

    private async maybeEnqueueImageRequest<T>(
        url: string,
        request: () => Promise<T>,
        priority?: QueuePriority,
        ignoreQueue?: boolean,
    ): Promise<ReturnType<typeof this.imageQueue.enqueue<T>> & { fromCache?: boolean }> {
        const sourceId = this.getSourceIdFromUrl(url);

        try {
            const isCached = await ImageCache.has(url);
            if (!!ignoreQueue || isCached) {
                return {
                    key: `image-cache-${url}`,
                    promise: request(),
                    fromCache: isCached,
                };
            }

            return this.imageQueue.enqueue(sourceId, url, request, priority);
        } catch (error) {
            return this.imageQueue.enqueue(sourceId, url, request, priority);
        }
    }

    private async fetchImageViaTag(
        url: string,
        { priority, shouldDecode, disableCors, ignoreQueue }: ImageRequestOptions = {},
    ): Promise<ImageRequest> {
        const imgRequest = new ControlledPromise<string>();
        imgRequest.promise.catch(() => {});

        const img = new Image();
        const abortRequest = (reason?: any) => {
            img.src = '';
            img.onload = null;
            img.onerror = null;
            img.onabort = null;
            imgRequest.reject(reason);
        };

        const {
            key,
            promise: response,
            fromCache,
        } = await this.maybeEnqueueImageRequest(
            url,
            async () => {
                // throws error in case request was already aborted
                await Promise.race([imgRequest.promise, Promise.resolve()]);

                if (!disableCors) {
                    img.crossOrigin = 'anonymous';
                }
                img.src = url;

                img.onload = async () => {
                    try {
                        await this.optionallyDecodeImage(url, shouldDecode);
                        imgRequest.resolve(url);
                    } catch (error) {
                        imgRequest.reject(error);
                    }
                };

                img.onerror = (error) => imgRequest.reject(error);
                img.onabort = (error) => imgRequest.reject(error);

                return imgRequest.promise;
            },
            priority,
            ignoreQueue,
        );

        return {
            response,
            abortRequest: (reason?: any) =>
                this.abortImageRequest(key, this.getSourceIdFromUrl(url), () => abortRequest(reason)),
            cleanup: () => {},
            fromCache: !!fromCache,
        };
    }

    /**
     * After the image has been handled, {@see URL#revokeObjectURL} has to be called.
     *
     * @example
     *
     * const imageRequest = requestManager.requestImage("someUrl");
     * const imageUrl = await imageRequest.response
     *
     * const img = new Image();
     * img.onLoad = () => imageRequest.cleanup();
     * img.src = imageUrl;
     *
     */
    private async fetchImageViaFetchApi(
        url: string,
        { priority, shouldDecode, disableCors, ignoreQueue }: ImageRequestOptions = {},
    ): Promise<ImageRequest> {
        let objectUrl: string = '';
        const { abortRequest, signal } = this.createAbortController();

        const {
            key,
            promise: response,
            fromCache,
        } = await this.maybeEnqueueImageRequest(
            url,
            () =>
                this.restClient
                    .fetcher(url, {
                        checkResponseIsJson: false,
                        config: {
                            signal,
                            priority: 'low',
                        },
                    })
                    .then((data) => data.blob())
                    .then((data) => URL.createObjectURL(data))
                    .then(async (imageUrl) => {
                        objectUrl = imageUrl;

                        await this.optionallyDecodeImage(imageUrl, shouldDecode, disableCors);

                        return imageUrl;
                    }),
            priority,
            ignoreQueue,
        );

        return {
            response,
            abortRequest: (reason?: any) =>
                this.abortImageRequest(key, this.getSourceIdFromUrl(url), () => abortRequest(reason)),
            cleanup: () => URL.revokeObjectURL(objectUrl),
            fromCache: !!fromCache,
        };
    }

    /**
     * Make sure to call "cleanup" once the image is not needed anymore (only required if fetched via "fetch api")
     *
     * options:
     * - shouldDecode: decodes the image in case the browser is Firefox to prevent a flickering/blinking when an image gets visible for the first time
     */
    public async requestImage(
        url: string,
        options: ImageRequestOptions & { useFetchApi?: boolean } = {},
    ): Promise<ImageRequest> {
        const baseUrl = this.getBaseUrl();
        if (
            url.startsWith('http://') ||
            url.startsWith('https://')
        ) {
            const isSameOrigin = url.startsWith(baseUrl);
            const isMediaProxy = url.includes('/api/v1/media/image');
            if (!isSameOrigin && !isMediaProxy) {
                const proxy = UrlUtil.addParams('/api/v1/media/image', { url });
                url = this.getValidImgUrlFor(proxy, '');
            }
        }
        const finalOptions = {
            useFetchApi: AuthManager.isAuthRequired(),
            shouldDecode: false,
            disableCors: false,
            ignoreQueue: false,
            ...Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)),
        };

        // on firefox images are decoded async which causes a "flicker/blinking" when they're getting visible for the first time
        // this is an issue especially in the reader because pages that should not be shown are rendered but
        // not displayed, which then causes this issue once they get displayed
        const shouldDecode = finalOptions.shouldDecode && navigator.userAgent.toLowerCase().includes('firefox');

        if (finalOptions.useFetchApi) {
            return this.fetchImageViaFetchApi(url, { ...finalOptions, shouldDecode });
        }

        return this.fetchImageViaTag(url, { ...finalOptions, shouldDecode });
    }

    public getGlobalMeta(
        options?: QueryOptions<GetGlobalMetadatasQueryVariables, GetGlobalMetadatasQuery>,
    ): AbortabaleApolloQueryResponse<GetGlobalMetadatasQuery> {
        return this.doRestQuery(async (signal) => {
            const response = await this.restClient.fetcher('/api/v1/meta/global', { config: { signal } });
            const payload = (await response.json()) as GetGlobalMetadatasQuery;
            this.setGlobalMetaSnapshot(payload);
            return payload;
        });
    }

    public useGetGlobalMeta(
        options?: QueryHookOptions<GetGlobalMetadatasQuery, GetGlobalMetadatasQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetGlobalMetadatasQuery, GetGlobalMetadatasQueryVariables> {
        const [snapshot, setSnapshot] = useState(this.globalMetaSnapshot);

        const handleCompleted = useCallback(
            (result: GetGlobalMetadatasQuery) => {
                this.setGlobalMetaSnapshot(result);
                options?.onCompleted?.(result);
            },
            [options?.onCompleted],
        );

        useEffect(() => this.subscribeGlobalMeta(setSnapshot), []);

        const request = this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/meta/global', { config: { signal } });
                return (await response.json()) as GetGlobalMetadatasQuery;
            },
            [options?.skip],
            {
                ...options,
                onCompleted: handleCompleted,
            },
        );

        return {
            ...request,
            data: (snapshot ?? request.data) as MaybeMasked<GetGlobalMetadatasQuery>,
        } as AbortableApolloUseQueryResponse<GetGlobalMetadatasQuery, GetGlobalMetadatasQueryVariables>;
    }

    public setGlobalMetadata(
        key: string,
        value: any,
        options?: MutationOptions<SetGlobalMetadataMutation, SetGlobalMetadataMutationVariables>,
    ): AbortableApolloMutationResponse<SetGlobalMetadataMutation> {
        return this.doRestMutation(async (signal) => {
            const response = await this.restClient.fetcher(`/api/v1/meta/global/${key}`, {
                httpMethod: HttpMethod.POST,
                data: { value: `${value}` },
                config: { signal },
            });
            const payload = await response.json();
            const meta = payload?.meta ?? { key, value: `${value}` };
            if (meta?.key) {
                this.upsertGlobalMetaSnapshot(meta.key, `${meta.value ?? ''}`);
            }
            return {
                setGlobalMeta: {
                    meta,
                },
            } as SetGlobalMetadataMutation;
        });
    }

    public deleteGlobalMeta(
        key: string,
        options?: MutationOptions<DeleteGlobalMetadataMutation, DeleteGlobalMetadataMutationVariables>,
    ): AbortableApolloMutationResponse<DeleteGlobalMetadataMutation> {
        return this.doRestMutation(async (signal) => {
            const response = await this.restClient.fetcher(`/api/v1/meta/global/${key}`, {
                httpMethod: HttpMethod.DELETE,
                config: { signal },
            });
            const payload = await this.parseJsonSafe(response);
            const meta = payload?.meta ?? { key, value: '' };
            const metaKey = meta?.key ?? key;
            if (metaKey) {
                this.removeGlobalMetaSnapshot(metaKey);
            }
            return {
                deleteGlobalMeta: {
                    meta,
                },
            } as DeleteGlobalMetadataMutation;
        });
    }

    public useGetAbout(
        options?: QueryHookOptions<GetAboutQuery, GetAboutQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetAboutQuery, GetAboutQueryVariables> {
        return this.useRestQuery(
            async (signal) => {
                console.info('[request] GET /api/v1/about start', {
                    baseUrl: this.getBaseUrl(),
                });
                const response = await this.restClient.fetcher('/api/v1/about', { config: { signal } });
                console.info('[request] GET /api/v1/about response', {
                    status: response.status,
                    ok: response.ok,
                });
                return (await response.json()) as GetAboutQuery;
            },
            [options?.skip],
            options,
        );
    }

    public useCheckForServerUpdate(
        options?: QueryHookOptions<CheckForServerUpdatesQuery, CheckForServerUpdatesQueryVariables>,
    ): AbortableApolloUseQueryResponse<CheckForServerUpdatesQuery, CheckForServerUpdatesQueryVariables> {
        return this.useRestQuery(
            async (_signal) => ({ checkForServerUpdates: [] } as CheckForServerUpdatesQuery),
            [options?.skip],
            options,
        );
    }

    public useGetExtension(
        pkgName: string,
        options?: QueryHookOptions<GetExtensionQuery, GetExtensionQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetExtensionQuery, GetExtensionQueryVariables> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/extension/${pkgName}`, {
                    config: { signal },
                });
                const payload = await response.json();
                const extension = this.normalizeExtensionPayload(payload?.extension ?? payload);
                return { extension } as GetExtensionQuery;
            },
            [pkgName, skip],
            { ...options, skip },
        );
    }

    public useGetAnimeExtension(
        pkgName: string,
        options?: QueryHookOptions<any, any>,
    ): AbortableApolloUseQueryResponse<any, any> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/anime/extension/${pkgName}`, {
                    config: { signal },
                });
                const payload = await response.json();
                const extension = this.normalizeExtensionPayload(payload?.extension ?? payload);
                return { extension };
            },
            [pkgName, skip],
            { ...options, skip },
        );
    }

    public useGetExtensionList(
        options?: QueryHookOptions<GetExtensionsQuery, GetExtensionsQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetExtensionsQuery, GetExtensionsQueryVariables> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/extension/list', {
                    config: { signal },
                });
                const payload = await response.json();
                const nodes = this.normalizeExtensionsPayload(payload);
                return {
                    extensions: {
                        nodes,
                        pageInfo: this.buildPageInfo(),
                        totalCount: nodes.length,
                    },
                } as GetExtensionsQuery;
            },
            [skip],
            { ...options, skip },
        );
    }

    public useExtensionListFetch(
        _options?: MutationHookOptions<GetExtensionsFetchMutation, GetExtensionsFetchMutationVariables>,
    ): AbortableApolloUseMutationResponse<GetExtensionsFetchMutation, GetExtensionsFetchMutationVariables> {
        const [mutate, result] = this.useRestMutation(async (_variables, signal) => {
            const response = await this.restClient.fetcher('/api/v1/extension/list?refresh=true', {
                config: { signal },
            });
            const payload = await response.json();
            const extensions = this.normalizeExtensionsPayload(payload);
            return {
                fetchExtensions: {
                    extensions,
                },
            } as GetExtensionsFetchMutation;
        });
        const [, setUpdatedCache] = useState({});

        const settings = (this.serverSettingsSnapshot as any)?.settings;
        const cacheKeyData = settings?.extensionRepos ?? [];

        useEffect(() => {
            if (result.loading) {
                return;
            }

            if (!result.data?.fetchExtensions?.extensions) {
                return;
            }

            this.cache.cacheResponse(EXTENSION_LIST_CACHE_KEY, cacheKeyData, result);
            this.cache.cacheResponse(EXTENSION_LIST_CACHE_KEY, undefined, result);
            setUpdatedCache({});
        }, [result.loading]);

        const cachedResult =
            this.cache.getResponseFor<typeof result>(
                EXTENSION_LIST_CACHE_KEY,
                cacheKeyData,
                d(1).minutes.inWholeMilliseconds,
            ) ??
            this.cache.getResponseFor<typeof result>(
                EXTENSION_LIST_CACHE_KEY,
                undefined,
                d(1).minutes.inWholeMilliseconds,
            );
        const normalizedCachedResult = useMemo(
            () => (!cachedResult ? result : cachedResult),
            [this.cache.getFetchTimestampFor(EXTENSION_LIST_CACHE_KEY, cacheKeyData), result.loading],
        );

        const wrappedMutate = async (mutateOptions: Parameters<typeof mutate>[0]) => {
            if (cachedResult) {
                // Ensure components re-render to pick up cache updates.
                setUpdatedCache({});
                return normalizedCachedResult;
            }

            return mutate(mutateOptions);
        };

        return [wrappedMutate, normalizedCachedResult];
    }

    public useAnimeExtensionListFetch(
        _options?: MutationHookOptions<any, any>,
    ): AbortableApolloUseMutationResponse<any, any> {
        const [mutate, result] = this.useRestMutation(async (_variables, signal) => {
            const response = await this.restClient.fetcher('/api/v1/anime/extension/list?refresh=true', {
                config: { signal },
            });
            const payload = await response.json();
            const extensions = this.normalizeExtensionsPayload(payload);
            return {
                fetchAnimeExtensions: {
                    extensions,
                },
            };
        });
        const [, setUpdatedCache] = useState({});

        const cacheKeyData =
            (this.serverSettingsSnapshot as any)?.settings?.animeExtensionRepos ??
            (this.serverSettingsSnapshot as any)?.settings?.extensionRepos ??
            [];

        useEffect(() => {
            if (result.loading) {
                return;
            }

            if (!result.data?.fetchAnimeExtensions?.extensions) {
                return;
            }

            this.cache.cacheResponse(ANIME_EXTENSION_LIST_CACHE_KEY, cacheKeyData, result);
            this.cache.cacheResponse(ANIME_EXTENSION_LIST_CACHE_KEY, undefined, result);
            setUpdatedCache({});
        }, [result.loading]);

        const cachedResult =
            this.cache.getResponseFor<typeof result>(
                ANIME_EXTENSION_LIST_CACHE_KEY,
                cacheKeyData,
                d(1).minutes.inWholeMilliseconds,
            ) ??
            this.cache.getResponseFor<typeof result>(
                ANIME_EXTENSION_LIST_CACHE_KEY,
                undefined,
                d(1).minutes.inWholeMilliseconds,
            );

        const normalizedCachedResult = useMemo(
            () => (!cachedResult ? result : cachedResult),
            [this.cache.getFetchTimestampFor(ANIME_EXTENSION_LIST_CACHE_KEY, cacheKeyData), result.loading],
        );

        const wrappedMutate = async (mutateOptions: Parameters<typeof mutate>[0]) => {
            if (cachedResult) {
                // Ensure components re-render to pick up cache updates.
                setUpdatedCache({});
                return normalizedCachedResult;
            }

            return mutate(mutateOptions);
        };

        return [wrappedMutate, normalizedCachedResult];
    }

    public useGetAnimeExtensionList(
        options?: QueryHookOptions<any, any>,
    ): AbortableApolloUseQueryResponse<any, any> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/anime/extension/list', {
                    config: { signal },
                });
                const payload = await response.json();
                const nodes = this.normalizeExtensionsPayload(payload);
                return {
                    animeExtensions: {
                        nodes,
                        pageInfo: this.buildPageInfo(),
                        totalCount: nodes.length,
                    },
                } as any;
            },
            [skip],
            { ...options, skip },
        );
    }

    public installExternalExtension(
        extensionFile: File,
        _options?: MutationOptions<InstallExternalExtensionMutation, InstallExternalExtensionMutationVariables>,
    ): AbortableApolloMutationResponse<InstallExternalExtensionMutation> {
        return this.doRestMutation(async (signal) => {
            const formData = new FormData();
            formData.append('file', extensionFile);
            await this.restClient.fetcher('/api/v1/extension/install', {
                httpMethod: HttpMethod.POST,
                data: formData,
                config: { signal },
            });
            const extensions = await this.refreshExtensionListCache(signal, { refresh: true });
            const installedExtension =
                extensions.find((extension: any) => extension.apkName === extensionFile.name) ??
                extensions[0] ??
                this.normalizeExtensionPayload({
                    pkgName: '',
                    name: '',
                    lang: '',
                    versionCode: 0,
                    versionName: '',
                    iconUrl: '',
                    repo: null,
                    isNsfw: false,
                    isInstalled: true,
                    isObsolete: false,
                    hasUpdate: false,
                });
            return {
                installExternalExtension: {
                    extension: installedExtension,
                },
            } as InstallExternalExtensionMutation;
        });
    }

    public updateExtension(
        id: string,
        { isObsolete: _isObsolete = false, ...patch }: UpdateExtensionPatchInput & { isObsolete?: boolean },
        _options?: MutationOptions<UpdateExtensionMutation, UpdateExtensionMutationVariables>,
    ): AbortableApolloMutationResponse<UpdateExtensionMutation> {
        return this.doRestMutation(async (signal) => {
            const action = patch.install ? 'install' : patch.update ? 'update' : patch.uninstall ? 'uninstall' : null;
            if (!action) {
                return {
                    updateExtension: {
                        extension: null,
                    },
                } as UpdateExtensionMutation;
            }
            await this.restClient.fetcher(`/api/v1/extension/${action}/${id}`, {
                config: { signal },
            });
            const extensions = await this.refreshExtensionListCache(signal, { refresh: true });
            const extension = extensions.find((item: any) => item.pkgName === id) ?? null;
            return {
                updateExtension: {
                    extension,
                },
            } as UpdateExtensionMutation;
        });
    }

    public updateAnimeExtension(
        id: string,
        patch: any,
        _options?: MutationOptions<any, any>,
    ): AbortableApolloMutationResponse<any> {
        return this.doRestMutation(async (signal) => {
            const action = patch.install ? 'install' : patch.update ? 'update' : patch.uninstall ? 'uninstall' : null;
            if (action) {
                const repo = typeof patch.repo === 'string' ? patch.repo.trim() : '';
                const url =
                    action === 'install' && repo
                        ? `/api/v1/anime/extension/${action}/${id}?repo=${encodeURIComponent(repo)}`
                        : `/api/v1/anime/extension/${action}/${id}`;
                await this.restClient.fetcher(url, {
                    config: { signal },
                });
            }
            await this.refreshExtensionListCache(signal, { refresh: true, anime: true });
            return { updateAnimeExtension: { ok: true } };
        });
    }

    public updateAnimeExtensions(
        ids: string[],
        patch: any,
        _options?: MutationOptions<any, any>,
    ): AbortableApolloMutationResponse<any> {
        return this.doRestMutation(async (signal) => {
            const action = patch.install ? 'install' : patch.update ? 'update' : patch.uninstall ? 'uninstall' : null;
            if (action) {
                await Promise.all(
                    ids.map((id) =>
                        this.restClient.fetcher(`/api/v1/anime/extension/${action}/${id}`, { config: { signal } }),
                    ),
                );
            }
            await this.refreshExtensionListCache(signal, { refresh: true, anime: true });
            return { updateAnimeExtensions: { ok: true } };
        });
    }

    public updateExtensions(
        ids: string[],
        { isObsolete: _isObsolete = false, ...patch }: UpdateExtensionPatchInput & { isObsolete?: boolean },
        _options?: MutationOptions<UpdateExtensionsMutation, UpdateExtensionsMutationVariables>,
    ): AbortableApolloMutationResponse<UpdateExtensionsMutation> {
        return this.doRestMutation(async (signal) => {
            const action = patch.install ? 'install' : patch.update ? 'update' : patch.uninstall ? 'uninstall' : null;
            if (action) {
                await Promise.all(
                    ids.map((id) => this.restClient.fetcher(`/api/v1/extension/${action}/${id}`, { config: { signal } })),
                );
            }
            const extensions = await this.refreshExtensionListCache(signal, { refresh: true });
            const updatedExtensions = extensions.filter((extension: any) => ids.includes(extension.pkgName));
            return {
                updateExtensions: {
                    extensions: updatedExtensions,
                },
            } as UpdateExtensionsMutation;
        });
    }

    public getExtensionIconUrl(extension: string): string {
        return this.getValidImgUrlFor(`extension/icon/${extension}`);
    }

    public useGetSourceList(
        options?: QueryHookOptions<GetSourcesListQuery, GetSourcesListQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetSourcesListQuery, GetSourcesListQueryVariables> {
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/source/list', { config: { signal } });
                const payload = await response.json();
                const rawNodes = Array.isArray(payload) ? payload : payload?.sources ?? payload?.nodes ?? [];
                const nodes = Array.isArray(rawNodes)
                    ? rawNodes.filter((node: any) => node && typeof node === 'object' && node.id != null)
                    : [];
                return {
                    sources: {
                        nodes: nodes.map((source: any) => this.normalizeSourcePayload(source)),
                    },
                } as GetSourcesListQuery;
            },
            [options?.skip],
            options,
        );
    }

    public useGetAnimeSourceList(options?: QueryHookOptions<any, any>): AbortableApolloUseQueryResponse<any, any> {
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/anime/source/list', { config: { signal } });
                const payload = await response.json();
                const rawNodes = Array.isArray(payload) ? payload : payload?.sources ?? payload?.nodes ?? [];
                const nodes = Array.isArray(rawNodes)
                    ? rawNodes.filter((node: any) => node && typeof node === 'object' && node.id != null)
                    : [];
                return {
                    animeSources: {
                        nodes: nodes.map((source: any) => this.normalizeSourcePayload(source)),
                    },
                };
            },
            [options?.skip],
            options,
        );
    }

    public useGetAnimeLibrary(options?: QueryHookOptions<any, any>): AbortableApolloUseQueryResponse<any, any> {
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/anime/library', { config: { signal } });
                const payload = await response.json();
                const rawNodes = Array.isArray(payload) ? payload : payload?.animes?.nodes ?? payload?.nodes ?? [];
                const nodes = Array.isArray(rawNodes) ? rawNodes : [];
                return {
                    animes: {
                        nodes: nodes.map((anime: any) => this.normalizeSourceAnimePayload(anime)),
                        totalCount: nodes.length,
                    },
                };
            },
            [options?.skip],
            options,
        );
    }

    public useGetAnimeSourceBrowse(
        id: string,
        options?: QueryHookOptions<any, any>,
    ): AbortableApolloUseQueryResponse<any, any> {
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/anime/source/${id}`, {
                    config: { signal },
                });
                const payload = await response.json();
                const source = payload?.source ?? payload;
                return {
                    animeSource: this.normalizeSourcePayload(source),
                };
            },
            [id, options?.skip],
            options,
        );
    }

    public useGetSourceBrowse(
        id: string,
        options?: QueryHookOptions<GetSourceBrowseQuery, GetSourceBrowseQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetSourceBrowseQuery, GetSourceBrowseQueryVariables> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/source/${id}`, { config: { signal } });
                const payload = await response.json();
                const source = payload?.source ?? payload;
                return {
                    source: this.normalizeSourcePayload(source),
                } as GetSourceBrowseQuery;
            },
            [id, skip],
            { ...options, skip },
        );
    }

    public useGetSourceSettings(
        id: string,
        options?: QueryHookOptions<GetSourceSettingsQuery, GetSourceSettingsQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetSourceSettingsQuery, GetSourceSettingsQueryVariables> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/source/${id}`, { config: { signal } });
                const payload = await response.json();
                const source = payload?.source ?? payload;
                return {
                    source: this.normalizeSourcePayload(source),
                } as GetSourceSettingsQuery;
            },
            [id, skip],
            { ...options, skip },
        );
    }

    public useGetAnimeSourceSettings(
        id: string,
        options?: QueryHookOptions<any, any>,
    ): AbortableApolloUseQueryResponse<any, any> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/anime/source/${id}/preferences`, {
                    config: { signal },
                });
                const payload = await response.json();
                const preferencesRaw = Array.isArray(payload)
                    ? payload
                    : payload?.preferences ?? payload ?? [];
                const preferences = (Array.isArray(preferencesRaw) ? preferencesRaw : [])
                    .map((pref) => this.normalizeSourcePreferencePayload(pref))
                    .filter(Boolean);
                return {
                    source: {
                        id,
                        preferences,
                    },
                };
            },
            [id, skip],
            { ...options, skip },
        );
    }

    public useGetSourceMigratable(
        id: string,
        options?: QueryHookOptions<GetSourceMigratableQuery, GetSourceMigratableQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetSourceMigratableQuery, GetSourceMigratableQueryVariables> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/source/${id}`, { config: { signal } });
                const payload = await response.json();
                const source = payload?.source ?? payload;
                return {
                    source: this.normalizeSourcePayload(source),
                } as GetSourceMigratableQuery;
            },
            [id, skip],
            { ...options, skip },
        );
    }

    public setSourceMeta(
        sourceId: string,
        key: string,
        value: any,
        options?: MutationOptions<SetSourceMetadataMutation, SetSourceMetadataMutationVariables>,
    ): AbortableApolloMutationResponse<SetSourceMetadataMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher(`/api/v1/meta/source/${sourceId}`, {
                httpMethod: HttpMethod.POST,
                data: { key, value: `${value}` },
                config: { signal },
            });
            return {
                setSourceMeta: {
                    meta: { sourceId, key, value: `${value}` },
                },
            } as SetSourceMetadataMutation;
        });
    }

    public deleteSourceMeta(
        sourceId: string,
        key: string,
        options?: MutationOptions<DeleteSourceMetadataMutation, DeleteSourceMetadataMutationVariables>,
    ): AbortableApolloMutationResponse<DeleteSourceMetadataMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher(`/api/v1/meta/source/${sourceId}`, {
                httpMethod: HttpMethod.DELETE,
                data: { key, value: null },
                config: { signal },
            });
            return {
                deleteSourceMeta: {
                    meta: { sourceId, key, value: '' },
                },
            } as DeleteSourceMetadataMutation;
        });
    }

    public useGetSourceMangas(
        input: FetchSourceMangaInput,
        initialPages: number = 1,
        options?: ApolloPaginatedMutationOptions<GetSourceMangasFetchMutation, GetSourceMangasFetchMutationVariables>,
    ): AbortableApolloUseMutationPaginatedResponse<
        GetSourceMangasFetchMutation,
        GetSourceMangasFetchMutationVariables
    > {
        type MutationResult = AbortableApolloUseMutationPaginatedResponse<
            GetSourceMangasFetchMutation,
            GetSourceMangasFetchMutationVariables
        >[1];
        type MutationDataResult = MutationResult[number];

        const createPaginatedResult = (
            result?: Partial<AbortableApolloUseMutationPaginatedResponse[1][number]> | null,
            page?: number,
        ) => this.createPaginatedResult(result, input.page, page);

        const getVariablesFor = (page: number): GetSourceMangasFetchMutationVariables => ({
            input: {
                ...input,
                page,
            },
        });

        const isRevalidationDoneRef = useRef(false);
        const activeRevalidationRef = useRef<
            | [
                  ForInput: GetSourceMangasFetchMutationVariables,
                  Request: Promise<unknown>,
                  AbortRequest: AbortableRequest['abortRequest'],
              ]
            | null
        >(null);
        const abortRequestRef = useRef<AbortableRequest['abortRequest']>(() => {});
        const resultRef = useRef<(MutationDataResult & { forInput: string }) | null>(null);
        const result = resultRef.current;

        const [, setTriggerRerender] = useState(0);
        const triggerRerender = () => setTriggerRerender((prev) => prev + 1);
        const setResult = (nextResult: typeof resultRef.current) => {
            resultRef.current = nextResult;
            triggerRerender();
        };

        const cachedPages = this.cache.getResponseFor<Set<number>>(CACHE_PAGES_KEY, getVariablesFor(0)) ?? new Set();
        const cachedResults = [...cachedPages]
            .map(
                (cachedPage) =>
                    this.cache.getResponseFor<MutationDataResult>(CACHE_RESULTS_KEY, getVariablesFor(cachedPage))!,
            )
            .sort((a, b) => a.size - b.size);
        const areFetchingInitialPages = !!this.cache.getResponseFor<boolean>(
            CACHE_INITIAL_PAGES_FETCHING_KEY,
            getVariablesFor(0),
        );

        const areInitialPagesFetched =
            cachedResults.length >= initialPages ||
            (!!cachedResults.length && !cachedResults[cachedResults.length - 1].data?.fetchSourceManga?.hasNextPage);
        const isResultForCurrentInput = result?.forInput === JSON.stringify(getVariablesFor(0));
        const lastPage = cachedPages.size ? Math.max(...cachedPages) : input.page;
        const nextPage = isResultForCurrentInput ? result.size : lastPage;

        const paginatedResult =
            isResultForCurrentInput && areInitialPagesFetched ? result : createPaginatedResult(undefined, nextPage);
        paginatedResult.abortRequest = abortRequestRef.current;

        // make sure that the result is always for the current input
        resultRef.current = { forInput: JSON.stringify(getVariablesFor(0)), ...paginatedResult };

        const hasCachedResult = !!this.cache.getResponseFor(CACHE_RESULTS_KEY, getVariablesFor(nextPage));

        const revalidatePage = async (pageToRevalidate: number, maxPage: number, signal: AbortSignal) =>
            this.revalidatePage(
                input.source,
                CACHE_RESULTS_KEY,
                CACHE_PAGES_KEY,
                getVariablesFor,
                (cachedResult, revalidatedResult) =>
                    !cachedResult ||
                    !cachedResult.data?.fetchSourceManga?.mangas.length ||
                    cachedResult.data.fetchSourceManga.mangas.some(
                        (manga: { id?: number }, index: number) =>
                            manga.id !== revalidatedResult.data?.fetchSourceManga?.mangas[index]?.id,
                    ),
                (revalidatedResult) => !!revalidatedResult.data?.fetchSourceManga?.hasNextPage,
                pageToRevalidate,
                maxPage,
                signal,
            );

        const revalidate = async (
            maxPage: number,
            abortRequest: AbortableRequest['abortRequest'],
            signal: AbortSignal,
        ) =>
            this.revalidatePages(
                activeRevalidationRef.current,
                (isDone) => {
                    isRevalidationDoneRef.current = isDone;
                },
                (activeRevalidation) => {
                    activeRevalidationRef.current = activeRevalidation;
                },
                getVariablesFor,
                (isValidating) => {
                    setResult({
                        ...createPaginatedResult(resultRef.current),
                        isValidating,
                        forInput: JSON.stringify(getVariablesFor(0)),
                    });
                },
                revalidatePage,
                maxPage,
                abortRequest,
                signal,
            );

        // wrap "mutate" function to align with the expected type, which allows only passing a "page" argument
        const wrappedMutate = async (newPage: number) =>
            this.fetchPaginatedMutationPage<GetSourceMangasFetchMutation, GetSourceMangasFetchMutationVariables>(
                getVariablesFor,
                (abortRequest) => {
                    abortRequestRef.current = abortRequest;
                },
                () => ({ forType: input.type, forQuery: input.query }),
                createPaginatedResult,
                setResult,
                revalidate,
                CACHE_PAGES_KEY,
                CACHE_RESULTS_KEY,
                cachedPages,
                newPage,
            );

        this.fetchInitialPages(
            options,
            areFetchingInitialPages,
            areInitialPagesFetched,
            (isDone) => {
                isRevalidationDoneRef.current = isDone;
            },
            CACHE_INITIAL_PAGES_FETCHING_KEY,
            getVariablesFor,
            initialPages,
            wrappedMutate,
            (fetchedResult) => !!fetchedResult.data?.fetchSourceManga?.hasNextPage,
        );

        this.revalidateInitialPages(
            isRevalidationDoneRef.current,
            cachedResults.length,
            cachedPages,
            (isDone) => {
                isRevalidationDoneRef.current = isDone;
            },
            getVariablesFor,
            triggerRerender,
            revalidate,
        );

        const normalizedCachedResults = cachedResults.map((cachedResult) => {
            const hasResults = !!cachedResult.data?.fetchSourceManga?.mangas;
            if (!hasResults) {
                return cachedResult;
            }

            return {
                ...cachedResult,
                data: {
                    ...cachedResult.data,
                    fetchSourceManga: {
                        ...cachedResult.data?.fetchSourceManga,
                        mangas: cachedResult.data?.fetchSourceManga?.mangas.map((manga) =>
                            this.normalizeMangaPayload(manga),
                        ),
                    },
                },
            };
        });

        return this.returnPaginatedMutationResult(
            areInitialPagesFetched,
            normalizedCachedResults,
            getVariablesFor,
            paginatedResult,
            wrappedMutate,
            hasCachedResult,
            createPaginatedResult,
        );
    }

    public useGetSourcePopularMangas(
        sourceId: string,
        initialPages?: number,
        options?: ApolloPaginatedMutationOptions<GetSourceMangasFetchMutation, GetSourceMangasFetchMutationVariables>,
    ): AbortableApolloUseMutationPaginatedResponse<
        GetSourceMangasFetchMutation,
        GetSourceMangasFetchMutationVariables
    > {
        return this.useGetSourceMangas(
            { type: FetchSourceMangaType.Popular, source: sourceId, page: 1 },
            initialPages,
            options,
        );
    }

    public useGetSourceLatestMangas(
        sourceId: string,
        initialPages?: number,
        options?: ApolloPaginatedMutationOptions<GetSourceMangasFetchMutation, GetSourceMangasFetchMutationVariables>,
    ): AbortableApolloUseMutationPaginatedResponse<
        GetSourceMangasFetchMutation,
        GetSourceMangasFetchMutationVariables
    > {
        return this.useGetSourceMangas(
            { type: FetchSourceMangaType.Latest, source: sourceId, page: 1 },
            initialPages,
            options,
        );
    }

    public setSourcePreferences(
        source: string,
        change: SourcePreferenceChangeInput,
        options?: MutationOptions<UpdateSourcePreferencesMutation, UpdateSourcePreferencesMutationVariables>,
    ): AbortableApolloMutationResponse<UpdateSourcePreferencesMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher(`/api/v1/source/${source}/preferences`, {
                httpMethod: HttpMethod.POST,
                data: { change },
                config: { signal },
            });
            return {
                updateSourcePreference: {
                    source: { id: source, preferences: [] },
                },
            } as unknown as UpdateSourcePreferencesMutation;
        });
    }

    public setAnimeSourcePreferences(
        source: string,
        change: SourcePreferenceChangeInput,
        options?: MutationOptions<any, any>,
    ): AbortableApolloMutationResponse<any> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher(`/api/v1/anime/source/${source}/preferences`, {
                httpMethod: HttpMethod.POST,
                data: { change },
                config: { signal },
            });
            return {
                updateSourcePreference: {
                    source: { id: source, preferences: [] },
                },
            };
        });
    }

    public useSourceSearch(
        source: string,
        query?: string,
        filters?: FilterChangeInput[],
        initialPages?: number,
        options?: ApolloPaginatedMutationOptions<GetSourceMangasFetchMutation, GetSourceMangasFetchMutationVariables>,
    ): AbortableApolloUseMutationPaginatedResponse<
        GetSourceMangasFetchMutation,
        GetSourceMangasFetchMutationVariables
    > {
        return this.useGetSourceMangas(
            { type: FetchSourceMangaType.Search, source, query, filters, page: 1 },
            initialPages,
            options,
        );
    }

    public useGetSourceAnimes(
        options?: MutationHookOptions<any, any>,
    ): AbortableApolloUseMutationResponse<any, any> {
        return this.useRestMutation(async (variables, signal) => {
            const input = variables?.input ?? variables;
            const payload = await this.fetchSourceAnimesRest(input, signal);
            return payload;
        });
    }

    public useGetMangaScreen(
        mangaId: number | string,
        options?: QueryHookOptions<GetMangaScreenQuery, GetMangaScreenQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetMangaScreenQuery, GetMangaScreenQueryVariables> {
        const skip = options?.skip ?? false;
        const id = Number(mangaId);
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/manga/${id}`, { config: { signal } });
                const payload = await response.json();
                const manga = this.normalizeMangaPayload(payload?.manga ?? payload);
                return { manga } as GetMangaScreenQuery;
            },
            [id, skip],
            { ...options, skip },
        );
    }

    public getMangaScreen(
        mangaId: number | string,
        options?: QueryOptions<GetMangaScreenQueryVariables, GetMangaScreenQuery>,
    ): AbortabaleApolloQueryResponse<GetMangaScreenQuery> {
        const id = Number(mangaId);
        return this.doRestQuery(async (signal) => {
            const response = await this.restClient.fetcher(`/api/v1/manga/${id}`, { config: { signal } });
            const payload = await response.json();
            const manga = this.normalizeMangaPayload(payload?.manga ?? payload);
            return { manga } as GetMangaScreenQuery;
        });
    }

    public useGetMangaReader(
        mangaId: number | string,
        options?: QueryHookOptions<GetMangaReaderQuery, GetMangaReaderQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetMangaReaderQuery, GetMangaReaderQueryVariables> {
        const skip = options?.skip ?? false;
        const id = Number(mangaId);
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/manga/${id}`, { config: { signal } });
                const payload = await response.json();
                const manga = this.normalizeMangaPayload(payload?.manga ?? payload);
                return { manga } as GetMangaReaderQuery;
            },
            [id, skip],
            { ...options, skip },
        );
    }

    public useGetMangaTrackRecords(
        mangaId: number | string,
        options?: QueryHookOptions<GetMangaTrackRecordsQuery, GetMangaTrackRecordsQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetMangaTrackRecordsQuery, GetMangaTrackRecordsQueryVariables> {
        const skip = options?.skip ?? false;
        const id = Number(mangaId);
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/manga/${id}/track-records`, {
                    config: { signal },
                });
                return (await response.json()) as GetMangaTrackRecordsQuery;
            },
            [id, skip],
            { ...options, skip },
        );
    }

    public useGetMangaCategories(
        mangaId: number | string,
        options?: QueryHookOptions<GetMangaCategoriesQuery, GetMangaCategoriesQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetMangaCategoriesQuery, GetMangaCategoriesQueryVariables> {
        const skip = options?.skip ?? false;
        const id = Number(mangaId);
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/manga/${id}/categories`, { config: { signal } });
                return (await response.json()) as GetMangaCategoriesQuery;
            },
            [id, skip],
            { ...options, skip },
        );
    }

    public getMangaToMigrate(
        mangaId: number | string,
        {
            migrateChapters = false,
            migrateCategories = false,
            migrateTracking = false,
            deleteChapters = false,
        }: Partial<MetadataMigrationSettings> = {},
    ): AbortabaleApolloQueryResponse<GetMangaToMigrateQuery> {
        return this.doRestQuery(async (signal) => {
            const params = new URLSearchParams();
            if (migrateChapters || deleteChapters) {
                params.set('migrateChapters', 'true');
            }
            if (migrateCategories) {
                params.set('migrateCategories', 'true');
            }
            if (migrateTracking) {
                params.set('migrateTracking', 'true');
            }
            if (deleteChapters) {
                params.set('deleteChapters', 'true');
            }
            const suffix = params.toString() ? `?${params.toString()}` : '';
            const response = await this.restClient.fetcher(`/api/v1/manga/${Number(mangaId)}/migration${suffix}`, {
                config: { signal },
            });
            return (await response.json()) as GetMangaToMigrateQuery;
        });
    }

    public getMangaFetch(
        mangaId: number | string,
        options?: MutationOptions<GetMangaFetchMutation, GetMangaFetchMutationVariables>,
    ): AbortableApolloMutationResponse<GetMangaFetchMutation> {
        return this.doRestMutation(async (signal) => {
            const response = await this.restClient.fetcher(`/api/v1/manga/${Number(mangaId)}/fetch`, {
                config: { signal },
            });
            return (await response.json()) as GetMangaFetchMutation;
        });
    }

    public getMangaToMigrateToFetch(
        mangaId: number | string,
        {
            migrateChapters = false,
            migrateCategories = false,
            migrateTracking = false,
        }: Partial<Omit<MetadataMigrationSettings, 'deleteChapters'>> = {},
    ): AbortableApolloMutationResponse<GetMangaToMigrateToFetchMutation> {
        return this.doRestMutation(async (signal) => {
            const params = new URLSearchParams();
            if (migrateChapters) {
                params.set('migrateChapters', 'true');
            }
            if (migrateCategories) {
                params.set('migrateCategories', 'true');
            }
            if (migrateTracking) {
                params.set('migrateTracking', 'true');
            }
            const suffix = params.toString() ? `?${params.toString()}` : '';
            const response = await this.restClient.fetcher(`/api/v1/manga/${Number(mangaId)}/fetch${suffix}`, {
                config: { signal },
            });
            return (await response.json()) as GetMangaToMigrateToFetchMutation;
        });
    }

    public useGetLibraryMangaCount(
        options?: QueryHookOptions<GetLibraryMangaCountQuery, GetLibraryMangaCountQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetLibraryMangaCountQuery, GetLibraryMangaCountQueryVariables> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/manga/library/count', { config: { signal } });
                return (await response.json()) as GetLibraryMangaCountQuery;
            },
            [skip],
            { ...options, skip },
        );
    }

    public useGetMangasDuplicates(
        options?: QueryHookOptions<GetMangasDuplicatesQuery, GetMangasDuplicatesQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetMangasDuplicatesQuery, GetMangasDuplicatesQueryVariables> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/categories/0/mangas', { config: { signal } });
                const payload = await response.json();
                const mangas = payload?.category?.mangas ?? payload?.mangas ?? payload;
                const nodes = Array.isArray(mangas?.nodes) ? mangas.nodes : [];
                return {
                    mangas: {
                        ...mangas,
                        nodes: nodes.map((manga: any) => this.normalizeMangaPayload(manga)),
                    },
                } as GetMangasDuplicatesQuery;
            },
            [skip],
            { ...options, skip },
        );
    }

    public getMangasBase(
        variables?: GetMangasBaseQueryVariables,
        options?: QueryOptions<GetMangasBaseQueryVariables, GetMangasBaseQuery>,
    ): AbortabaleApolloQueryResponse<GetMangasBaseQuery> {
        return this.doRestQuery(async (signal) => {
            const inLibrary =
                (variables as any)?.condition?.inLibrary ??
                (variables as any)?.filter?.inLibrary?.equalTo ??
                (variables as any)?.filter?.inLibrary?.equals;
            const title =
                (variables as any)?.filter?.title?.likeInsensitive ??
                (variables as any)?.filter?.title?.includesInsensitive ??
                (variables as any)?.filter?.title?.like ??
                (variables as any)?.filter?.title?.includes ??
                (variables as any)?.condition?.title;
            const params = new URLSearchParams();
            if (inLibrary != null) {
                params.set('inLibrary', String(inLibrary));
            }
            if (title) {
                params.set('title', String(title));
            }
            const suffix = params.toString() ? `?${params.toString()}` : '';
            const response = await this.restClient.fetcher(`/api/v1/manga/library/search${suffix}`, {
                config: { signal },
            });
            const payload = await response.json();
            const nodes = Array.isArray(payload?.mangas?.nodes) ? payload.mangas.nodes : [];
            return {
                mangas: {
                    ...payload.mangas,
                    nodes: nodes.map((manga: any) => this.normalizeMangaPayload(manga)),
                },
            } as GetMangasBaseQuery;
        });
    }

    public useGetMigratableSourceMangas(
        sourceId: string,
        options?: QueryHookOptions<GetMigratableSourceMangasQuery, GetMigratableSourceMangasQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetMigratableSourceMangasQuery, GetMigratableSourceMangasQueryVariables> {
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/manga/library/search?inLibrary=true', {
                    config: { signal },
                });
                const payload = await response.json();
                const nodes = Array.isArray(payload?.mangas?.nodes) ? payload.mangas.nodes : [];
                const filtered = nodes
                    .filter((manga: any) => `${manga?.sourceId ?? manga?.source_id ?? ''}` === `${sourceId}`)
                    .map((manga: any) => ({
                        ...this.normalizeMangaPayload(manga),
                        categories: { nodes: [] },
                    }));
                return {
                    mangas: {
                        nodes: filtered,
                    },
                } as GetMigratableSourceMangasQuery;
            },
            [sourceId, options?.skip],
            options,
        );
    }

    public useUpdateMangaCategories(
        options?: MutationHookOptions<UpdateMangaCategoriesMutation, UpdateMangaCategoriesMutationVariables>,
    ): AbortableApolloUseMutationResponse<UpdateMangaCategoriesMutation, UpdateMangaCategoriesMutationVariables> {
        return this.useRestMutation(async (variables, signal) => {
            const input = variables?.input;
            if (!input) {
                throw new Error('useUpdateMangaCategories: no variables passed');
            }
            await this.restClient.fetcher('/api/v1/categories/mangas/update', {
                httpMethod: HttpMethod.POST,
                data: { ids: [input.id], patch: input.patch },
                config: { signal },
            });
            return {
                updateMangaCategories: {
                    manga: {
                        id: input.id,
                        categories: { totalCount: 0, nodes: [] },
                    },
                },
            } as UpdateMangaCategoriesMutation;
        });
    }

    public updateMangasCategories(
        mangaIds: number[],
        patch: UpdateMangaCategoriesPatchInput,
        options?: MutationOptions<UpdateMangasCategoriesMutation, UpdateMangasCategoriesMutationVariables>,
    ): AbortableApolloMutationResponse<UpdateMangasCategoriesMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/categories/mangas/update', {
                httpMethod: HttpMethod.POST,
                data: { ids: mangaIds, patch },
                config: { signal },
            });
            return {
                updateMangasCategories: {
                    mangas: mangaIds.map((id) => ({ id, categories: { totalCount: 0, nodes: [] } })),
                },
            } as UpdateMangasCategoriesMutation;
        });
    }

    public updateManga(
        id: number,
        patch: { updateManga: UpdateMangaPatchInput; updateMangaCategories?: UpdateMangaCategoriesPatchInput },
        options?: MutationOptions<UpdateMangaMutation, UpdateMangaMutationVariables>,
    ): AbortableApolloMutationResponse<UpdateMangaMutation> {
        return this.doRestMutation(async (signal) => {
            if (patch.updateManga?.inLibrary != null) {
                await this.restClient.fetcher('/api/v1/manga/library/update', {
                    httpMethod: HttpMethod.POST,
                    data: { ids: [id], inLibrary: patch.updateManga.inLibrary },
                    config: { signal },
                });
            }
            if (patch.updateMangaCategories) {
                await this.restClient.fetcher('/api/v1/categories/mangas/update', {
                    httpMethod: HttpMethod.POST,
                    data: { ids: [id], patch: patch.updateMangaCategories },
                    config: { signal },
                });
            }
            return {
                updateManga: {
                    manga: {
                        id,
                        inLibrary: patch.updateManga?.inLibrary ?? false,
                        inLibraryAt: '',
                    },
                },
                updateMangaCategories: patch.updateMangaCategories
                    ? {
                          manga: {
                              id,
                              categories: { totalCount: 0, nodes: [] },
                          },
                      }
                    : null,
            } as UpdateMangaMutation;
        });
    }

    public updateAnime(
        id: number,
        patch: { inLibrary?: boolean },
        options?: MutationOptions<any, any>,
    ): AbortableApolloMutationResponse<any> {
        return this.doRestMutation(async (signal) => {
            if (patch.inLibrary != null) {
                await this.restClient.fetcher('/api/v1/anime/library/update', {
                    httpMethod: HttpMethod.POST,
                    data: { ids: [id], inLibrary: patch.inLibrary },
                    config: { signal },
                });
            }
            return { updateAnime: { ok: true, anime: { id, inLibrary: patch.inLibrary ?? false } } };
        });
    }

    public updateAnimes(
        ids: number[],
        patch: { inLibrary?: boolean },
        options?: MutationOptions<any, any>,
    ): AbortableApolloMutationResponse<any> {
        return this.doRestMutation(async (signal) => {
            if (patch.inLibrary != null) {
                await this.restClient.fetcher('/api/v1/anime/library/update', {
                    httpMethod: HttpMethod.POST,
                    data: { ids, inLibrary: patch.inLibrary },
                    config: { signal },
                });
            }
            return { updateAnimes: { ok: true } };
        });
    }

    public updateMangas(
        ids: number[],
        patch: { updateMangas: UpdateMangaPatchInput; updateMangasCategories?: UpdateMangaCategoriesPatchInput },
        options?: MutationOptions<UpdateMangasMutation, UpdateMangasMutationVariables>,
    ): AbortableApolloMutationResponse<UpdateMangasMutation> {
        return this.doRestMutation(async (signal) => {
            if (patch.updateMangas?.inLibrary != null) {
                await this.restClient.fetcher('/api/v1/manga/library/update', {
                    httpMethod: HttpMethod.POST,
                    data: { ids, inLibrary: patch.updateMangas.inLibrary },
                    config: { signal },
                });
            }
            if (patch.updateMangasCategories) {
                await this.restClient.fetcher('/api/v1/categories/mangas/update', {
                    httpMethod: HttpMethod.POST,
                    data: { ids, patch: patch.updateMangasCategories },
                    config: { signal },
                });
            }
            return {
                updateMangas: {
                    mangas: ids.map((id) => ({
                        id,
                        inLibrary: patch.updateMangas?.inLibrary ?? false,
                        inLibraryAt: '',
                        categories: { totalCount: 0, nodes: [] },
                    })),
                },
                updateMangasCategories: patch.updateMangasCategories
                    ? {
                          mangas: ids.map((id) => ({
                              id,
                              categories: { totalCount: 0, nodes: [] },
                          })),
                      }
                    : null,
            } as UpdateMangasMutation;
        });
    }

    public setMangaMeta(
        mangaId: number,
        key: string,
        value: any,
        options?: MutationOptions<SetMangaMetadataMutation, SetMangaMetadataMutationVariables>,
    ): AbortableApolloMutationResponse<SetMangaMetadataMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher(`/api/v1/meta/manga/${mangaId}`, {
                httpMethod: HttpMethod.POST,
                data: { key, value: `${value}` },
                config: { signal },
            });
            return {
                setMangaMeta: {
                    meta: { mangaId, key, value: `${value}` },
                },
            } as SetMangaMetadataMutation;
        });
    }

    public deleteMangaMeta(
        mangaId: number,
        key: string,
        options?: MutationOptions<DeleteMangaMetadataMutation, DeleteMangaMetadataMutationVariables>,
    ): AbortableApolloMutationResponse<DeleteMangaMetadataMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher(`/api/v1/meta/manga/${mangaId}`, {
                httpMethod: HttpMethod.DELETE,
                data: { key, value: null },
                config: { signal },
            });
            return {
                deleteMangaMeta: {
                    meta: { mangaId, key, value: '' },
                },
            } as DeleteMangaMetadataMutation;
        });
    }

    public useGetReaderChapters(
        mangaId: number | string,
        options?: QueryHookOptions<GetChaptersReaderQuery, GetChaptersReaderQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetChaptersReaderQuery, GetChaptersReaderQueryVariables> {
        const skip = options?.skip ?? false;
        const id = Number(mangaId);
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/manga/${id}/chapters`, { config: { signal } });
                const payload = await response.json();
                const rawNodes = Array.isArray(payload) ? payload : payload?.chapters ?? payload?.nodes ?? [];
                const nodes = Array.isArray(rawNodes) ? rawNodes : [];
                const sorted = [...nodes].sort((a: any, b: any) => {
                    const aOrder = Number(a?.sourceOrder ?? a?.index ?? 0);
                    const bOrder = Number(b?.sourceOrder ?? b?.index ?? 0);
                    return bOrder - aOrder;
                });
                return {
                    chapters: {
                        nodes: sorted,
                        totalCount: sorted.length,
                        pageInfo: this.buildPageInfo(),
                    },
                } as GetChaptersReaderQuery;
            },
            [id, skip],
            { ...options, skip },
        );
    }

    public useGetMangaChaptersList(
        mangaId: number | string,
        options?: QueryHookOptions<GetChaptersMangaQuery, GetChaptersMangaQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetChaptersMangaQuery, GetChaptersMangaQueryVariables> {
        const skip = options?.skip ?? false;
        const id = Number(mangaId);
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/manga/${id}/chapters`, { config: { signal } });
                const payload = await response.json();
                const rawNodes = Array.isArray(payload) ? payload : payload?.chapters ?? payload?.nodes ?? [];
                const nodes = Array.isArray(rawNodes) ? rawNodes : [];
                const sorted = [...nodes].sort((a: any, b: any) => {
                    const aOrder = Number(a?.sourceOrder ?? a?.index ?? 0);
                    const bOrder = Number(b?.sourceOrder ?? b?.index ?? 0);
                    return bOrder - aOrder;
                });
                return {
                    chapters: {
                        nodes: sorted,
                        totalCount: sorted.length,
                        pageInfo: this.buildPageInfo(),
                    },
                } as GetChaptersMangaQuery;
            },
            [id, skip],
            { ...options, skip },
        );
    }

    public getMangaChaptersList(
        mangaId: number | string,
        options?: QueryOptions<GetChaptersMangaQueryVariables, GetChaptersMangaQuery>,
    ): AbortabaleApolloQueryResponse<GetChaptersMangaQuery> {
        const id = Number(mangaId);
        return this.doRestQuery(async (signal) => {
            const response = await this.restClient.fetcher(`/api/v1/manga/${id}/chapters`, { config: { signal } });
            const payload = await response.json();
            const rawNodes = Array.isArray(payload) ? payload : payload?.chapters ?? payload?.nodes ?? [];
            const nodes = Array.isArray(rawNodes)
                ? rawNodes.filter((node: any) => node && typeof node === 'object' && node.id != null)
                : [];
            const sorted = [...nodes].sort((a: any, b: any) => {
                const aOrder = Number(a?.sourceOrder ?? a?.index ?? 0);
                const bOrder = Number(b?.sourceOrder ?? b?.index ?? 0);
                return bOrder - aOrder;
            });
            return {
                chapters: {
                    nodes: sorted,
                    totalCount: sorted.length,
                    pageInfo: this.buildPageInfo(),
                },
            } as GetChaptersMangaQuery;
        });
    }

    public getMangasChapterIdsWithState(
        mangaIds: number[],
        states: Pick<ChapterConditionInput, 'isRead' | 'isDownloaded' | 'isBookmarked'>,
        options?: QueryOptions<GetMangasChapterIdsWithStateQueryVariables, GetMangasChapterIdsWithStateQuery>,
    ): AbortabaleApolloQueryResponse<GetMangasChapterIdsWithStateQuery> {
        return this.doRestQuery(async (signal) => {
            const response = await this.restClient.fetcher('/api/v1/chapters/state', {
                httpMethod: HttpMethod.POST,
                data: {
                    manga_ids: mangaIds,
                    isRead: states.isRead,
                    isDownloaded: states.isDownloaded,
                    isBookmarked: states.isBookmarked,
                },
                config: { signal },
            });
            return (await response.json()) as GetMangasChapterIdsWithStateQuery;
        });
    }

    public getMangaChaptersFetch(
        mangaId: number | string,
        options?: MutationOptions<GetMangaChaptersFetchMutation, GetMangaChaptersFetchMutationVariables>,
    ): AbortableApolloMutationResponse<GetMangaChaptersFetchMutation> {
        return this.doRestMutation(async (signal) => {
            const response = await this.restClient.fetcher(
                `/api/v1/manga/${Number(mangaId)}/chapters?onlineFetch=true`,
                { config: { signal } },
            );
            const payload = await response.json();
            const rawNodes = Array.isArray(payload) ? payload : payload?.chapters ?? payload?.nodes ?? [];
            const nodes = Array.isArray(rawNodes) ? rawNodes : [];
            return {
                fetchChapters: {
                    chapters: nodes,
                },
            } as GetMangaChaptersFetchMutation;
        });
    }

    public useGetMangaChapter(
        mangaId: number | string,
        chapterIndex: number | string,
        options?: QueryHookOptions<GetChaptersMangaQuery, GetChaptersMangaQueryVariables>,
    ): AbortableApolloUseQueryResponse<
        Omit<GetChaptersMangaQuery, 'chapters'> & { chapter: GetChaptersMangaQuery['chapters']['nodes'][number] },
        GetChaptersMangaQueryVariables
    > {
        type Response = AbortableApolloUseQueryResponse<
            Omit<GetChaptersMangaQuery, 'chapters'> & { chapter: GetChaptersMangaQuery['chapters']['nodes'][number] },
            GetChaptersMangaQueryVariables
        >;

        const chapterResponse = this.useGetMangaChaptersList(mangaId, options);

        if (!chapterResponse.data) {
            return chapterResponse as unknown as Response;
        }

        const resolvedChapterIndex = Number(chapterIndex);
        const chapter =
            chapterResponse.data.chapters.nodes.find(
                (node) => Number((node as any)?.sourceOrder ?? (node as any)?.index ?? -1) === resolvedChapterIndex,
            ) ?? chapterResponse.data.chapters.nodes[0];
        return {
            ...chapterResponse,
            data: {
                chapter,
            },
        } as unknown as Response;
    }

    public useGetChapterPagesFetch(
        mangaId: string | number,
        chapterIndex: string | number,
        chapterId?: string | number,
        _options?: MutationHookOptions<GetChapterPagesFetchMutation, GetChapterPagesFetchMutationVariables>,
    ): AbortableApolloUseMutationResponse<GetChapterPagesFetchMutation, GetChapterPagesFetchMutationVariables> {
        return this.useRestMutation(async (variables, signal) => {
            const resolvedMangaId = Number(mangaId);
            const resolvedChapterIndex = Number(chapterIndex);
            const resolvedChapterId = Number(variables?.input?.chapterId ?? chapterId ?? -1);
            const response = await this.restClient.fetcher(
                `/api/v1/manga/${resolvedMangaId}/chapter/${resolvedChapterIndex}/pages`,
                { config: { signal } },
            );
            const payload = await response.json();
            const pages = payload?.pages ?? [];
            return {
                fetchChapterPages: {
                    pages,
                    chapter: {
                        id: resolvedChapterId,
                        pageCount: pages.length,
                    },
                },
            } as GetChapterPagesFetchMutation;
        });
    }

    public deleteDownloadedChapter(
        id: number,
        options?: MutationOptions<DeleteDownloadedChapterMutation, DeleteDownloadedChapterMutationVariables>,
    ): AbortableApolloMutationResponse<DeleteDownloadedChapterMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/chapters/update', {
                httpMethod: HttpMethod.POST,
                data: { ids: [id], isDownloaded: false },
                config: { signal },
            });
            return {
                deleteDownloadedChapter: {
                    chapters: {
                        id,
                        isDownloaded: false,
                        manga: { id: 0, downloadCount: 0 },
                    },
                },
            } as DeleteDownloadedChapterMutation;
        });
    }

    public deleteDownloadedChapters(
        ids: number[],
        options?: MutationOptions<DeleteDownloadedChaptersMutation, DeleteDownloadedChaptersMutationVariables>,
    ): AbortableApolloMutationResponse<DeleteDownloadedChaptersMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/chapters/update', {
                httpMethod: HttpMethod.POST,
                data: { ids, isDownloaded: false },
                config: { signal },
            });
            return {
                deleteDownloadedChapters: {
                    chapters: ids.map((id) => ({ id, isDownloaded: false, manga: { id: 0, downloadCount: 0 } })),
                },
            } as DeleteDownloadedChaptersMutation;
        });
    }

    public updateChapter(
        id: number,
        patch: UpdateChapterPatchInput & {
            chapterIdToDelete?: number;
            trackProgressMangaId?: number;
            isDownloaded?: boolean;
        },
        options?: MutationOptions<UpdateChapterMutation, UpdateChapterMutationVariables>,
    ): AbortableApolloMutationResponse<UpdateChapterMutation> {
        const { chapterIdToDelete = -1, trackProgressMangaId = -1, ...updatePatch } = patch;
        const trackProgressMangaIdPayload = trackProgressMangaId !== -1 ? trackProgressMangaId : undefined;
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/chapters/update', {
                httpMethod: HttpMethod.POST,
                data: {
                    ids: [id],
                    isRead: updatePatch.isRead ?? undefined,
                    isBookmarked: updatePatch.isBookmarked ?? undefined,
                    lastPageRead: updatePatch.lastPageRead ?? undefined,
                    isDownloaded: updatePatch.isDownloaded ?? undefined,
                    trackProgressMangaId: trackProgressMangaIdPayload,
                },
                config: { signal },
            });
            if (chapterIdToDelete !== -1) {
                await this.restClient.fetcher('/api/v1/chapters/update', {
                    httpMethod: HttpMethod.POST,
                    data: { ids: [chapterIdToDelete], isDownloaded: false },
                    config: { signal },
                });
            }
            return {
                updateChapter: {
                    chapter: {
                        id,
                        isBookmarked: updatePatch.isBookmarked ?? false,
                        isRead: updatePatch.isRead ?? false,
                        lastPageRead: updatePatch.lastPageRead ?? 0,
                    },
                },
            } as UpdateChapterMutation;
        });
    }

    public setChapterMeta(
        chapterId: number,
        key: string,
        value: any,
        options?: MutationOptions<SetChapterMetadataMutation, SetChapterMetadataMutationVariables>,
    ): AbortableApolloMutationResponse<SetChapterMetadataMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher(`/api/v1/meta/chapter/${chapterId}`, {
                httpMethod: HttpMethod.POST,
                data: { key, value: `${value}` },
                config: { signal },
            });
            return {
                setChapterMeta: {
                    meta: { chapterId, key, value: `${value}` },
                },
            } as SetChapterMetadataMutation;
        });
    }

    public deleteChapterMeta(
        chapterId: number,
        key: string,
        options?: MutationOptions<DeleteChapterMetadataMutation, DeleteChapterMetadataMutationVariables>,
    ): AbortableApolloMutationResponse<DeleteChapterMetadataMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher(`/api/v1/meta/chapter/${chapterId}`, {
                httpMethod: HttpMethod.DELETE,
                data: { key, value: null },
                config: { signal },
            });
            return {
                deleteChapterMeta: {
                    meta: { chapterId, key, value: '' },
                },
            } as DeleteChapterMetadataMutation;
        });
    }

    public getChapterPageUrl(mangaId: number | string, chapterIndex: number | string, page: number): string {
        return this.getValidImgUrlFor(
            `manga/${mangaId}/chapter/${chapterIndex}/page/${page}`,
            RequestManager.API_VERSION,
        );
    }

    public updateChapters(
        ids: number[],
        patch: UpdateChapterPatchInput & {
            chapterIdsToDelete?: number[];
            trackProgressMangaId?: MangaIdInfo['id'];
            isDownloaded?: boolean;
        },
        options?: MutationOptions<UpdateChaptersMutation, UpdateChaptersMutationVariables>,
    ): AbortableApolloMutationResponse<UpdateChaptersMutation> {
        const { chapterIdsToDelete = [], trackProgressMangaId = -1, ...updatePatch } = patch;
        const trackProgressMangaIdPayload = trackProgressMangaId !== -1 ? trackProgressMangaId : undefined;

        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/chapters/update', {
                httpMethod: HttpMethod.POST,
                data: {
                    ids,
                    isRead: updatePatch.isRead ?? undefined,
                    isBookmarked: updatePatch.isBookmarked ?? undefined,
                    lastPageRead: updatePatch.lastPageRead ?? undefined,
                    isDownloaded: updatePatch.isDownloaded ?? undefined,
                    trackProgressMangaId: trackProgressMangaIdPayload,
                },
                config: { signal },
            });
            if (chapterIdsToDelete.length) {
                await this.restClient.fetcher('/api/v1/chapters/update', {
                    httpMethod: HttpMethod.POST,
                    data: { ids: chapterIdsToDelete, isDownloaded: false },
                    config: { signal },
                });
            }
            return {
                updateChapters: {
                    chapters: ids.map((id) => ({
                        id,
                        isBookmarked: updatePatch.isBookmarked ?? false,
                        isRead: updatePatch.isRead ?? false,
                        lastPageRead: updatePatch.lastPageRead ?? 0,
                        manga: { id: 0, unreadCount: 0, bookmarkCount: 0 },
                    })),
                },
            } as UpdateChaptersMutation;
        });
    }

    public useGetCategoriesBase(
        options?: QueryHookOptions<GetCategoriesBaseQuery, GetCategoriesBaseQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetCategoriesBaseQuery, GetCategoriesBaseQueryVariables> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/categories', { config: { signal } });
                return (await response.json()) as GetCategoriesBaseQuery;
            },
            [skip],
            { ...options, skip },
        );
    }

    public useGetCategoriesLibrary(
        options?: QueryHookOptions<GetCategoriesLibraryQuery, GetCategoriesLibraryQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetCategoriesLibraryQuery, GetCategoriesLibraryQueryVariables> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/categories', { config: { signal } });
                return (await response.json()) as GetCategoriesLibraryQuery;
            },
            [skip],
            { ...options, skip },
        );
    }

    public useGetCategoriesSettings(
        options?: QueryHookOptions<GetCategoriesSettingsQuery, GetCategoriesSettingsQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetCategoriesSettingsQuery, GetCategoriesSettingsQueryVariables> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/categories', { config: { signal } });
                return (await response.json()) as GetCategoriesSettingsQuery;
            },
            [skip],
            { ...options, skip },
        );
    }

    public getCategoriesBase(
        options?: QueryOptions<GetCategoriesBaseQueryVariables, GetCategoriesBaseQuery>,
    ): AbortabaleApolloQueryResponse<GetCategoriesBaseQuery> {
        return this.doRestQuery(async (signal) => {
            const response = await this.restClient.fetcher('/api/v1/categories', { config: { signal } });
            return (await response.json()) as GetCategoriesBaseQuery;
        });
    }

    public createCategory(
        input: CreateCategoryInput,
        options?: MutationOptions<CreateCategoryMutation, CreateCategoryMutationVariables>,
    ): AbortableApolloMutationResponse<CreateCategoryMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/categories/create', {
                httpMethod: HttpMethod.POST,
                data: { name: input.name, default: input.default },
                config: { signal },
            });
            return {
                createCategory: {
                    category: {
                        id: 0,
                        name: input.name,
                    },
                },
            } as CreateCategoryMutation;
        });
    }

    public useReorderCategory(
        options?: MutationHookOptions<UpdateCategoryOrderMutation, UpdateCategoryOrderMutationVariables>,
    ): AbortableApolloUseMutationResponse<UpdateCategoryOrderMutation, UpdateCategoryOrderMutationVariables> {
        return this.useRestMutation(async (variables, signal) => {
            const input = variables?.input;
            if (!input) {
                throw new Error('useReorderCategory: no variables passed');
            }
            await this.restClient.fetcher('/api/v1/categories/order', {
                httpMethod: HttpMethod.POST,
                data: { id: input.id, position: input.position },
                config: { signal },
            });
            return {
                updateCategoryOrder: {
                    categories: [],
                },
            } as UpdateCategoryOrderMutation;
        });
    }

    public useGetCategoryMangas(
        id: number,
        options?: QueryHookOptions<GetMangasLibraryQuery, GetMangasLibraryQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetMangasLibraryQuery, GetMangasLibraryQueryVariables> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/categories/${id}/mangas`, {
                    config: { signal },
                });
                const payload = await response.json();
                const mangas = payload?.category?.mangas ?? payload?.mangas ?? payload;
                const nodes = Array.isArray(mangas?.nodes) ? mangas.nodes : [];
                return {
                    mangas: {
                        ...mangas,
                        nodes: nodes.map((manga: any) => this.normalizeMangaPayload(manga)),
                    },
                } as GetMangasLibraryQuery;
            },
            [id, skip],
            { ...options, skip },
        );
    }

    public deleteCategory(
        categoryId: number,
        options?: MutationOptions<DeleteCategoryMutation, DeleteCategoryMutationVariables>,
    ): AbortableApolloMutationResponse<DeleteCategoryMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/categories/delete', {
                httpMethod: HttpMethod.POST,
                data: { category_id: categoryId },
                config: { signal },
            });
            return {
                deleteCategory: {
                    category: {
                        id: categoryId,
                    },
                },
            } as DeleteCategoryMutation;
        });
    }

    public updateCategory(
        id: number,
        patch: UpdateCategoryPatchInput,
        options?: MutationOptions<UpdateCategoryMutation, UpdateCategoryMutationVariables>,
    ): AbortableApolloMutationResponse<UpdateCategoryMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/categories/update', {
                httpMethod: HttpMethod.POST,
                data: { id, patch },
                config: { signal },
            });
            return {
                updateCategory: {
                    category: {
                        id,
                    },
                },
            } as UpdateCategoryMutation;
        });
    }

    public setCategoryMeta(
        categoryId: number,
        key: string,
        value: any,
        options?: MutationOptions<SetCategoryMetadataMutation, SetCategoryMetadataMutationVariables>,
    ): AbortableApolloMutationResponse<SetCategoryMetadataMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/categories/meta', {
                httpMethod: HttpMethod.POST,
                data: { category_id: categoryId, key, value: `${value}` },
                config: { signal },
            });
            return {
                setCategoryMeta: {
                    meta: {
                        categoryId,
                        key,
                        value: `${value}`,
                    },
                },
            } as SetCategoryMetadataMutation;
        });
    }

    public deleteCategoryMeta(
        categoryId: number,
        key: string,
        options?: MutationOptions<DeleteCategoryMetadataMutation, DeleteCategoryMetadataMutationVariables>,
    ): AbortableApolloMutationResponse<DeleteCategoryMetadataMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/categories/meta', {
                httpMethod: HttpMethod.POST,
                data: { category_id: categoryId, key, value: null },
                config: { signal },
            });
            return {
                deleteCategoryMeta: {
                    meta: {
                        categoryId,
                        key,
                        value: '',
                    },
                },
            } as DeleteCategoryMetadataMutation;
        });
    }

    public createBackupFile(
        input: CreateBackupInput,
        options?: MutationOptions<CreateBackupMutation, CreateBackupMutationVariables>,
    ): AbortableApolloMutationResponse<CreateBackupMutation> {
        return this.doRestMutation(async (signal) => {
            const response = await this.restClient.fetcher('/api/v1/backup/create', {
                httpMethod: HttpMethod.POST,
                data: input,
                config: { signal },
            });
            const payload = await this.parseJsonSafe(response);
            const url = payload?.url ?? payload?.createBackup?.url ?? '';
            return {
                createBackup: {
                    url,
                },
            } as CreateBackupMutation;
        });
    }

    public restoreBackupFile(
        input: RestoreBackupInput,
        options?: MutationOptions<RestoreBackupMutation, RestoreBackupMutationVariables>,
    ): AbortableApolloMutationResponse<RestoreBackupMutation> {
        return this.doRestMutation(async (signal) => {
            const response = await this.restClient.fetcher('/api/v1/backup/restore', {
                httpMethod: HttpMethod.POST,
                data: { id: input.backup?.name ?? undefined, flags: input.flags ?? undefined },
                config: { signal },
            });
            const payload = await this.parseJsonSafe(response);
            return {
                restoreBackup: {
                    id: payload?.id ?? 'restore',
                    status: payload?.status ?? 'IDLE',
                },
            } as RestoreBackupMutation;
        });
    }

    public validateBackupFile(
        file: File,
        options?: QueryOptions<ValidateBackupQueryVariables, ValidateBackupQuery>,
    ): AbortabaleApolloQueryResponse<ValidateBackupQuery> {
        return this.doRestQuery(async (signal) => {
            await this.restClient.fetcher('/api/v1/backup/validate', {
                httpMethod: HttpMethod.POST,
                data: { name: file.name },
                config: { signal },
            });
            return {
                validateBackup: {
                    missingSources: [],
                    missingTrackers: [],
                },
            } as ValidateBackupQuery;
        });
    }

    public useGetBackupRestoreStatus(
        id: string,
        options?: QueryHookOptions<GetRestoreStatusQuery, GetRestoreStatusQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetRestoreStatusQuery, GetRestoreStatusQueryVariables> {
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher(`/api/v1/backup/restore/${id}`, {
                    config: { signal },
                });
                const payload = await this.parseJsonSafe(response);
                return {
                    restoreStatus: {
                        mangaProgress: 0,
                        totalManga: 0,
                        state: payload?.status ?? 'IDLE',
                    },
                } as GetRestoreStatusQuery;
            },
            [id, options?.skip],
            options,
        );
    }

    public startDownloads(
        options?: MutationOptions<StartDownloaderMutation, StartDownloaderMutationVariables>,
    ): AbortableApolloMutationResponse<StartDownloaderMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/downloads/start', {
                httpMethod: HttpMethod.POST,
                config: { signal },
            });
            return {
                startDownloader: {
                    downloadStatus: { state: 'STOPPED', queue: [] },
                },
            } as StartDownloaderMutation;
        });
    }

    public stopDownloads(
        options?: MutationOptions<StopDownloaderMutation, StopDownloaderMutationVariables>,
    ): AbortableApolloMutationResponse<StopDownloaderMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/downloads/stop', {
                httpMethod: HttpMethod.POST,
                config: { signal },
            });
            return {
                stopDownloader: {
                    downloadStatus: { state: 'STOPPED', queue: [] },
                },
            } as StopDownloaderMutation;
        });
    }

    public clearDownloads(
        options?: MutationOptions<ClearDownloaderMutation, ClearDownloaderMutationVariables>,
    ): AbortableApolloMutationResponse<ClearDownloaderMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/downloads/clear', {
                httpMethod: HttpMethod.POST,
                config: { signal },
            });
            return {
                clearDownloader: {
                    downloadStatus: { state: 'STOPPED', queue: [] },
                },
            } as ClearDownloaderMutation;
        });
    }

    public addChapterToDownloadQueue(
        id: number,
        options?: MutationOptions<EnqueueChapterDownloadMutation, EnqueueChapterDownloadMutationVariables>,
    ): AbortableApolloMutationResponse<EnqueueChapterDownloadMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/downloads/enqueue', {
                httpMethod: HttpMethod.POST,
                data: { id },
                config: { signal },
            });
            return {
                enqueueChapterDownload: {
                    downloadStatus: { state: 'STOPPED', queue: [] },
                },
            } as EnqueueChapterDownloadMutation;
        });
    }

    public removeChapterFromDownloadQueue(
        id: number,
        options?: MutationOptions<DequeueChapterDownloadMutation, DequeueChapterDownloadMutationVariables>,
    ): AbortableApolloMutationResponse<DequeueChapterDownloadMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/downloads/dequeue', {
                httpMethod: HttpMethod.POST,
                data: { id },
                config: { signal },
            });
            return {
                dequeueChapterDownload: {
                    downloadStatus: { state: 'STOPPED', queue: [] },
                },
            } as DequeueChapterDownloadMutation;
        });
    }

    public useReorderChapterInDownloadQueue(
        options?: MutationHookOptions<ReorderChapterDownloadMutation, ReorderChapterDownloadMutationVariables>,
    ): AbortableApolloUseMutationResponse<ReorderChapterDownloadMutation, ReorderChapterDownloadMutationVariables> {
        return this.useRestMutation(async (variables, signal) => {
            const input = variables?.input;
            if (!input) {
                throw new Error('useReorderChapterInDownloadQueue: no variables passed');
            }
            await this.restClient.fetcher('/api/v1/downloads/reorder', {
                httpMethod: HttpMethod.POST,
                data: { chapter_id: input.chapterId, to: input.to },
                config: { signal },
            });
            return {
                reorderChapterDownload: {
                    downloadStatus: { state: 'STOPPED', queue: [] },
                },
            } as ReorderChapterDownloadMutation;
        });
    }

    public addChaptersToDownloadQueue(
        ids: number[],
        options?: MutationOptions<EnqueueChapterDownloadsMutation, EnqueueChapterDownloadsMutationVariables>,
    ): AbortableApolloMutationResponse<EnqueueChapterDownloadsMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/downloads/enqueue-many', {
                httpMethod: HttpMethod.POST,
                data: { ids },
                config: { signal },
            });
            return {
                enqueueChapterDownloads: {
                    downloadStatus: { state: 'STOPPED', queue: [] },
                },
            } as EnqueueChapterDownloadsMutation;
        });
    }

    public removeChaptersFromDownloadQueue(
        ids: number[],
        options?: MutationOptions<DequeueChapterDownloadsMutation, DequeueChapterDownloadsMutationVariables>,
    ): AbortableApolloMutationResponse<DequeueChapterDownloadsMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/downloads/dequeue-many', {
                httpMethod: HttpMethod.POST,
                data: { ids },
                config: { signal },
            });
            return {
                dequeueChapterDownloads: {
                    downloadStatus: { state: 'STOPPED', queue: [] },
                },
            } as DequeueChapterDownloadsMutation;
        });
    }

    public useGetRecentlyUpdatedChapters(
        initialPages: number = 1,
        options?: QueryHookOptions<GetChaptersUpdatesQuery, GetChaptersUpdatesQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetChaptersUpdatesQuery, GetChaptersUpdatesQueryVariables> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/chapters/updates', { config: { signal } });
                return (await response.json()) as GetChaptersUpdatesQuery;
            },
            [initialPages, skip],
            { ...options, skip },
        );
    }

    public useGetRecentlyReadChapters(
        initialPages: number = 1,
        options?: QueryHookOptions<GetChaptersHistoryQuery, GetChaptersHistoryQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetChaptersHistoryQuery, GetChaptersHistoryQueryVariables> {
        const skip = options?.skip ?? false;
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/chapters/history', { config: { signal } });
                return (await response.json()) as GetChaptersHistoryQuery;
            },
            [initialPages, skip],
            { ...options, skip },
        );
    }

    public startGlobalUpdate(
        categories?: number[],
        options?: MutationOptions<UpdateLibraryMutation, UpdateLibraryMutationVariables>,
    ): AbortableApolloMutationResponse<UpdateLibraryMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/updates/start', {
                httpMethod: HttpMethod.POST,
                data: { categories },
                config: { signal },
            });
            return {
                updateLibrary: {
                    updateStatus: {
                        jobsInfo: {
                            isRunning: false,
                            totalJobs: 0,
                            finishedJobs: 0,
                            skippedCategoriesCount: 0,
                            skippedMangasCount: 0,
                        },
                        categoryUpdates: [],
                        mangaUpdates: [],
                    },
                },
            } as UpdateLibraryMutation;
        });
    }

    public resetGlobalUpdate(
        options?: MutationOptions<StopUpdaterMutation, StopUpdaterMutationVariables>,
    ): AbortableApolloMutationResponse<StopUpdaterMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/updates/stop', {
                httpMethod: HttpMethod.POST,
                config: { signal },
            });
            return {
                updateStop: {
                    clientMutationId: null,
                },
            } as StopUpdaterMutation;
        });
    }

    public useGetGlobalUpdateSummary(
        options?: QueryHookOptions<GetUpdateStatusQuery, GetUpdateStatusQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetUpdateStatusQuery, GetUpdateStatusQueryVariables> {
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/updates/status', { config: { signal } });
                return (await response.json()) as GetUpdateStatusQuery;
            },
            [options?.skip],
            options,
        );
    }

    public getDownloadStatus(
        options?: QueryOptions<GetDownloadStatusQueryVariables, GetDownloadStatusQuery>,
    ): AbortabaleApolloQueryResponse<GetDownloadStatusQuery> {
        return this.doRestQuery(async (signal) => {
            const response = await this.restClient.fetcher('/api/v1/downloads/status', { config: { signal } });
            const payload = await response.json();
            const downloadStatus = payload?.downloadStatus ?? payload?.download_status ?? payload;
            const normalized = { downloadStatus } as GetDownloadStatusQuery;
            setDownloadStatusSnapshot(normalized.downloadStatus);
            return normalized;
        });
    }

    public useGetDownloadStatus(
        options?: QueryHookOptions<GetDownloadStatusQuery, GetDownloadStatusQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetDownloadStatusQuery, GetDownloadStatusQueryVariables> {
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/downloads/status', { config: { signal } });
                const payload = await response.json();
                const downloadStatus = payload?.downloadStatus ?? payload?.download_status ?? payload;
                const normalized = { downloadStatus } as GetDownloadStatusQuery;
                setDownloadStatusSnapshot(normalized.downloadStatus);
                return normalized;
            },
            [options?.skip],
            options,
        );
    }

    public useDownloadSubscription(
        options?: SubscriptionHookOptions<DownloadStatusSubscription, DownloadStatusSubscriptionVariables>,
    ): SubscriptionResult<DownloadStatusSubscription, DownloadStatusSubscriptionVariables> {
        const skip = options?.skip ?? false;
        const [data, setData] = useState<DownloadStatusSubscription | undefined>(undefined);
        const [error, setError] = useState<RequestError | undefined>(undefined);
        const [loading, setLoading] = useState(!skip);

        useEffect(() => {
            if (skip) {
                console.info('[downloads] subscription skipped');
                setLoading(false);
                return undefined;
            }

            const baseUrl = this.getValidUrlFor('downloads/stream');
            const wsUrl = baseUrl.replace(/^http/, 'ws');
            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.info('[downloads] subscription opened');
                setLoading(false);
            };

            socket.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data) as DownloadStatusSubscription;
                    setData(payload);
                    const changed = (payload as any).downloadStatusChanged;
                    if (changed?.omittedUpdates) {
                        this.getDownloadStatus().response.catch(() => undefined);
                    } else {
                        applyDownloadStatusUpdate(changed);
                    }
                } catch (caught: any) {
                    setError(new RequestError(caught?.message ?? 'Download subscription error', caught));
                }
            };

            socket.onerror = () => {
                console.warn('[downloads] subscription error');
                setError(new RequestError('Download subscription error'));
            };

            socket.onclose = (event) => {
                console.info('[downloads] subscription closed', {
                    code: event.code,
                    reason: event.reason,
                });
            };

            return () => {
                socket.close();
            };
        }, [skip, this.getBaseUrl()]);

        return {
            data,
            error,
            loading,
        } as SubscriptionResult<DownloadStatusSubscription, DownloadStatusSubscriptionVariables>;
    }

    public useUpdaterSubscription(
        options?: SubscriptionHookOptions<UpdaterSubscription, UpdaterSubscriptionVariables>,
    ): SubscriptionResult<UpdaterSubscription, UpdaterSubscriptionVariables> {
        const skip = options?.skip ?? false;
        const [data, setData] = useState<UpdaterSubscription | undefined>(undefined);
        const [error, setError] = useState<RequestError | undefined>(undefined);
        const [loading, setLoading] = useState(!skip);

        useEffect(() => {
            if (skip) {
                console.info('[updates] subscription skipped');
                setLoading(false);
                return undefined;
            }

            const baseUrl = this.getValidUrlFor('updates/stream');
            const wsUrl = baseUrl.replace(/^http/, 'ws');
            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.info('[updates] subscription opened');
                setLoading(false);
            };

            socket.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data) as UpdaterSubscription;
                    setData(payload);
                } catch (caught: any) {
                    setError(new RequestError(caught?.message ?? 'Update subscription error', caught));
                }
            };

            socket.onerror = () => {
                console.warn('[updates] subscription error');
                setError(new RequestError('Update subscription error'));
            };

            socket.onclose = (event) => {
                console.info('[updates] subscription closed', {
                    code: event.code,
                    reason: event.reason,
                });
            };

            return () => {
                socket.close();
            };
        }, [skip, this.getBaseUrl()]);

        return {
            data,
            error,
            loading,
        } as SubscriptionResult<UpdaterSubscription, UpdaterSubscriptionVariables>;
    }

    public useServerSettingsSubscription(
        options?: SubscriptionHookOptions<GetServerSettingsQuery, GetServerSettingsQueryVariables>,
    ): SubscriptionResult<GetServerSettingsQuery, GetServerSettingsQueryVariables> {
        const skip = options?.skip ?? false;
        const [data, setData] = useState<GetServerSettingsQuery | undefined>(undefined);
        const [error, setError] = useState<RequestError | undefined>(undefined);
        const [loading, setLoading] = useState(!skip);

        useEffect(() => {
            if (skip) {
                console.info('[settings] subscription skipped');
                setLoading(false);
                return undefined;
            }

            const baseUrl = this.getValidUrlFor('settings/stream');
            const wsUrl = baseUrl.replace(/^http/, 'ws');
            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.info('[settings] subscription opened');
                setLoading(false);
            };

            socket.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data) as GetServerSettingsQuery;
                    setData(payload);
                    this.setServerSettingsSnapshot(payload);
                } catch (caught: any) {
                    setError(new RequestError(caught?.message ?? 'Settings subscription error', caught));
                }
            };

            socket.onerror = () => {
                console.warn('[settings] subscription error');
                setError(new RequestError('Settings subscription error'));
            };

            socket.onclose = (event) => {
                console.info('[settings] subscription closed', {
                    code: event.code,
                    reason: event.reason,
                });
            };

            return () => {
                socket.close();
            };
        }, [skip, this.getBaseUrl()]);

        return {
            data,
            error,
            loading,
        } as SubscriptionResult<GetServerSettingsQuery, GetServerSettingsQueryVariables>;
    }

    public useGlobalMetaSubscription(
        options?: SubscriptionHookOptions<GetGlobalMetadatasQuery, GetGlobalMetadatasQueryVariables>,
    ): SubscriptionResult<GetGlobalMetadatasQuery, GetGlobalMetadatasQueryVariables> {
        const skip = options?.skip ?? false;
        const [data, setData] = useState<GetGlobalMetadatasQuery | undefined>(undefined);
        const [error, setError] = useState<RequestError | undefined>(undefined);
        const [loading, setLoading] = useState(!skip);

        useEffect(() => {
            if (skip) {
                console.info('[meta] subscription skipped');
                setLoading(false);
                return undefined;
            }

            const baseUrl = this.getValidUrlFor('meta/global/stream');
            const wsUrl = baseUrl.replace(/^http/, 'ws');
            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.info('[meta] subscription opened');
                setLoading(false);
            };

            socket.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data) as GetGlobalMetadatasQuery;
                    setData(payload);
                    this.setGlobalMetaSnapshot(payload);
                } catch (caught: any) {
                    setError(new RequestError(caught?.message ?? 'Meta subscription error', caught));
                }
            };

            socket.onerror = () => {
                console.warn('[meta] subscription error');
                setError(new RequestError('Meta subscription error'));
            };

            socket.onclose = (event) => {
                console.info('[meta] subscription closed', {
                    code: event.code,
                    reason: event.reason,
                });
            };

            return () => {
                socket.close();
            };
        }, [skip, this.getBaseUrl()]);

        return {
            data,
            error,
            loading,
        } as SubscriptionResult<GetGlobalMetadatasQuery, GetGlobalMetadatasQueryVariables>;
    }

    public useGetServerSettings(
        options?: QueryHookOptions<GetServerSettingsQuery, GetServerSettingsQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetServerSettingsQuery, GetServerSettingsQueryVariables> {
        const [snapshot, setSnapshot] = useState(this.serverSettingsSnapshot);

        const handleCompleted = useCallback(
            (result: GetServerSettingsQuery) => {
                this.setServerSettingsSnapshot(result);
                options?.onCompleted?.(result);
            },
            [options?.onCompleted],
        );

        useEffect(() => this.subscribeServerSettings(setSnapshot), []);

        const request = this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/settings', { config: { signal } });
                return (await response.json()) as GetServerSettingsQuery;
            },
            [options?.skip],
            {
                ...options,
                onCompleted: handleCompleted,
            },
        );

        return {
            ...request,
            data: (snapshot ?? request.data) as MaybeMasked<GetServerSettingsQuery>,
        } as AbortableApolloUseQueryResponse<GetServerSettingsQuery, GetServerSettingsQueryVariables>;
    }

    public useUpdateServerSettings(
        options?: MutationHookOptions<UpdateServerSettingsMutation, UpdateServerSettingsMutationVariables>,
    ): AbortableApolloUseMutationResponse<UpdateServerSettingsMutation, UpdateServerSettingsMutationVariables> {
        const [mutate, result] = this.useRestMutation<
            UpdateServerSettingsMutation,
            UpdateServerSettingsMutationVariables
        >(async (variables, signal) => {
            const settings = variables?.input?.settings ?? {};
            const response = await this.restClient.fetcher('/api/v1/settings', {
                httpMethod: HttpMethod.POST,
                data: { settings },
                config: { signal },
            });
            const payload = await response.json();
            const nextSnapshot = (payload?.settings ? payload : { settings }) as GetServerSettingsQuery;
            const nextSettings = (nextSnapshot as any)?.settings ?? settings;
            this.setServerSettingsSnapshot(nextSnapshot);
            return {
                setSettings: {
                    settings: nextSettings,
                },
            } as UpdateServerSettingsMutation;
        });

        return [mutate, result];
    }

    public useGetLastGlobalUpdateTimestamp(
        options?: QueryHookOptions<GetLastUpdateTimestampQuery, GetLastUpdateTimestampQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetLastUpdateTimestampQuery, GetLastUpdateTimestampQueryVariables> {
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/updates/last-timestamp', {
                    config: { signal },
                });
                return (await response.json()) as GetLastUpdateTimestampQuery;
            },
            [options?.skip],
            options,
        );
    }

    public useClearServerCache(
        input: ClearCachedImagesInput = { cachedPages: true, cachedThumbnails: true },
        options?: MutationHookOptions<ClearServerCacheMutation, ClearServerCacheMutationVariables>,
    ): AbortableApolloUseMutationResponse<ClearServerCacheMutation, ClearServerCacheMutationVariables> {
        return this.useRestMutation(async (_variables, signal) => {
            await this.restClient.fetcher('/api/v1/cache/clear', {
                httpMethod: HttpMethod.POST,
                data: input,
                config: { signal },
            });
            return { clearCachedImages: { ok: true } } as ClearServerCacheMutation;
        });
    }

    public useGetMigratableSources(
        options?: QueryHookOptions<GetMigratableSourcesQuery, GetMigratableSourcesQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetMigratableSourcesQuery, GetMigratableSourcesQueryVariables> {
        return this.useRestQuery(
            async (signal) => {
                const mangasResponse = await this.restClient.fetcher('/api/v1/manga/library/search?inLibrary=true', {
                    config: { signal },
                });
                const mangasPayload = await mangasResponse.json();
                const rawMangas = Array.isArray(mangasPayload?.mangas?.nodes) ? mangasPayload.mangas.nodes : [];
                const mangas = rawMangas.map((manga: any) => this.normalizeMangaPayload(manga));

                const sourceMap = new Map<string, any>();
                try {
                    const sourceListResponse = await this.restClient.fetcher('/api/v1/source/list', { config: { signal } });
                    const sourceListPayload = await sourceListResponse.json();
                    const rawSources = Array.isArray(sourceListPayload)
                        ? sourceListPayload
                        : sourceListPayload?.sources ?? sourceListPayload?.nodes ?? [];
                    (Array.isArray(rawSources) ? rawSources : [])
                        .filter((source: any) => source && source.id != null)
                        .forEach((source: any) => {
                            const normalized = this.normalizeSourcePayload(source);
                            sourceMap.set(String(normalized?.id ?? source.id), normalized);
                        });
                } catch {
                    // Fallback is handled per-item below using sourceId only.
                }

                const nodes = mangas.map((manga: any) => {
                    const sourceId = String(manga?.sourceId ?? manga?.source_id ?? '');
                    const source =
                        sourceMap.get(sourceId) ?? {
                            id: sourceId,
                            name: sourceId,
                            displayName: sourceId,
                            lang: 'unknown',
                            iconUrl: '',
                            extension: { pkgName: '', repo: '' },
                            filters: [],
                            preferences: [],
                            meta: [],
                        };

                    return {
                        sourceId,
                        source,
                    };
                });

                return {
                    mangas: {
                        nodes,
                    },
                } as GetMigratableSourcesQuery;
            },
            [options?.skip],
            options,
        );
    }

    public useGetTrackersSettings(
        options?: QueryHookOptions<GetTrackersSettingsQuery, GetTrackersSettingsQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetTrackersSettingsQuery, GetTrackersSettingsQueryVariables> {
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/track/list', { config: { signal } });
                const payload = await response.json();
                const nodes = Array.isArray(payload) ? payload : payload?.trackers?.nodes ?? [];
                const normalizedNodes = nodes.map((tracker: any) => this.normalizeTrackerPayload(tracker));
                return {
                    trackers: {
                        nodes: normalizedNodes,
                        pageInfo: this.buildPageInfo(),
                        totalCount: normalizedNodes.length,
                    },
                } as GetTrackersSettingsQuery;
            },
            [options?.skip],
            options,
        );
    }

    public useGetTrackersBind(
        options?: QueryHookOptions<GetTrackersBindQuery, GetTrackersBindQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetTrackersBindQuery, GetTrackersBindQueryVariables> {
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/track/list', { config: { signal } });
                const payload = await response.json();
                const nodes = Array.isArray(payload) ? payload : payload?.trackers?.nodes ?? [];
                const normalizedNodes = nodes.map((tracker: any) => this.normalizeTrackerPayload(tracker));
                return {
                    trackers: {
                        nodes: normalizedNodes,
                        pageInfo: this.buildPageInfo(),
                        totalCount: normalizedNodes.length,
                    },
                } as GetTrackersBindQuery;
            },
            [options?.skip],
            options,
        );
    }

    public logoutFromTracker(
        trackerId: TrackerLogoutMutationVariables['trackerId'],
        options?: MutationOptions<TrackerLogoutMutation, TrackerLogoutMutationVariables>,
    ): AbortableApolloMutationResponse<TrackerLogoutMutation> {
        return this.doRestMutation(async (signal) => {
            const response = await this.restClient.fetcher('/api/v1/track/logout', {
                httpMethod: HttpMethod.POST,
                data: { tracker_id: trackerId },
                config: { signal },
            });
            const payload = await this.parseJsonSafe(response);
            const trackerPayload =
                payload?.tracker ??
                payload?.logoutTracker?.tracker ??
                payload?.logout_tracker?.tracker ??
                payload;
            const tracker = this.normalizeTrackerPayload(
                trackerPayload ?? {
                    id: trackerId,
                    name: '',
                    icon: '',
                    isLoggedIn: false,
                    isTokenExpired: false,
                    authUrl: '',
                },
            );
            return { logoutTracker: { tracker } } as TrackerLogoutMutation;
        });
    }

    public loginToTrackerOauth(
        trackerId: number,
        callbackUrl: string,
        options?: MutationOptions<TrackerLoginOauthMutation, TrackerLoginOauthMutationVariables>,
    ): AbortableApolloMutationResponse<TrackerLoginOauthMutation> {
        return this.doRestMutation(async (signal) => {
            const response = await this.restClient.fetcher('/api/v1/track/login', {
                httpMethod: HttpMethod.POST,
                data: { tracker_id: trackerId, callback_url: callbackUrl },
                config: { signal },
            });
            const payload = await this.parseJsonSafe(response);
            const trackerPayload =
                payload?.tracker ??
                payload?.loginTrackerOAuth?.tracker ??
                payload?.login_tracker_oauth?.tracker ??
                payload;
            const tracker = this.normalizeTrackerPayload(
                trackerPayload ?? {
                    id: trackerId,
                    name: '',
                    icon: '',
                    isLoggedIn: true,
                    isTokenExpired: false,
                    authUrl: '',
                },
            );
            const isLoggedIn = payload?.isLoggedIn ?? payload?.is_logged_in ?? tracker.isLoggedIn ?? true;
            return { loginTrackerOAuth: { isLoggedIn, tracker } } as TrackerLoginOauthMutation;
        });
    }

    public loginTrackerCredentials(
        trackerId: number,
        username: string,
        password: string,
        options?: MutationOptions<TrackerLoginCredentialsMutation, TrackerLoginCredentialsMutationVariables>,
    ): AbortableApolloMutationResponse<TrackerLoginCredentialsMutation> {
        return this.doRestMutation(async (signal) => {
            const response = await this.restClient.fetcher('/api/v1/track/login', {
                httpMethod: HttpMethod.POST,
                data: { tracker_id: trackerId, username, password },
                config: { signal },
            });
            const payload = await this.parseJsonSafe(response);
            const trackerPayload =
                payload?.tracker ??
                payload?.loginTrackerCredentials?.tracker ??
                payload?.login_tracker_credentials?.tracker ??
                payload;
            const tracker = this.normalizeTrackerPayload(
                trackerPayload ?? {
                    id: trackerId,
                    name: '',
                    icon: '',
                    isLoggedIn: true,
                    isTokenExpired: false,
                    authUrl: '',
                },
            );
            const isLoggedIn = payload?.isLoggedIn ?? payload?.is_logged_in ?? tracker.isLoggedIn ?? true;
            return { loginTrackerCredentials: { isLoggedIn, tracker } } as TrackerLoginCredentialsMutation;
        });
    }

    public useTrackerSearch(
        trackerId: number,
        query: string,
        options?: QueryHookOptions<TrackerSearchQuery, TrackerSearchQueryVariables>,
    ): AbortableApolloUseQueryResponse<TrackerSearchQuery, TrackerSearchQueryVariables> {
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/track/search', {
                    httpMethod: HttpMethod.POST,
                    data: { tracker_id: trackerId, query },
                    config: { signal },
                });
                const payload = await response.json();
                const nodes = payload?.trackSearch?.nodes ?? payload?.trackSearches ?? payload?.nodes ?? payload ?? [];
                const normalizedNodes = Array.isArray(nodes)
                    ? nodes.map((item: any) => this.normalizeTrackerSearchPayload(item))
                    : [];
                return {
                    searchTracker: {
                        trackSearches: normalizedNodes,
                    },
                } as TrackerSearchQuery;
            },
            [trackerId, query, options?.skip],
            options,
        );
    }

    public useBindTracker(
        options?: MutationHookOptions<TrackerBindMutation, TrackerBindMutationVariables>,
    ): AbortableApolloUseMutationResponse<TrackerBindMutation, TrackerBindMutationVariables> {
        return this.useRestMutation(async (variables, signal) => {
            const input = variables?.input;
            if (!input) {
                throw new Error('useBindTracker: no variables passed');
            }
            const recordId = Number(input.remoteId);
            const response = await this.restClient.fetcher('/api/v1/track/bind', {
                httpMethod: HttpMethod.POST,
                data: {
                    tracker_id: input.trackerId,
                    manga_id: input.mangaId,
                    record_id: Number.isNaN(recordId) ? null : recordId,
                    remote_id: input.remoteId,
                    private: !!input.private,
                },
                config: { signal },
            });
            const payload = await this.parseJsonSafe(response);
            const trackRecordPayload =
                payload?.trackRecord ??
                payload?.track_record ??
                payload?.bindTrack?.trackRecord ??
                payload?.bind_track?.track_record ??
                payload;
            const trackRecord = this.normalizeTrackRecordPayload(trackRecordPayload, {
                mangaId: input.mangaId,
                trackerId: input.trackerId,
                remoteId: input.remoteId,
            });
            return { bindTrack: { trackRecord } } as TrackerBindMutation;
        });
    }

    public bindTracker(
        mangaId: number,
        trackerId: number,
        remoteId: string,
        asPrivate: boolean,
        options?: MutationOptions<TrackerBindMutation, TrackerBindMutationVariables>,
    ): AbortableApolloMutationResponse<TrackerBindMutation> {
        return this.doRestMutation(async (signal) => {
            const recordId = Number(remoteId);
            const response = await this.restClient.fetcher('/api/v1/track/bind', {
                httpMethod: HttpMethod.POST,
                data: {
                    tracker_id: trackerId,
                    manga_id: mangaId,
                    record_id: Number.isNaN(recordId) ? null : recordId,
                    remote_id: remoteId,
                    private: !!asPrivate,
                },
                config: { signal },
            });
            const payload = await this.parseJsonSafe(response);
            const trackRecordPayload =
                payload?.trackRecord ??
                payload?.track_record ??
                payload?.bindTrack?.trackRecord ??
                payload?.bind_track?.track_record ??
                payload;
            const trackRecord = this.normalizeTrackRecordPayload(trackRecordPayload, {
                mangaId,
                trackerId,
                remoteId,
            });
            return { bindTrack: { trackRecord } } as TrackerBindMutation;
        });
    }

    public unbindTracker(
        recordId: number,
        deleteRemoteTrack?: boolean,
        options?: MutationHookOptions<TrackerUnbindMutation, TrackerUnbindMutationVariables>,
    ): AbortableApolloMutationResponse<TrackerUnbindMutation> {
        return this.doRestMutation(async (signal) => {
            const response = await this.restClient.fetcher('/api/v1/track/unbind', {
                httpMethod: HttpMethod.POST,
                data: { tracker_id: 0, record_id: recordId, delete_remote: !!deleteRemoteTrack },
                config: { signal },
            });
            const payload = await this.parseJsonSafe(response);
            const trackRecordPayload =
                payload?.trackRecord ??
                payload?.track_record ??
                payload?.unbindTrack?.trackRecord ??
                payload?.unbind_track?.track_record ??
                payload;
            const trackRecord = this.normalizeTrackRecordPayload(trackRecordPayload ?? { id: recordId });
            return { unbindTrack: { trackRecord } } as TrackerUnbindMutation;
        });
    }

    public updateTrackerBind(
        id: number,
        patch: Omit<UpdateTrackInput, 'clientMutationId' | 'recordId'> & {
            trackerId?: number;
            totalChapters?: number;
            score?: number;
        },
        options?: MutationOptions<TrackerUpdateBindMutation, TrackerUpdateBindMutationVariables>,
    ): AbortableApolloMutationResponse<TrackerUpdateBindMutation> {
        return this.doRestMutation(async (signal) => {
            const response = await this.restClient.fetcher('/api/v1/track/update', {
                httpMethod: HttpMethod.POST,
                data: {
                    tracker_id: patch.trackerId ?? 0,
                    record_id: id,
                    status: patch.status ?? undefined,
                    score: patch.score ?? undefined,
                    last_chapter_read: patch.lastChapterRead ?? undefined,
                    total_chapters: patch.totalChapters ?? undefined,
                    start_date: patch.startDate ?? undefined,
                    finish_date: patch.finishDate ?? undefined,
                    private: patch.private ?? undefined,
                },
                config: { signal },
            });
            const payload = await this.parseJsonSafe(response);
            const trackRecordPayload =
                payload?.trackRecord ??
                payload?.track_record ??
                payload?.updateTrack?.trackRecord ??
                payload?.update_track?.track_record ??
                payload;
            const fallbackRecord = {
                id,
                trackerId: patch.trackerId ?? 0,
                status: patch.status ?? 0,
                lastChapterRead: patch.lastChapterRead ?? 0,
                totalChapters: patch.totalChapters ?? 0,
                score: patch.score ?? 0,
                startDate: patch.startDate ?? '',
                finishDate: patch.finishDate ?? '',
                private: patch.private ?? false,
            };
            const trackRecord = this.normalizeTrackRecordPayload(trackRecordPayload ?? fallbackRecord, {
                trackerId: patch.trackerId,
            });
            return { updateTrack: { trackRecord } } as TrackerUpdateBindMutation;
        });
    }

    public fetchTrackBind(
        recordId: number,
        options?: MutationOptions<TrackerFetchBindMutation, TrackerFetchBindMutationVariables>,
    ): AbortableApolloMutationResponse<TrackerFetchBindMutation> {
        return this.doRestMutation(async (signal) => {
            const response = await this.restClient.fetcher('/api/v1/track/update', {
                httpMethod: HttpMethod.POST,
                data: { tracker_id: 0, record_id: recordId },
                config: { signal },
            });
            const payload = await this.parseJsonSafe(response);
            const trackRecordPayload =
                payload?.trackRecord ??
                payload?.track_record ??
                payload?.fetchTrack?.trackRecord ??
                payload?.fetch_track?.track_record ??
                payload;
            const trackRecord = this.normalizeTrackRecordPayload(trackRecordPayload ?? { id: recordId });
            return { fetchTrack: { trackRecord } } as TrackerFetchBindMutation;
        });
    }

    public useLoginUser(
        options?: MutationHookOptions<UserLoginMutation, UserLoginMutationVariables>,
    ): AbortableApolloUseMutationResponse<UserLoginMutation, UserLoginMutationVariables> {
        return this.useRestMutation(async (variables, signal) => {
            const response = await this.restClient.fetcher('/api/v1/auth/login', {
                httpMethod: HttpMethod.POST,
                data: { username: variables?.username, password: variables?.password },
                config: { signal },
            });
            const payload = await this.parseJsonSafe(response);
            const token = payload?.token ?? '';
            return {
                login: {
                    accessToken: token,
                    refreshToken: token,
                },
            } as UserLoginMutation;
        });
    }

    public useKoSyncStatus(
        options?: QueryHookOptions<GetKoSyncStatusQuery, GetKoSyncStatusQueryVariables>,
    ): AbortableApolloUseQueryResponse<GetKoSyncStatusQuery, GetKoSyncStatusQueryVariables> {
        return this.useRestQuery(
            async (signal) => {
                const response = await this.restClient.fetcher('/api/v1/kosync/status', { config: { signal } });
                return (await response.json()) as GetKoSyncStatusQuery;
            },
            [options?.skip],
            options,
        );
    }

    public koSyncLogin(
        serverAddress: string,
        username: string,
        password: string,
        options?: MutationOptions<KoSyncLoginMutation, KoSyncLoginMutationVariables>,
    ): AbortableApolloMutationResponse<KoSyncLoginMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/kosync/login', {
                httpMethod: HttpMethod.POST,
                data: { server_address: serverAddress, username, password },
                config: { signal },
            });
            return {
                connectKoSyncAccount: {
                    message: null,
                    status: { isLoggedIn: true, serverAddress, username },
                },
            } as KoSyncLoginMutation;
        });
    }

    public koSyncLogout(
        options?: MutationOptions<KoSyncLogoutMutation, KoSyncLogoutMutationVariables>,
    ): AbortableApolloMutationResponse<KoSyncLogoutMutation> {
        return this.doRestMutation(async (signal) => {
            await this.restClient.fetcher('/api/v1/kosync/logout', {
                httpMethod: HttpMethod.POST,
                config: { signal },
            });
            return {
                logoutKoSyncAccount: {
                    status: { isLoggedIn: false, serverAddress: null, username: null },
                },
            } as KoSyncLogoutMutation;
        });
    }

    public refreshUser(
        refreshToken: string,
        options?: MutationOptions<UserRefreshMutation, UserRefreshMutationVariables>,
    ): AbortableApolloMutationResponse<UserRefreshMutation> {
        return this.doRestMutation(async (signal) => {
            const response = await this.restClient.fetcher('/api/v1/auth/refresh', {
                httpMethod: HttpMethod.POST,
                data: { refreshToken: refreshToken ?? undefined },
                config: { signal },
            });
            const payload = await this.parseJsonSafe(response);
            const token = payload?.token ?? '';
            return {
                refreshToken: {
                    accessToken: token,
                },
            } as UserRefreshMutation;
        });
    }
}

export const requestManager = new RequestManager();
