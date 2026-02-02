/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dayjs from 'dayjs';
import { createCommitChangelog } from './CommitChangelog.utils.ts';
import { createTranslationChangelog } from './TranslationChangelog.utils.ts';
import { validateWeblateDates } from '../weblate/Weblate.utils.ts';

const { sha, date } = yargs(hideBin(process.argv))
    .options({
        sha: {
            description: 'The hash of the last commit of the previous release',
            type: 'string',
            demandOption: true,
        },
        date: {
            alias: 'ad',
            description: 'IS0-8601 formatted date of the last release (e.g. 2024-05-01)',
            type: 'string',
            demandOption: true,
        },
    })
    .parseSync();

if (!sha) {
    throw new Error('Sha of last commit of the previous release has to be passed!');
}
const createReleaseChangelog = async (lastReleaseCommitSha: string, lastReleaseDate: string) => {
    validateWeblateDates(lastReleaseDate, lastReleaseDate);

    const tomorrow = dayjs().add(1, 'day');

    const beforeDate = tomorrow.format('YYYY-MM-DD');
    const afterDate = dayjs(lastReleaseDate).add(1, 'day').format('YYYY-MM-DD');

    const commitChangelog = await createCommitChangelog(lastReleaseCommitSha);
    const translationChangelog = await createTranslationChangelog(afterDate, beforeDate);
    const changelog = `${translationChangelog}\n${commitChangelog}`;

    console.log(changelog);
};

createReleaseChangelog(sha, date).then(console.log);
