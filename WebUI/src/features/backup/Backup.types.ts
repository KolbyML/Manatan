/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { PartialBackupFlagsInput } from '@/lib/graphql/generated/graphql.ts';
import { ServerSettings } from '@/features/settings/Settings.types.ts';

export enum BackupFlagGroup {
    LIBRARY = 'library',
    SETTINGS = 'settings',
}

export type BackupFlag = keyof PartialBackupFlagsInput;

export type BackupFlagInclusionState = Record<BackupFlag, boolean>;

export type AutoBackupFlag = Pick<
    ServerSettings,
    | 'autoBackupIncludeCategories'
    | 'autoBackupIncludeChapters'
    | 'autoBackupIncludeClientData'
    | 'autoBackupIncludeHistory'
    | 'autoBackupIncludeManga'
    | 'autoBackupIncludeServerSettings'
    | 'autoBackupIncludeTracking'
>;

export type AutoBackupFlagInclusionState = Record<keyof AutoBackupFlag, boolean>;

export type BackupSettingsType = Pick<
    ServerSettings,
    | 'backupPath'
    | 'backupTime'
    | 'backupInterval'
    | 'backupTTL'
    | 'autoBackupIncludeCategories'
    | 'autoBackupIncludeChapters'
    | 'autoBackupIncludeClientData'
    | 'autoBackupIncludeHistory'
    | 'autoBackupIncludeManga'
    | 'autoBackupIncludeServerSettings'
    | 'autoBackupIncludeTracking'
>;
