/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { t } from 'i18next';
import {
    ExtensionAction,
    ExtensionGroupState,
    ExtensionState,
    GroupedExtensionsResult,
    InstalledState,
    TExtension,
} from '@/features/extension/Extensions.types.ts';
import {
    DefaultLanguage,
    languageCodeToName,
    languageSpecialSortComparator,
    toComparableLanguage,
    toComparableLanguages,
    toUniqueLanguageCodes,
} from '@/base/utils/Languages.ts';
import {
    EXTENSION_ACTION_TO_FAILURE_TRANSLATION_KEY_MAP,
    extensionLanguageToTranslationKey,
} from '@/features/extension/Extensions.constants.ts';
import { enhancedCleanup } from '@/base/utils/Strings.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';

export const getInstalledState = (
    isInstalled: boolean,
    isObsolete: boolean,
    hasUpdate: boolean,
): ExtensionAction | ExtensionState.OBSOLETE => {
    if (isObsolete) {
        return InstalledState.OBSOLETE;
    }

    if (hasUpdate) {
        return InstalledState.UPDATE;
    }

    return isInstalled ? InstalledState.UNINSTALL : InstalledState.INSTALL;
};

export const isExtensionState = (value: string): boolean =>
    [ExtensionGroupState.INSTALLED, ExtensionGroupState.UPDATE_PENDING, ExtensionGroupState.OBSOLETE].includes(
        value as ExtensionGroupState,
    );

export const isPinnedOrLastUsedSource = (languageCode: string): boolean =>
    [DefaultLanguage.PINNED, DefaultLanguage.LAST_USED_SOURCE].includes(languageCode as DefaultLanguage);

export const isExtensionStateOrLanguage = (languageCode: string): boolean =>
    isExtensionState(languageCode) ||
    isPinnedOrLastUsedSource(languageCode) ||
    [DefaultLanguage.ALL, DefaultLanguage.OTHER, DefaultLanguage.LOCAL_SOURCE].includes(
        languageCode as DefaultLanguage,
    );

export const translateExtensionLanguage = (languageCode: string): string =>
    isExtensionStateOrLanguage(languageCode)
        ? t(extensionLanguageToTranslationKey[languageCode as ExtensionGroupState | DefaultLanguage])
        : languageCodeToName(languageCode);

export function groupExtensionsByLanguage(extensions: TExtension[]): GroupedExtensionsResult {
    const extensionsByLanguage = Object.groupBy<ExtensionGroupState | string, TExtension>(extensions, (extension) => {
        if (!extension.isInstalled) {
            return extension.lang;
        }

        if (extension.hasUpdate && !extension.isObsolete) {
            return ExtensionGroupState.UPDATE_PENDING;
        }

        if (extension.isObsolete) {
            return ExtensionGroupState.OBSOLETE;
        }

        return ExtensionGroupState.INSTALLED;
    });

    // sort groups by language
    const extensionsBySortedLanguage = Object.entries(extensionsByLanguage).toSorted(([a], [b]) => {
        const extensionGroupStates = Object.values(ExtensionGroupState);

        const isAState = extensionGroupStates.includes(a as ExtensionGroupState);
        const isAObsolete = ExtensionGroupState.OBSOLETE === a;
        const isAUpdatable = ExtensionGroupState.UPDATE_PENDING === a;

        const isBState = extensionGroupStates.includes(b as ExtensionGroupState);
        const isBObsolete = ExtensionGroupState.OBSOLETE === b;
        const isBUpdatable = ExtensionGroupState.UPDATE_PENDING === b;

        if (isAObsolete || (isAState && !isBState) || (isAUpdatable && !isBObsolete)) {
            return -1;
        }
        if (isBObsolete || (!isAState && isBState) || (!isAUpdatable && isBUpdatable)) {
            return 1;
        }

        return languageSpecialSortComparator(a, b);
    });

    const groupedExtensionsSortedByLanguage = extensionsBySortedLanguage.map(([language, extensionsOfLanguage]) => [
        language,
        (extensionsOfLanguage ?? []).toSorted((a, b) => a.name.localeCompare(b.name)),
    ]) satisfies GroupedExtensionsResult;

    return groupedExtensionsSortedByLanguage.filter(([, extensionsOfLanguage]) => !!extensionsOfLanguage.length);
}

export const getLanguagesFromExtensions = (extensions: TExtension[]): string[] => [
    ...new Set(extensions.map((extension) => extension.lang)),
];

export const filterExtensions = (
    extensions: TExtension[],
    {
        selectedLanguages,
        showNsfw,
        query,
    }: {
        selectedLanguages?: string[];
        showNsfw?: boolean;
        query?: string | null | undefined;
    } = {},
): TExtension[] => {
    const normalizedSelectedLanguages = toComparableLanguages(toUniqueLanguageCodes(selectedLanguages ?? []));

    return extensions
        .filter(
            (extension) =>
                !selectedLanguages ||
                normalizedSelectedLanguages.includes(toComparableLanguage(extension.lang)) ||
                extension.isInstalled,
        )
        .filter((extension) => showNsfw === undefined || showNsfw || !extension.isNsfw)
        .filter((extension) => query == null || enhancedCleanup(extension.name).includes(enhancedCleanup(query)));
};

export const updateExtension = async (
    pkgName: TExtension['pkgName'],
    isObsolete: boolean,
    action: ExtensionAction,
): Promise<void> => {
    try {
        switch (action) {
            case ExtensionAction.INSTALL:
                await requestManager.updateExtension(pkgName, { install: true, isObsolete }).response;
                break;
            case ExtensionAction.UNINSTALL:
                await requestManager.updateExtension(pkgName, { uninstall: true, isObsolete }).response;
                break;
            case ExtensionAction.UPDATE:
                await requestManager.updateExtension(pkgName, { update: true, isObsolete }).response;
                break;
            default:
                throw new Error(`Unexpected ExtensionAction "${action}"`);
        }
    } catch (e) {
        makeToast(
            t(EXTENSION_ACTION_TO_FAILURE_TRANSLATION_KEY_MAP[action], { count: 1 }),
            'error',
            getErrorMessage(e),
        );
        throw e;
    }
};
