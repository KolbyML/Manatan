/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export enum NetworkStatus {
    loading = 1,
    setVariables = 2,
    fetchMore = 3,
    refetch = 4,
    poll = 6,
    ready = 7,
    error = 8,
}

export const isNetworkRequestInFlight = (status?: number): boolean =>
    status === NetworkStatus.loading ||
    status === NetworkStatus.setVariables ||
    status === NetworkStatus.fetchMore ||
    status === NetworkStatus.refetch ||
    status === NetworkStatus.poll;
