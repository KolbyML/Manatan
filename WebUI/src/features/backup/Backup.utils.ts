/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { t as translate } from 'i18next';
import { AutoBackupFlagInclusionState, BackupFlag, BackupFlagInclusionState } from '@/features/backup/Backup.types.ts';
import { BACKUP_FLAGS_TO_TRANSLATION } from '@/features/backup/Backup.constants.ts';

export const convertToAutoBackupFlags = (flags: BackupFlagInclusionState): AutoBackupFlagInclusionState => ({
    autoBackupIncludeCategories: flags.includeCategories,
    autoBackupIncludeChapters: flags.includeChapters,
    autoBackupIncludeClientData: flags.includeClientData,
    autoBackupIncludeHistory: flags.includeHistory,
    autoBackupIncludeManga: flags.includeManga,
    autoBackupIncludeServerSettings: flags.includeServerSettings,
    autoBackupIncludeTracking: flags.includeTracking,
});

export const convertToBackupFlags = (flags: AutoBackupFlagInclusionState): BackupFlagInclusionState => ({
    includeCategories: flags.autoBackupIncludeCategories,
    includeChapters: flags.autoBackupIncludeChapters,
    includeClientData: flags.autoBackupIncludeClientData,
    includeHistory: flags.autoBackupIncludeHistory,
    includeManga: flags.autoBackupIncludeManga,
    includeServerSettings: flags.autoBackupIncludeServerSettings,
    includeTracking: flags.autoBackupIncludeTracking,
});

const getIncludeExcludeText = (count: number, allCount: number, specificText: string): string => {
    if (count === 0) {
        return translate('global.label.none');
    }

    if (count === allCount) {
        return translate('extension.language.all');
    }

    return specificText;
};

export const getAutoBackupFlagsInfo = (autoFlags: AutoBackupFlagInclusionState): Record<`${boolean}`, string> => {
    const flags = convertToBackupFlags(autoFlags);
    const totalFlags = Object.keys(flags).length;

    const flagsByState = Object.groupBy(Object.entries(flags), ([, value]) => value.toString());

    const includedFlagsString =
        flagsByState.true?.map(([key]) => translate(BACKUP_FLAGS_TO_TRANSLATION[key as BackupFlag])).join(', ') ?? '';
    const excludedFlagsString =
        flagsByState.false?.map(([key]) => translate(BACKUP_FLAGS_TO_TRANSLATION[key as BackupFlag])).join(', ') ?? '';

    return {
        false: getIncludeExcludeText(flagsByState.false?.length ?? 0, totalFlags, excludedFlagsString),
        true: getIncludeExcludeText(flagsByState.true?.length ?? 0, totalFlags, includedFlagsString),
    };
};

export const getBackupCleanupDisplayValue = (ttl: number): string => {
    if (ttl === 0) {
        return translate('global.label.never');
    }

    return translate('settings.backup.automated.cleanup.label.value', { days: ttl, count: ttl });
};
