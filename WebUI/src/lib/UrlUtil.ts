/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { SearchParam } from '@/base/Base.types.ts';

export class UrlUtil {
    static createParams(params: Record<SearchParam | string, string | null | undefined>): URLSearchParams {
        const paramEntries = Object.entries(params).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
        );

        return new URLSearchParams(paramEntries);
    }

    static createTabParam(tab: string | null | undefined): { [SearchParam.TAB]: string } {
        return Object.fromEntries(this.createParams({ [SearchParam.TAB]: tab }).entries()) as unknown as {
            [SearchParam.TAB]: string;
        };
    }

    static createQueryParam(query: string | null | undefined): { [SearchParam.QUERY]: string } {
        return Object.fromEntries(this.createParams({ [SearchParam.QUERY]: query }).entries()) as unknown as {
            [SearchParam.QUERY]: string;
        };
    }

    static addParams(path: string, params: Record<SearchParam | string, string | null | undefined>): string {
        const urlParams = this.createParams(params).toString();

        if (urlParams) {
            return `${path}?${urlParams}`;
        }

        return path;
    }

    static addQueryParam(path: string, query: string | null | undefined): string {
        return this.addParams(path, this.createQueryParam(query));
    }
}
