/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { t as translate } from 'i18next';

import { TranslationKey } from '@/base/Base.types.ts';

export const createGetMenuItemTitle =
    <Action extends string>(
        isSingleMode: boolean,
        actionToTranslationKey: Record<
            Action,
            {
                action: {
                    single: TranslationKey;
                    selected: TranslationKey;
                };
                success: TranslationKey;
                error: TranslationKey;
            }
        >,
    ) =>
    (action: Action, count: number): string => {
        const countSuffix = count > 0 ? ` (${count})` : '';
        return `${translate(
            actionToTranslationKey[action].action[isSingleMode ? 'single' : 'selected'],
        )}${countSuffix}`;
    };

export const createShouldShowMenuItem =
    (isSingleMode: boolean) =>
    (shouldBeVisible: boolean = false): boolean =>
        isSingleMode ? shouldBeVisible : true;

export const createIsMenuItemDisabled =
    (isSingleMode: boolean) =>
    (shouldBeDisabled: boolean): boolean =>
        isSingleMode ? false : shouldBeDisabled;
