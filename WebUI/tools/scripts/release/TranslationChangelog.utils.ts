/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { ControlledPromise } from '@/lib/ControlledPromise.ts';
import {
    ActionByTranslationUrlByUserUrl,
    ContributionsByLanguage,
    LanguageNameByTranslationUrl,
    UsernameByUserUrl,
    UserUrlsByTranslationUrl,
    WeblateChangeResult,
    WeblateLanguageStatistic,
} from '../weblate/Weblate.types.ts';
import {
    fetchWeblateChanges,
    fetchWeblateLanguageStats,
    getLanguageName,
    getUsername,
    getWeblateLanguageStatsFor,
    meetsTranslatedPercentThreshold,
    validateWeblateDates,
} from '../weblate/Weblate.utils.ts';
import {
    creditRelevantActions,
    TRANSLATED_PERCENT_THRESHOLD,
    TRANSLATION_CHANGELOG_YARG_OPTIONS_DEFAULT,
} from '../weblate/Weblate.constants.ts';

const extractContributionInfoFromChanges = (
    changes: WeblateChangeResult[],
): {
    userUrlsByTranslationUrl: UserUrlsByTranslationUrl;
    actionsByTranslationUrlByUserUrl: ActionByTranslationUrlByUserUrl;
    actions: Record<number, string>;
} => {
    const userUrlsByTranslationUrl: UserUrlsByTranslationUrl = {};
    const actionsByTranslationUrlByUserUrl: ActionByTranslationUrlByUserUrl = {};
    const actions: Record<number, string> = {};

    changes.forEach((change) => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { translation: translationUrl, action, action_name, user: userUrl } = change;
        if (userUrl === null) {
            return;
        }

        userUrlsByTranslationUrl[translationUrl] = [
            ...new Set([...(userUrlsByTranslationUrl[translationUrl] ?? []), userUrl]),
        ];
        actions[action] = action_name;
        actionsByTranslationUrlByUserUrl[userUrl] = {
            ...actionsByTranslationUrlByUserUrl[userUrl],
            [translationUrl]: {
                count: (actionsByTranslationUrlByUserUrl[userUrl]?.[translationUrl]?.count ?? 0) + 1,
                actions: {
                    ...actionsByTranslationUrlByUserUrl[userUrl]?.[translationUrl]?.actions,
                    [action]: (actionsByTranslationUrlByUserUrl[userUrl]?.[translationUrl]?.actions[action] ?? 0) + 1,
                },
            },
        };
    });

    return { userUrlsByTranslationUrl, actionsByTranslationUrlByUserUrl, actions };
};

const getUsernameByUserUrlMap = async (
    userUrlsByTranslationUrl: UserUrlsByTranslationUrl,
): Promise<Record<string, string>> =>
    Object.fromEntries(
        (await Promise.all(
            Object.values(userUrlsByTranslationUrl)
                .flat()
                .map(async (userUrl) => [userUrl, await getUsername(userUrl)]),
        )) satisfies [string, string][],
    );

const getLanguageNameByTranslationUrl = async (
    userUrlsByTranslationUrl: UserUrlsByTranslationUrl,
): Promise<LanguageNameByTranslationUrl> =>
    Object.fromEntries(
        (await Promise.all(
            Object.keys(userUrlsByTranslationUrl)
                .flat()
                .map(async (translationUrl) => [translationUrl, await getLanguageName(translationUrl)]),
        )) satisfies [string, string][],
    );

const getUserContributionByLanguage = (
    userUrlsByTranslationUrl: UserUrlsByTranslationUrl,
    languageNameByTranslationUrl: LanguageNameByTranslationUrl,
    usernameByUserUrl: UsernameByUserUrl,
    actionsByTranslationUrlByUserUrl: ActionByTranslationUrlByUserUrl,
) =>
    Object.fromEntries(
        Object.entries(userUrlsByTranslationUrl).map(([translationUrl, userUrls]) => {
            const languageName = languageNameByTranslationUrl[translationUrl];
            const contributors = userUrls
                .map((userUrl) => {
                    const username = usernameByUserUrl[userUrl];
                    const contributionCount = actionsByTranslationUrlByUserUrl[userUrl][translationUrl].count;

                    return { username, contributionCount };
                })
                .sort((userA, userB) => userB.contributionCount - userA.contributionCount);

            return [languageName, contributors];
        }),
    );

const doesLanguageOfChangeMeetTranslatePercentThreshold = (
    change: WeblateChangeResult,
    stats: WeblateLanguageStatistic[],
): boolean => {
    // format: 'https://hosted.weblate.org/api/translations/suwayomi/manatan-webui/ar/'
    const code = change.translation.split('/').slice(-2)[0];
    const langaugeStats = getWeblateLanguageStatsFor(code, stats);

    return meetsTranslatedPercentThreshold(langaugeStats.translated_percent);
};

const getContributorsForRange = async (url: string): Promise<ContributionsByLanguage> => {
    const weblateChanges = await fetchWeblateChanges(url);
    const weblateLanguageStats = await fetchWeblateLanguageStats();

    const validWeblateChanges = weblateChanges.filter((change) =>
        doesLanguageOfChangeMeetTranslatePercentThreshold(change, weblateLanguageStats),
    );

    const invalidWeblateChangesAmount = Math.abs(validWeblateChanges.length - weblateChanges.length);
    if (invalidWeblateChangesAmount > 0) {
        console.log(
            `Filtered out ${invalidWeblateChangesAmount} invalid change(s) due languages not meeting the translated percent threshold (${TRANSLATED_PERCENT_THRESHOLD})`,
        );
    }

    const { userUrlsByTranslationUrl, actionsByTranslationUrlByUserUrl } =
        extractContributionInfoFromChanges(validWeblateChanges);

    const usernameByUserUrl = await getUsernameByUserUrlMap(userUrlsByTranslationUrl);
    const languageNameByTranslationUrl = await getLanguageNameByTranslationUrl(userUrlsByTranslationUrl);

    return getUserContributionByLanguage(
        userUrlsByTranslationUrl,
        languageNameByTranslationUrl,
        usernameByUserUrl,
        actionsByTranslationUrlByUserUrl,
    );
};

const getLanguageLinesFromChangelog = (): Promise<string[]> => {
    const fileReadPromise = new ControlledPromise<string[]>();

    const changelogFile = path.resolve(import.meta.dirname, '../../../CHANGELOG.md');
    const fileStream = fs.createReadStream(changelogFile);
    const fileLineReader = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity, // Recognize all line breaks (CR LF) as a single line break
    });

    const translationRelevantLines: string[] = [];
    let isTranslationSection = false;
    fileLineReader.on('line', (line) => {
        if (line.toLowerCase() === '### Translations'.toLowerCase()) {
            isTranslationSection = true;
            return;
        }

        const isStartOfRemovedLanguages = line.toLowerCase().startsWith('#### Removed'.toLowerCase());
        const isContributorsSection = line.toLowerCase().startsWith('### Contributors'.toLowerCase());
        const isEndOfLanguageSection = isStartOfRemovedLanguages || isContributorsSection;

        if (isEndOfLanguageSection) {
            isTranslationSection = false;
            return;
        }

        if (!isTranslationSection) {
            return;
        }

        if (!line.startsWith('-')) {
            return;
        }

        translationRelevantLines.push(line);
    });

    fileLineReader.on('close', () => {
        fileReadPromise.resolve(translationRelevantLines);
    });

    fileLineReader.on('error', (error) => {
        fileReadPromise.reject(error);
    });

    return fileReadPromise.promise;
};

const getKnownContributorsByLanguage = async (): Promise<Record<string, string[]>> => {
    const changelogLanguageLines = await getLanguageLinesFromChangelog();

    const contributorByLanguage: Record<string, string[]> = {};
    changelogLanguageLines.forEach((languageLine) => {
        const languageChangeRegex = /^- (.*) \(by (.*)\)$/g;
        const languageChangeRegexMatch = [...languageLine.matchAll(languageChangeRegex)][0];

        const language = languageChangeRegexMatch[1];
        const contributors = languageChangeRegexMatch[2].split(', ');

        const knownContributors = contributorByLanguage[language] ?? [];
        contributorByLanguage[language] = [...new Set([...knownContributors, ...contributors])];
    });

    return contributorByLanguage;
};

export const createTranslationChangelog = async (
    afterDate: string,
    beforeDate: string,
    requiredContributionCount: number = TRANSLATION_CHANGELOG_YARG_OPTIONS_DEFAULT.requiredContributionCount,
    keepKnownContributors: boolean = TRANSLATION_CHANGELOG_YARG_OPTIONS_DEFAULT.keepKnownContributors,
): Promise<string> => {
    validateWeblateDates(afterDate, beforeDate);

    const timestampAfter = `${afterDate}T00:00:00.000Z`;
    const timestampBefore = `${beforeDate}T00:00:00.000Z`;

    const url = `https://hosted.weblate.org/api/components/suwayomi/manatan-webui/changes/?timestamp_after=${timestampAfter}&timestamp_before=${timestampBefore}&${creditRelevantActions.map((action) => `action=${action}`).join('&')}`;

    const contributorsForRange = await getContributorsForRange(url);
    const knownContributorsByLanguage = await getKnownContributorsByLanguage();

    const contributionInfo: { language: string; contributors: string[] }[] = Object.entries(contributorsForRange).map(
        ([language, languageContributors]) => {
            const validContributors = languageContributors.filter(
                ({ username, contributionCount }) =>
                    (keepKnownContributors && knownContributorsByLanguage[language]?.includes(username)) ||
                    contributionCount >= requiredContributionCount,
            );
            const contributors = validContributors.length ? validContributors : [languageContributors[0]];

            return {
                language,
                contributors: contributors.map(({ username }) => username),
            };
        },
    );

    const languageByNewState = Object.groupBy(
        contributionInfo,
        ({ language }) => `${knownContributorsByLanguage[language] == null}`,
    );

    const newLanguages = languageByNewState.true ?? [];
    const updatedLanguages = languageByNewState.false ?? [];

    let changelog =
        '### Translations\n' +
        'Feel free to translate the project on [Weblate](https://hosted.weblate.org/projects/kolbyml/manatan-webui/)\n' +
        '\n' +
        'Thanks to everyone that contributed to the translation of this project.\n\n';

    if (newLanguages.length) {
        changelog += '#### Added\n';
        newLanguages.forEach(({ language, contributors }) => {
            changelog += `- ${language} (by ${contributors.join(', ')})\n`;
        });
        changelog += '\n';
    }

    if (updatedLanguages.length) {
        changelog += '#### Updated\n';
        updatedLanguages.forEach(({ language, contributors }) => {
            changelog += `- ${language} (by ${contributors.join(', ')})\n`;
        });
    }

    return changelog;
};
