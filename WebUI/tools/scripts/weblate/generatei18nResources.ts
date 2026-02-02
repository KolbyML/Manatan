/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import {
    fetchWeblateLanguageStats,
    getWeblateLanguageStatsFor,
    meetsTranslatedPercentThreshold as meetsTranslatedPercentThresholdBase,
} from './Weblate.utils.ts';
import { WeblateLanguageStatistic } from './Weblate.types.ts';
import { TRANSLATED_PERCENT_THRESHOLD } from './Weblate.constants.ts';

const FILE_PATH = 'src/i18n/index.ts';

const outputFilePath = path.join(import.meta.dirname, `../../../${FILE_PATH}`);
const resourcesDirPath = path.join(import.meta.dirname, '../../../public/locales');

const extractLanguageCode = (resourceFileNames: string): string =>
    path.basename(resourceFileNames, path.extname(resourceFileNames));

const meetsTranslatedPercentThreshold = (
    resourceFileName: string,
    weblateLanguageStats: WeblateLanguageStatistic[],
): boolean => {
    const code = extractLanguageCode(resourceFileName);
    const { name, translated_percent: translatedPercent } = getWeblateLanguageStatsFor(code, weblateLanguageStats);

    const meetsThreshold = meetsTranslatedPercentThresholdBase(translatedPercent);

    if (!meetsThreshold) {
        console.log(
            `Language "${name} (${code})" does not meet the required translation percentage threshold (${translatedPercent} < ${TRANSLATED_PERCENT_THRESHOLD})`,
        );
    }

    return meetsThreshold;
};

const generateResources = async () => {
    const weblateLanguageStats = await fetchWeblateLanguageStats();

    const resourceFileNames = fs.readdirSync(resourcesDirPath);

    const resourceNames = resourceFileNames
        .filter((resourceFileName) => meetsTranslatedPercentThreshold(resourceFileName, weblateLanguageStats))
        .map(extractLanguageCode);

    const outputFileContent = fs.readFileSync(outputFilePath, 'utf-8');

    const updatedFileContent = outputFileContent.replace(
        /(export const i18nResources = \[)[\s\S]*?(])/g,
        `$1'${resourceNames.join("', '")}'$2`,
    );

    fs.writeFileSync(outputFilePath, updatedFileContent);

    execSync('yarn tsc', { stdio: 'inherit' });

    execSync(`yarn eslint --fix ${FILE_PATH}`, { stdio: 'inherit' });

    const hasFileChanged = execSync('git status --porcelain').toString().includes(FILE_PATH);
    if (!hasFileChanged) {
        return;
    }

    execSync('git reset');
    execSync(`git add ${FILE_PATH}`);
    execSync('git commit -m "Update available languages"');
};

generateResources();
