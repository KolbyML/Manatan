/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { t } from 'i18next';
import { ISOLanguage, IsoLanguages } from '@/base/IsoLanguages.ts';

import { TranslationKey } from '@/base/Base.types.ts';

export enum DefaultLanguage {
    ALL = 'all',
    OTHER = 'other',
    LOCAL_SOURCE = 'localsourcelang',
    PINNED = 'pinned',
    LAST_USED_SOURCE = 'last_used_source',
}

const DEFAULT_LANGUAGE_TO_TRANSLATION: Record<DefaultLanguage, TranslationKey> = {
    [DefaultLanguage.ALL]: 'extension.language.all',
    [DefaultLanguage.OTHER]: 'extension.language.other',
    [DefaultLanguage.LOCAL_SOURCE]: 'extension.language.other',
    [DefaultLanguage.PINNED]: 'global.label.pinned',
    [DefaultLanguage.LAST_USED_SOURCE]: 'global.label.last_used',
};

type LanguageObject = ISOLanguage & { orgCode: string; isoCode: string };

function getISOLanguageFor(code: string, orgCode: string = code, isoCode: string = code): LanguageObject | null {
    if (IsoLanguages[code]) {
        return {
            ...IsoLanguages[code],
            orgCode,
            isoCode,
        };
    }

    return null;
}

function getISOLanguage(code: string): LanguageObject | null {
    return (
        getISOLanguageFor(code) ??
        getISOLanguageFor(code.toLowerCase(), code) ??
        getISOLanguageFor(code.replace('-', '_'), code) ??
        getISOLanguageFor(code.replace('_', '-'), code) ??
        getISOLanguageFor(code.split('-')[0], code) ??
        getISOLanguageFor(code.split('_')[0], code)
    );
}

export function getLanguage(code: string): LanguageObject {
    const isoLanguage = getISOLanguage(code);

    if (isoLanguage) {
        return isoLanguage;
    }

    return {
        orgCode: code,
        isoCode: code,
        name: t('global.language.label.language_with_code', { code }),
        nativeName: t('global.language.label.language_with_code', { code }),
    };
}

export function languageCodeToName(code: string): string {
    const isCustomLanguage = Object.keys(DEFAULT_LANGUAGE_TO_TRANSLATION).includes(code);
    if (isCustomLanguage) {
        return t(DEFAULT_LANGUAGE_TO_TRANSLATION[code as DefaultLanguage]);
    }

    return getLanguage(code).nativeName;
}

export const toUniqueLanguageCodes = (codes: string[]): string[] => {
    const languages = codes.map((code) => getLanguage(code));
    const languagesByIsoCode = Object.groupBy(languages, (language) => language.isoCode);

    return Object.entries(languagesByIsoCode)
        .filter(([, languagesOfIsoCode]) => !!languagesOfIsoCode?.length)
        .map(([, languagesOfIsoCode]) => languagesOfIsoCode![0].orgCode);
};

export const toComparableLanguage = (code: string): string => getLanguage(code).isoCode;

export const toComparableLanguages = (codes: string[]): string[] => codes.map(toComparableLanguage);

function defaultNativeLang(): readonly string[] {
    return ['ja'];
}

export function getDefaultLanguages(): string[] {
    return [...defaultNativeLang(), DefaultLanguage.ALL];
}

/**
 * Sort languages by their native name.
 * Custom languages are optionally treated specially:
 * - All: first
 * - Other: last
 */
export const languageSortComparator = (a: string, b: string, specialCustomLanguagesHandling?: boolean) => {
    const isALanguageAll = a === DefaultLanguage.ALL;
    const isALanguageOther = a === DefaultLanguage.OTHER || a === DefaultLanguage.LOCAL_SOURCE;

    const isBLanguageAll = b === DefaultLanguage.ALL;
    const isBLanguageOther = b === DefaultLanguage.OTHER || b === DefaultLanguage.LOCAL_SOURCE;

    if (specialCustomLanguagesHandling) {
        if (isALanguageAll || isBLanguageOther) {
            return -1;
        }

        if (isALanguageOther || isBLanguageAll) {
            return 1;
        }
    }

    return languageCodeToName(a).localeCompare(languageCodeToName(b));
};

/**
 * Sort languages by their native name.
 * Custom languages are treated specially:
 * - All: first
 * - Other: last
 */
export const languageSpecialSortComparator = (a: string, b: string) => languageSortComparator(a, b, true);
