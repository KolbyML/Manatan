/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { createTranslationChangelog } from './TranslationChangelog.utils.ts';
import { TRANSLATION_CHANGELOG_YARG_OPTIONS_DEFAULT } from '../weblate/Weblate.constants.ts';

const { afterDate, beforeDate, requiredContributionCount, keepKnownContributors } = yargs(hideBin(process.argv))
    .options({
        afterDate: {
            alias: 'ad',
            description: 'IS0-8601 formatted date (included) (e.g. 2024-05-01)',
            type: 'string',
            demandOption: true,
        },
        beforeDate: {
            alias: 'bd',
            description: 'IS0-8601 formatted date (excluded) (e.g. 2024-05-11)',
            type: 'string',
            demandOption: true,
        },
        requiredContributionCount: {
            alias: 'rcc',
            description: 'The minimum number of contributions for a language to be considered a contributor',
            type: 'number',
            default: TRANSLATION_CHANGELOG_YARG_OPTIONS_DEFAULT.requiredContributionCount,
        },
        keepKnownContributors: {
            alias: 'kc',
            description: 'Ignore "requiredContributionCount" for known contributors of a language',
            type: 'boolean',
            default: TRANSLATION_CHANGELOG_YARG_OPTIONS_DEFAULT.keepKnownContributors,
        },
    })
    .parseSync();

if (!afterDate || !beforeDate) {
    throw new Error('The timespan (afterDate and beforeDate) has to be passed!');
}

createTranslationChangelog(afterDate, beforeDate, requiredContributionCount, keepKnownContributors).then(console.log);
