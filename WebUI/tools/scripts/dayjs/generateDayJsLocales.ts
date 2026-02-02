/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import path from 'path';
import fs from 'fs';

const outputFilePath = path.join(import.meta.dirname, '../../../src/lib/dayjs/Locales.ts');
const resourcesDirPath = path.join(import.meta.dirname, '../../../node_modules/dayjs/locale');

const dayjsLocaleFileNames = fs.readdirSync(resourcesDirPath);

const dayjsLocales = dayjsLocaleFileNames
    .filter((dayjsLocaleFileName) => dayjsLocaleFileName.endsWith('.js'))
    .map((dayjsLocaleFileName) => path.basename(dayjsLocaleFileName, path.extname(dayjsLocaleFileName)));

const outputFileContent = fs.readFileSync(outputFilePath, 'utf-8');

const updatedFileContent = outputFileContent.replace(
    /(export const DAYJS_LOCALES = \[)[\s\S]*?(])/g,
    `$1'${dayjsLocales.join("', '")}'$2`,
);

fs.writeFileSync(outputFilePath, updatedFileContent);
