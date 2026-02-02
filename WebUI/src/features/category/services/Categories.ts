/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { CategoryDefaultInfo, CategoryIdInfo } from '@/features/category/Category.types.ts';

export const DEFAULT_CATEGORY_ID = 0;

export class Categories {
    static getIds(categories: CategoryIdInfo[]): number[] {
        return categories.map((category) => category.id);
    }

    static getUserCreated<Category extends CategoryIdInfo>(categories: Category[]): Category[] {
        return categories.filter((category) => category.id !== DEFAULT_CATEGORY_ID);
    }

    static getDefaults<Category extends CategoryDefaultInfo>(categories: Category[]): Category[] {
        return categories.filter((category) => category.default);
    }
}
