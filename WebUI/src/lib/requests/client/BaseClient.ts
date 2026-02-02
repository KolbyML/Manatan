/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { AppStorage } from '@/lib/storage/AppStorage.ts';
import { UserRefreshMutation } from '@/lib/graphql/generated/graphql.ts';
import { AuthManager } from '@/features/authentication/AuthManager.ts';
import { AbortableApolloMutationResponse } from '@/lib/requests/RequestManager.ts';
import { SubpathUtil } from '@/lib/utils/SubpathUtil.ts';
import { ControlledPromise } from '@/lib/ControlledPromise.ts';

interface QueuedRequest {
    execute: () => void;
    resolve: (value: any) => void;
    reject: (error: any) => void;
}

export abstract class BaseClient<Client, ClientConfig, Fetcher> {
    static readonly BASE_URL_KEY = 'serverBaseURL';

    protected abstract client: Client;

    public abstract readonly fetcher: Fetcher;

    private static activeTokenRefreshPromise: Promise<UserRefreshMutation | null | undefined> | null = null;

    private static onTokenRefreshComplete: (() => void) | null = null;

    protected requestQueue: QueuedRequest[] = [];

    public reset(): void {
        BaseClient.activeTokenRefreshPromise = null;
        this.clearQueue(new Error('Client reset'));
    }

    public static setTokenRefreshCompleteCallback(callback: (() => void) | null): void {
        BaseClient.onTokenRefreshComplete = callback;
    }

    protected static async refreshAccessToken(
        refreshFn: (refreshToken: string) => AbortableApolloMutationResponse<UserRefreshMutation>,
    ): Promise<UserRefreshMutation | null | undefined> {
        const refreshToken = AuthManager.getRefreshToken();

        if (!AuthManager.isAuthInitialized()) {
            AuthManager.setAuthInitialized(true);
            AuthManager.setAuthRequired(true);
        }

        if (!refreshToken) {
            throw new Error('No refresh token found');
        }

        if (this.activeTokenRefreshPromise) {
            return this.activeTokenRefreshPromise;
        }

        AuthManager.setIsRefreshingToken(true);

        const refreshRequest = refreshFn(refreshToken).response;
        this.activeTokenRefreshPromise = refreshRequest.then((result) => result.data);

        try {
            const result = await refreshRequest;
            const { data } = result;

            if (!data) {
                throw new Error('No refreshed access token returned');
            }

            AuthManager.setAccessToken(data.refreshToken.accessToken);

            BaseClient.onTokenRefreshComplete?.();

            return data;
        } catch (e) {
            AuthManager.removeTokens();
            throw e;
        } finally {
            this.activeTokenRefreshPromise = null;
            AuthManager.setIsRefreshingToken(false);
        }
    }

    protected constructor(
        protected handleRefreshToken: (refreshToken: string) => AbortableApolloMutationResponse<UserRefreshMutation>,
    ) {}

    public getBaseUrl(): string {
        const { hostname, port, protocol } = window.location;

        const defaultUrl = import.meta.env.DEV
            ? import.meta.env.VITE_SERVER_URL_DEFAULT
            : `${protocol}//${hostname}:${port}`;

        const serverBaseURL = AppStorage.local.getItemParsed(BaseClient.BASE_URL_KEY, defaultUrl);

        // Apply subpath configuration to the base URL
        return SubpathUtil.getApiBaseUrl(serverBaseURL);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected shouldQueueRequest(operationName?: string): boolean {
        return AuthManager.shouldQueueRequests();
    }

    protected enqueueRequest<T>(executor: () => Promise<T>, operationName?: string): Promise<T> {
        if (!this.shouldQueueRequest(operationName)) {
            return executor();
        }

        const queuedRequest = new ControlledPromise<T>();
        const resolve = queuedRequest.resolve.bind(queuedRequest);
        const reject = queuedRequest.reject.bind(queuedRequest);

        this.requestQueue.push({
            execute: () => {
                executor().then(resolve).catch(reject);
            },
            resolve,
            reject,
        });

        return queuedRequest.promise;
    }

    public processQueue(): void {
        const queue = [...this.requestQueue];
        this.requestQueue = [];

        queue.forEach((request) => {
            request.execute();
        });
    }

    protected clearQueue(error?: Error): void {
        const queue = [...this.requestQueue];
        this.requestQueue = [];

        queue.forEach((request) => {
            request.reject(error ?? new Error('Request queue cleared'));
        });
    }

    public abstract updateConfig(config: Partial<ClientConfig>): void;
}
