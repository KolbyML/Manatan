/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export class CustomCache {
    private keyToResponseMap = new Map<string, unknown>();

    private keyToFetchTimestampMap = new Map<string, number>();

    public readonly createKeyFn = (endpoint: string, data: unknown): string => `${endpoint}_${JSON.stringify(data)}`;

    constructor(createKeyFn?: (endpoint: string, data: unknown) => string) {
        this.createKeyFn = createKeyFn ?? this.createKeyFn;
    }

    public getKeyFor(key: string, data: unknown): string {
        return this.createKeyFn(key, data);
    }

    public cacheResponse(endpoint: string, data: unknown, response: unknown) {
        const createdKey = this.getKeyFor(endpoint, data);
        this.keyToFetchTimestampMap.set(createdKey, Date.now());
        this.keyToResponseMap.set(createdKey, response);
    }

    public getFetchTimestampFor(endpoint: string, data: unknown): number | undefined {
        const key = this.getKeyFor(endpoint, data);
        return this.keyToFetchTimestampMap.get(key);
    }

    public getResponseFor<Response = any>(endpoint: string, data: unknown, ttl?: number): Response | undefined {
        const key = this.getKeyFor(endpoint, data);

        const isTtlReached = ttl && Date.now() - (this.getFetchTimestampFor(endpoint, data) ?? 0) >= ttl;
        if (isTtlReached) {
            this.keyToResponseMap.delete(key);
        }

        return this.keyToResponseMap.get(key) as Response;
    }

    public getAllKeys(): string[] {
        return [...this.keyToResponseMap.keys()];
    }

    public getMatchingKeys(regex: RegExp): string[] {
        return this.getAllKeys().filter((key) => !!regex.exec(key));
    }

    public clearFor(...keys: string[]) {
        keys.forEach((key) => {
            this.keyToResponseMap.delete(key);
            this.keyToFetchTimestampMap.delete(key);
        });
    }

    public clear(): void {
        this.keyToResponseMap.clear();
        this.keyToFetchTimestampMap.clear();
    }
}
