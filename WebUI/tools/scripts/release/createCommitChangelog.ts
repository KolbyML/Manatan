/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { createCommitChangelog } from './CommitChangelog.utils.ts';

const { sha } = yargs(hideBin(process.argv))
    .options({
        sha: {
            description: 'The hash of the last commit of the previous release',
            type: 'string',
            demandOption: true,
        },
    })
    .parseSync();

if (!sha) {
    throw new Error('Sha of last commit of the previous release has to be passed!');
}

createCommitChangelog(sha)
    .then(console.log)
    .catch((error) => {
        console.error('Failed due to', error);
        process.exit(1);
    });
