/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { WeblateChangeActions } from '@/../tools/scripts/weblate/Weblate.types';

export const creditRelevantActions: WeblateChangeActions[] = [
    WeblateChangeActions.TRANSLATION_CHANGED,
    WeblateChangeActions.TRANSLATION_ADDED,
    WeblateChangeActions.TRANSLATION_REVERTED,
    WeblateChangeActions.TRANSLATION_UPLOADED,
    WeblateChangeActions.TRANSLATION_REMOVED,
    WeblateChangeActions.MARKED_FOR_EDIT,
];

export const TRANSLATION_CHANGELOG_YARG_OPTIONS_DEFAULT = {
    requiredContributionCount: 10,
    keepKnownContributors: true,
};

export const TRANSLATED_PERCENT_THRESHOLD = 75;
