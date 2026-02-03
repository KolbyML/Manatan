/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { BaseClient } from '@/lib/requests/client/BaseClient.ts';
import { AuthManager } from '@/features/authentication/AuthManager.ts';
import { UserRefreshMutation } from '@/lib/requests/types.ts';
import { AbortableApolloMutationResponse } from '@/lib/requests/RequestManager.ts';

export enum HttpMethod {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    PATCH = 'PATCH',
    DELETE = 'DELETE',
}

export interface IRestClient {
    fetcher(
        url: string,
        options?: {
            data?: any;
            httpMethod?: HttpMethod;
            config?: RequestInit;
            checkResponseIsJson?: boolean;
        },
    ): Promise<Response>;
    get(url: string): Promise<Response>;
    delete(url: string): Promise<Response>;
    post(url: string, data?: any): Promise<Response>;
    put(url: string, data?: any): Promise<Response>;
    patch(url: string, data?: any): Promise<Response>;
}

export class RestClient
    extends BaseClient<typeof fetch, RequestInit, (url: string, data: any) => Promise<Response>>
    implements IRestClient
{
    protected client!: typeof fetch;

    private config: RequestInit = {
        credentials: 'include',
    };

    public readonly fetcher = async (
        url: string,
        {
            data,
            httpMethod = HttpMethod.GET,
            config,
            checkResponseIsJson = true,
        }: {
            data?: any;
            httpMethod?: HttpMethod;
            config?: RequestInit;
            checkResponseIsJson?: boolean;
        } = {},
    ): Promise<Response> =>
        this.enqueueRequest(async () => {
            const updatedUrl = url.startsWith('http') ? url : `${this.getBaseUrl()}${url}`;
            console.info('[request] fetch start', { method: httpMethod, url: updatedUrl });
            const isAuthRequired = AuthManager.isAuthRequired();
            const accessToken = AuthManager.getAccessToken();
            const baseHeaders = {
                ...(isAuthRequired && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                ...this.config.headers,
                ...config?.headers,
            };

            let result: Response;

            switch (httpMethod) {
                case HttpMethod.GET:
                    result = await this.client(updatedUrl, {
                        ...this.config,
                        ...config,
                        method: httpMethod,
                        headers: baseHeaders,
                    });
                    break;
                case HttpMethod.POST:
                case HttpMethod.PUT:
                case HttpMethod.PATCH:
                case HttpMethod.DELETE:
                    const isFormData =
                        typeof FormData !== 'undefined' && data instanceof FormData;
                    const body =
                        data === undefined ? undefined : isFormData ? data : JSON.stringify(data);
                    const headers = {
                        ...baseHeaders,
                        ...(!isFormData && data !== undefined ? { 'content-type': 'application/json' } : {}),
                    };
                    result = await this.client(updatedUrl, {
                        ...this.config,
                        ...config,
                        method: httpMethod,
                        body,
                        headers,
                    });
                    break;
                default:
                    throw new Error(`Unexpected HttpMethod "${httpMethod}"`);
            }

            if (result.status === 401) {
                await BaseClient.refreshAccessToken(this.handleRefreshToken);
                return this.fetcher(url, { data, httpMethod, config, checkResponseIsJson });
            }

            if (result.status < 200 || result.status >= 300) {
                throw new Error(`status ${result.status}: ${result.statusText}`);
            }

            if (checkResponseIsJson) {
                const contentType = result.headers.get('content-type') ?? '';
                if (contentType && !contentType.includes('application/json')) {
                    throw new Error('Response is not json');
                }
            }

            return result;
        }, `${httpMethod} ${url}`);

    constructor(handleRefreshToken: (refreshToken: string) => AbortableApolloMutationResponse<UserRefreshMutation>) {
        super(handleRefreshToken);

        this.createClient();
    }

    private createClient(): void {
        this.client = fetch.bind(window);
    }

    public updateConfig(config: RequestInit): void {
        this.config = { ...this.config, ...config };
    }

    public getClient(): typeof fetch {
        return this.client;
    }

    get get() {
        return (url: string) => this.fetcher(url);
    }

    get post() {
        return (url: string, data?: any) => this.fetcher(url, { data, httpMethod: HttpMethod.POST });
    }

    get put() {
        return (url: string, data?: any) => this.fetcher(url, { data, httpMethod: HttpMethod.PUT });
    }

    get patch() {
        return (url: string, data?: any) => this.fetcher(url, { data, httpMethod: HttpMethod.PATCH });
    }

    get delete() {
        return (url: string) => this.fetcher(url, { httpMethod: HttpMethod.DELETE });
    }
}
