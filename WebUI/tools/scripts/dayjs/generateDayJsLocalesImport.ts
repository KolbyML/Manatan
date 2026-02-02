/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import path from 'path';
import fs from 'fs';

const outputFilePath = path.join(import.meta.dirname, '../../../src/lib/dayjs/LocaleImporter.ts');
const resourcesDirPath = path.join(import.meta.dirname, '../../../node_modules/dayjs/locale');

const dayjsLocaleFileNames = fs.readdirSync(resourcesDirPath);

const dayjsLocaleToFileName = dayjsLocaleFileNames
    .filter((dayjsLocaleFileName) => dayjsLocaleFileName.endsWith('.js'))
    .map((dayjsLocaleFileName) => [
        path.basename(dayjsLocaleFileName, path.extname(dayjsLocaleFileName)),
        dayjsLocaleFileName,
    ]);

const outputFileContent = fs.readFileSync(outputFilePath, 'utf-8');

const updatedFileContent = outputFileContent.replace(
    /(const localesToImport: Record<\(typeof DAYJS_LOCALES\)\[number], \(\) => Promise<unknown>> = \{)[\s\S]*?(})/g,
    `$1${dayjsLocaleToFileName.map(([locale, fileName]) => `'${locale}': () => import('dayjs/locale/${fileName}')`).join(',')}$2`,
);

fs.writeFileSync(outputFilePath, updatedFileContent);
