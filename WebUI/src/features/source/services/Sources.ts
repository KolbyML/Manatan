/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import {
    SourceDisplayNameInfo,
    SourceIdInfo,
    SourceLanguageInfo,
    SourceNsfwInfo,
    SourceMetaInfo,
    SourceRepoInfo,
} from '@/features/source/Source.types.ts';
import {
    DefaultLanguage,
    getLanguage,
    languageSpecialSortComparator,
    toComparableLanguage,
    toComparableLanguages,
    toUniqueLanguageCodes,
} from '@/base/utils/Languages.ts';
import { getSourceMetadata } from '@/features/source/services/SourceMetadata.ts';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';

export class Sources {
    static readonly LOCAL_SOURCE_ID = '0';

    static isLocalSource(source: SourceIdInfo): boolean {
        return source.id === Sources.LOCAL_SOURCE_ID;
    }

    static getLanguage(source: SourceIdInfo & SourceLanguageInfo): string {
        if (Sources.isLocalSource(source)) {
            return DefaultLanguage.OTHER;
        }

        if (source.lang === 'multi') {
            return DefaultLanguage.ALL;
        }

        return source.lang;
    }

    static getMetaValue(source: Partial<SourceMetaInfo>, key: string): string | undefined {
        if (!source.meta?.length) {
            return undefined;
        }

        return source.meta.find((entry) => entry.key === key)?.value;
    }

    static getMetaLanguages(source: Partial<SourceMetaInfo>): string[] {
        const raw = Sources.getMetaValue(source, 'languages');
        if (!raw) {
            return [];
        }

        const trimmed = raw.trim();
        if (!trimmed) {
            return [];
        }

        const normalizeValue = (value: string) => {
            const normalized = value.trim();
            if (!normalized) {
                return '';
            }
            const lower = normalized.toLowerCase();
            const canonical = lower === 'all' || lower === 'multi' ? lower : normalized;
            return getLanguage(canonical).isoCode;
        };

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed
                        .filter((value) => typeof value === 'string')
                        .map((value) => normalizeValue(value as string))
                        .filter(Boolean);
                }
            } catch {
                // fall through to string parsing
            }
        }

        return trimmed
            .split(',')
            .map((value) => normalizeValue(value))
            .filter(Boolean);
    }

    static getLanguages(sources: (SourceIdInfo & SourceLanguageInfo & Partial<SourceMetaInfo>)[]): string[] {
        const languages = new Set<string>();
        sources.forEach((source) => {
            const sourceLanguage = Sources.getLanguage(source);
            languages.add(sourceLanguage);

            if (sourceLanguage === DefaultLanguage.ALL) {
                Sources.getMetaLanguages(source).forEach((language) => languages.add(language));
            }
        });
        return [...languages];
    }

    static groupByLanguage<Source extends SourceIdInfo & SourceLanguageInfo & SourceDisplayNameInfo & SourceMetaInfo>(
        sources: Source[],
    ): Record<string, Source[]> {
        const sourcesByLanguage = Object.groupBy(sources, (source) => {
            if (getSourceMetadata(source).isPinned) {
                return DefaultLanguage.PINNED;
            }

            return Sources.getLanguage(source);
        });
        const sourcesBySortedLanguage = Object.entries(sourcesByLanguage).toSorted(([a], [b]) => {
            const isAPinned = a === DefaultLanguage.PINNED;
            const isBPinned = b === DefaultLanguage.PINNED;

            if (isAPinned) {
                return -1;
            }

            if (isBPinned) {
                return 1;
            }

            return languageSpecialSortComparator(a, b);
        });
        const sortedSourcesBySortedLanguage = sourcesBySortedLanguage.map(([language, sourcesOfLanguage]) => [
            language,
            (sourcesOfLanguage ?? []).toSorted((a, b) => a.displayName.localeCompare(b.displayName)),
        ]);

        return Object.fromEntries(sortedSourcesBySortedLanguage);
    }

    static filter<Source extends SourceIdInfo & SourceLanguageInfo & SourceNsfwInfo & Partial<SourceMetaInfo>>(
        sources: Source[],
        {
            showNsfw,
            languages,
            keepLocalSource,
            pinned,
            enabled,
        }: {
            showNsfw?: boolean;
            languages?: string[];
            keepLocalSource?: boolean;
            pinned?: boolean;
            enabled?: boolean;
        } = {},
    ): Source[] {
        const normalizedLanguages = toComparableLanguages(toUniqueLanguageCodes(languages ?? []));
        const allLanguage = toComparableLanguage(DefaultLanguage.ALL);
        const hasAllLanguage = normalizedLanguages.includes(allLanguage);
        const otherLanguages = normalizedLanguages.filter((language) => language !== allLanguage);
        const hasOtherLanguages = otherLanguages.length > 0;

        const isLanguageAllowed = (source: Source): boolean => {
            if (!languages || languages.length === 0) {
                return true;
            }

            if (keepLocalSource && Sources.isLocalSource(source)) {
                return true;
            }

            const sourceLanguage = toComparableLanguage(Sources.getLanguage(source));
            const isMultiLanguage = sourceLanguage === allLanguage;

            if (isMultiLanguage) {
                if (!hasAllLanguage) {
                    return false;
                }

                if (!hasOtherLanguages) {
                    return true;
                }

                const metaLanguages = Sources.getMetaLanguages(source)
                    .map((language) => toComparableLanguage(language));
                if (!metaLanguages.length) {
                    return false;
                }

                return metaLanguages.some(
                    (language) => language === allLanguage || otherLanguages.includes(language),
                );
            }

            if (hasAllLanguage && !hasOtherLanguages) {
                return true;
            }

            return otherLanguages.includes(sourceLanguage);
        };

        return sources
            .filter(
                (source) =>
                    showNsfw === undefined ||
                    showNsfw ||
                    !source.isNsfw ||
                    (keepLocalSource && Sources.isLocalSource(source)),
            )
            .filter(
                (source) => isLanguageAllowed(source),
            )
            .filter(
                (source) =>
                    pinned === undefined ||
                    !pinned ||
                    getSourceMetadata(source).isPinned ||
                    (keepLocalSource && Sources.isLocalSource(source)),
            )
            .filter(
                (source) =>
                    enabled === undefined ||
                    !enabled ||
                    getSourceMetadata(source).isEnabled ||
                    (keepLocalSource && Sources.isLocalSource(source)),
            );
    }

    static areFromMultipleRepos<Source extends SourceIdInfo & SourceRepoInfo>(sources: Source[]): boolean {
        const repo = sources.find((source) => !!source.extension.repo)?.extension.repo;

        if (!repo || !sources.length) {
            return false;
        }

        return sources.some((source) => source.extension.repo !== repo && !Sources.isLocalSource(source));
    }

    static getLastUsedSource<Source extends SourceIdInfo & SourceMetaInfo>(
        lastUsedSourceId: SourceIdInfo['id'] | null,
        sources: Source[],
    ): Source | undefined {
        return sources.find((source) => source.id === lastUsedSourceId);
    }

    static useLanguages(): {
        languages: string[];
        setLanguages: (languages: string[]) => void;
    } {
        const { t } = useTranslation();
        const {
            settings: { sourceLanguages },
        } = useMetadataServerSettings();

        const updateSetting = createUpdateMetadataServerSettings<'sourceLanguages'>((e) =>
            makeToast(t('global.error.label.failed_to_save_changes', getErrorMessage(e)), 'error'),
        );
        const setLanguages = useCallback((languages: string[]) => updateSetting('sourceLanguages', languages), []);

        return {
            languages: sourceLanguages,
            setLanguages,
        };
    }
}
