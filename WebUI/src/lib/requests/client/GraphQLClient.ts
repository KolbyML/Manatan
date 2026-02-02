/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { onError } from '@apollo/client/link/error';
import { setContext } from '@apollo/client/link/context';
import {
    ApolloClient,
    ApolloClientOptions,
    ApolloLink,
    from,
    fromPromise,
    InMemoryCache,
    NormalizedCacheObject,
    split,
    toPromise,
} from '@apollo/client';
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { Client, createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { TypePolicies } from '@apollo/client/cache';
import { removeTypenameFromVariables } from '@apollo/client/link/remove-typename';
import { d } from 'koration';
import { useId } from '@mantine/hooks';
import { useEffect } from 'react';
import { GraphQLFormattedError } from 'graphql';
import { BaseClient } from '@/lib/requests/client/BaseClient.ts';
import { StrictTypedTypePolicies } from '@/lib/graphql/generated/apollo-helpers.ts';
import { AuthManager } from '@/features/authentication/AuthManager.ts';
import { UserRefreshMutation } from '@/lib/graphql/generated/graphql.ts';
import { AbortableApolloMutationResponse } from '@/lib/requests/RequestManager.ts';

/* eslint-disable no-underscore-dangle */
const typePolicies: StrictTypedTypePolicies = {
    MangaType: {
        fields: {
            trackRecords: {
                merge(existing, incoming) {
                    const nodes = incoming.nodes ?? existing?.nodes;

                    return {
                        ...existing,
                        ...incoming,
                        totalCount: nodes?.length ?? existing?.totalCount ?? incoming.totalCount,
                        nodes,
                    };
                },
            },
        },
    },
    GlobalMetaType: { keyFields: ['key'] },
    MangaMetaType: { keyFields: ['mangaId', 'key'] },
    ChapterMetaType: { keyFields: ['chapterId', 'key'] },
    CategoryMetaType: { keyFields: ['categoryId', 'key'] },
    SourceMetaType: { keyFields: ['sourceId', 'key'] },
    ExtensionType: { keyFields: ['pkgName'] },
    AboutServerPayload: { keyFields: [] },
    AboutWebUI: { keyFields: [] },
    WebUIUpdateInfo: { keyFields: [] },
    WebUIUpdateCheck: { keyFields: [] },
    SettingsType: { keyFields: [] },
    DownloadStatus: {
        keyFields: [],
        fields: {
            queue: {
                merge(_existing, incoming) {
                    return incoming;
                },
            },
        },
    },
    DownloadType: { keyFields: ['chapter'] },
    CategoryUpdateType: { keyFields: ['category'] },
    MangaUpdateType: { keyFields: ['manga'] },
    UpdaterJobsInfoType: { keyFields: [] },
    WebUIUpdateStatus: { keyFields: [] },
    UpdateStatus: { keyFields: [] },
    KoSyncStatusPayload: { keyFields: [] },
    Query: {
        fields: {
            manga(_, { args, toReference }) {
                return toReference({
                    __typename: 'MangaType',
                    id: args?.id,
                });
            },
            category(_, { args, toReference }) {
                return toReference({
                    __typename: 'CategoryType',
                    id: args?.id,
                });
            },
            source(_, { args, toReference }) {
                return toReference({
                    __typename: 'SourceType',
                    id: args?.id,
                });
            },
            extension(_, { args, toReference }) {
                return toReference({
                    __typename: 'ExtensionType',
                    pkgName: args?.pkgName,
                });
            },
            meta(_, { args, toReference }) {
                return toReference({
                    __typename: 'GlobalMetaType',
                    key: args?.key,
                });
            },
            downloadStatus: {
                read(_, { toReference }) {
                    return toReference({
                        __typename: 'DownloadStatus',
                        key: {},
                    });
                },
                merge(_, incoming) {
                    return incoming;
                },
            },
            updateStatus(_, { toReference }) {
                return toReference({ __typename: 'UpdateStatus', key: {} });
            },
            chapters: {
                keyArgs: ['condition', 'filter', 'orderBy', 'orderByType', 'order'],
                merge(existing, incoming) {
                    if (existing == null) {
                        return incoming;
                    }

                    const isReFetch = !incoming.pageInfo.hasPreviousPage;
                    const hasLessItems = existing.nodes.length > incoming.nodes.length;

                    const useIncomingResponse = isReFetch && !hasLessItems;
                    if (useIncomingResponse) {
                        return incoming;
                    }

                    const replaceExistingItems = isReFetch && hasLessItems;
                    if (replaceExistingItems) {
                        const existingWithReplacedIncoming: typeof incoming = {
                            ...existing,
                            pageInfo: {
                                ...existing.pageInfo,
                                startCursor: incoming.pageInfo.startCursor,
                            },
                            nodes: [...incoming.nodes, ...existing.nodes.slice(incoming.nodes.length)],
                        };

                        return existingWithReplacedIncoming;
                    }

                    const existingWithAppendedIncoming: typeof incoming = {
                        ...existing,
                        pageInfo: {
                            ...existing.pageInfo,
                            endCursor: incoming.pageInfo.endCursor,
                            hasNextPage: incoming.pageInfo.hasNextPage,
                        },
                        nodes: [...existing.nodes, ...incoming.nodes],
                    };

                    return existingWithAppendedIncoming;
                },
            },
            settings: {
                merge(existing, incoming) {
                    return {
                        ...(existing ?? {}),
                        ...(incoming ?? {}),
                    };
                },
            },
        },
    },
};
/* eslint-enable no-underscore-dangle */

export class GraphQLClient extends BaseClient<
    ApolloClient<NormalizedCacheObject>,
    ApolloClientOptions<NormalizedCacheObject>,
    null
> {
    readonly fetcher = null;

    public client!: ApolloClient<NormalizedCacheObject>;

    private wsClient!: Client;

    private wsClientAliveCheckInterval: NodeJS.Timeout | undefined = undefined;

    private activeConnectionSubscriptions = new Map<string, () => void>();

    constructor(handleRefreshToken: (refreshToken: string) => AbortableApolloMutationResponse<UserRefreshMutation>) {
        super(handleRefreshToken);

        this.createClient();
    }

    public override getBaseUrl(): string {
        return `${super.getBaseUrl()}/api/graphql`;
    }

    override reset(): void {
        super.reset();

        this.client.clearStore();
        this.client.stop();

        this.resetWsClient(false);
        this.createClient();
    }

    private resetWsClient(recreateClient: boolean): void {
        this.wsClient.dispose();
        this.wsClient.terminate();

        if (!recreateClient) {
            return;
        }

        this.createWSClient(false);
        this.client.setLink(this.createLink());

        this.restartAllSubscriptions();
    }

    private restartAllSubscriptions(): void {
        this.activeConnectionSubscriptions.forEach((callback) => callback());
    }

    protected override shouldQueueRequest(operationName: string | undefined): boolean {
        const authOperations = ['GET_ABOUT', 'USER_LOGIN', 'USER_REFRESH'];
        if (authOperations.includes(operationName!)) {
            return false;
        }

        return super.shouldQueueRequest();
    }

    private createAuthGuardLink() {
        return new ApolloLink((operation, forward) => {
            const { operationName } = operation;

            if (this.shouldQueueRequest(operationName)) {
                return fromPromise(this.enqueueRequest(() => toPromise(forward(operation)), operationName));
            }

            return forward(operation);
        });
    }

    private isAuthError(errors: readonly GraphQLFormattedError[]): boolean {
        return errors.some((graphQLError) =>
            graphQLError.message.includes('suwayomi.tachidesk.server.user.UnauthorizedException'),
        );
    }

    private createErrorLink() {
        return onError(({ graphQLErrors, operation, forward }) => {
            if (!graphQLErrors) {
                return undefined;
            }
            if (!this.isAuthError(graphQLErrors)) {
                return undefined;
            }

            return fromPromise(BaseClient.refreshAccessToken(this.handleRefreshToken))
                .filter(Boolean)
                .map((result) => {
                    this.restartAllSubscriptions();

                    return result;
                })
                .flatMap(() => forward(operation));
        });
    }

    private createAuthLink() {
        return setContext((_, { headers }) => {
            const isAuthRequired = AuthManager.isAuthRequired();
            const accessToken = AuthManager.getAccessToken();

            return {
                credentials: 'include',
                headers: {
                    ...headers,
                    ...(isAuthRequired && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
            };
        });
    }

    private createUploadLink() {
        return createUploadLink({ uri: () => this.getBaseUrl() });
    }

    private createWSLink() {
        return new GraphQLWsLink(this.wsClient);
    }

    private createLink() {
        const removeTypenameLink = removeTypenameFromVariables();

        return split(
            ({ query }) => {
                const definition = getMainDefinition(query);
                return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
            },
            this.createWSLink(),
            from([
                this.createAuthGuardLink(),
                this.createErrorLink(),
                this.createAuthLink(),
                removeTypenameLink,
                // apollo-upload-client dependency is outdated (see 134e47763faae9e62db4d4e3a8387a74e32e5568) and thus types are not matching, but they are still correct
                this.createUploadLink() as unknown as ApolloLink,
            ]),
        );
    }

    private createWSClient(lazy: boolean = true): void {
        const heartbeatInterval = d(20).seconds.inWholeMilliseconds;

        this.wsClient = createClient({
            lazy,
            url: () => this.getBaseUrl().replace(/http(|s)/g, 'ws'),
            keepAlive: heartbeatInterval,
            retryAttempts: Number.MAX_SAFE_INTEGER,
            shouldRetry: () => true,
            retryWait: async (retries) => {
                const delay = Math.min(d(1).seconds.inWholeMilliseconds * 2 ** retries, heartbeatInterval);

                return new Promise((resolve) => {
                    setTimeout(resolve, delay);
                });
            },
            connectionParams: () => {
                const isAuthRequired = AuthManager.isAuthRequired();
                const accessToken = AuthManager.getAccessToken();

                return {
                    Authorization: isAuthRequired && accessToken ? accessToken : undefined,
                };
            },
        });

        let triedForcedReconnection = false;
        let lastHeartbeat: number = Date.now();
        this.wsClient.on('message', async (e) => {
            lastHeartbeat = Date.now();
            triedForcedReconnection = false;

            if (e.type !== 'error') {
                return;
            }

            if (!AuthManager.isRefreshingToken() && this.isAuthError(e.payload)) {
                try {
                    await BaseClient.refreshAccessToken(this.handleRefreshToken);
                    this.resetWsClient(true);
                } catch (_) {
                    // Ignore
                }
            }
        });

        const checkHeartbeatInterval = heartbeatInterval + d(30).seconds.inWholeMilliseconds;
        clearInterval(this.wsClientAliveCheckInterval);
        this.wsClientAliveCheckInterval = setInterval(() => {
            const isHeartbeatMissing = Date.now() - lastHeartbeat > checkHeartbeatInterval * 1.1;
            if (!isHeartbeatMissing) {
                return;
            }

            if (!triedForcedReconnection) {
                triedForcedReconnection = true;
                this.wsClient.terminate();

                return;
            }

            clearInterval(this.wsClientAliveCheckInterval);
            this.resetWsClient(true);
        }, checkHeartbeatInterval);
    }

    protected createClient(createWsClientLazily?: boolean) {
        this.createWSClient(createWsClientLazily);
        this.client = new ApolloClient({
            cache: new InMemoryCache({
                // for whatever reason there is some weird TypeError complaining that
                // "FieldReadFunction<Reference, Reference, FieldFunctionOptions<SomeObject, Record<string, any>>"
                // is not compatible with "FieldReadFunction<any, any, FieldFunctionOptions<Record<string, any, Record<string, any>>"
                // Since "typePolicies" is correctly typed as StrictTypedTypePolicies, and it is working as expected,
                // the TypeError can just be ignored
                typePolicies: typePolicies as TypePolicies,
            }),
            connectToDevTools: true,
            link: this.createLink(),
        });
    }

    public override updateConfig() {}

    public useRestartSubscription(restart: () => void) {
        const id = useId();

        this.activeConnectionSubscriptions.set(id, () => {
            restart();
        });

        useEffect(
            () => () => {
                this.activeConnectionSubscriptions.delete(id);
            },
            [id],
        );
    }
}
