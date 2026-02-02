/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { BackupFlag, BackupFlagGroup } from '@/features/backup/Backup.types.ts';
import { TranslationKey } from '@/base/Base.types.ts';

export const BACKUP_FLAGS_TO_TRANSLATION: Record<BackupFlag, TranslationKey> = {
    includeManga: 'settings.backup.flag.manga',
    includeCategories: 'settings.backup.flag.categories',
    includeChapters: 'settings.backup.flag.chapters',
    includeClientData: 'settings.backup.flag.client_data',
    includeHistory: 'settings.backup.flag.history',
    includeServerSettings: 'settings.backup.flag.server_settings',
    includeTracking: 'settings.backup.flag.tracking',
};

export const BACKUP_FLAG_GROUP_TO_TRANSLATION: Record<BackupFlagGroup, TranslationKey> = {
    [BackupFlagGroup.LIBRARY]: 'settings.backup.flag.group.library',
    [BackupFlagGroup.SETTINGS]: 'settings.backup.flag.group.settings',
};

export const BACKUP_FLAGS = Object.keys(BACKUP_FLAGS_TO_TRANSLATION) as readonly BackupFlag[];

export const BACKUP_FLAGS_BY_GROUP: Record<BackupFlagGroup, BackupFlag[]> = {
    [BackupFlagGroup.LIBRARY]: [
        'includeManga',
        'includeChapters',
        'includeTracking',
        'includeHistory',
        'includeCategories',
    ],
    [BackupFlagGroup.SETTINGS]: ['includeClientData', 'includeServerSettings'],
};
