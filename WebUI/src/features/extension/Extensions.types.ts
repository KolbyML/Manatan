/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ExtensionType } from '@/lib/graphql/generated/graphql.ts';

export enum ExtensionAction {
    UPDATE = 'UPDATE',
    UNINSTALL = 'UNINSTALL',
    INSTALL = 'INSTALL',
}

export enum ExtensionState {
    OBSOLETE = 'OBSOLETE',
    UPDATING = 'UPDATING',
    UNINSTALLING = 'UNINSTALLING',
    INSTALLING = 'INSTALLING',
}

export type InstalledStates = ExtensionAction | ExtensionState;

export const InstalledState = { ...ExtensionAction, ...ExtensionState } as const;

export enum ExtensionGroupState {
    INSTALLED = 'INSTALLED',
    UPDATE_PENDING = 'UPDATE_PENDING',
    OBSOLETE = 'OBSOLETE',
}

export type TExtension = Pick<
    ExtensionType,
    | 'pkgName'
    | 'name'
    | 'lang'
    | 'versionCode'
    | 'versionName'
    | 'iconUrl'
    | 'repo'
    | 'isNsfw'
    | 'isInstalled'
    | 'isObsolete'
    | 'hasUpdate'
>;

export type GroupedExtensionsResult<KEY extends string = string> = [KEY, TExtension[]][];

export type GroupedByExtensionState = {
    [state in ExtensionGroupState]: TExtension[];
};

export type GroupedByLanguage = {
    [language: string]: TExtension[];
};

export type GroupedExtensions = GroupedByExtensionState & GroupedByLanguage;
