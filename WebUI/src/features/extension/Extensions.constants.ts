/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    ExtensionAction,
    ExtensionGroupState,
    ExtensionState,
    InstalledState,
    InstalledStates,
} from '@/features/extension/Extensions.types.ts';
import { DefaultLanguage } from '@/base/utils/Languages.ts';
import { TranslationKey } from '@/base/Base.types.ts';

export const EXTENSION_ACTION_TO_STATE_MAP: { [action in ExtensionAction]: ExtensionState } = {
    [ExtensionAction.UPDATE]: ExtensionState.UPDATING,
    [ExtensionAction.UNINSTALL]: ExtensionState.UNINSTALLING,
    [ExtensionAction.INSTALL]: ExtensionState.INSTALLING,
} as const;

export const EXTENSION_ACTION_TO_NEXT_ACTION_MAP: { [action in ExtensionAction]: ExtensionAction } = {
    [ExtensionAction.UPDATE]: ExtensionAction.UNINSTALL,
    [ExtensionAction.UNINSTALL]: ExtensionAction.INSTALL,
    [ExtensionAction.INSTALL]: ExtensionAction.UNINSTALL,
} as const;

export const INSTALLED_STATE_TO_TRANSLATION_KEY_MAP: { [installedState in InstalledStates]: TranslationKey } = {
    [InstalledState.UNINSTALL]: 'extension.action.label.uninstall',
    [InstalledState.INSTALL]: 'extension.action.label.install',
    [InstalledState.UPDATE]: 'extension.action.label.update',
    [InstalledState.OBSOLETE]: 'extension.state.label.obsolete',
    [InstalledState.UPDATING]: 'extension.state.label.updating',
    [InstalledState.UNINSTALLING]: 'extension.state.label.uninstalling',
    [InstalledState.INSTALLING]: 'extension.state.label.installing',
} as const;

export const EXTENSION_ACTION_TO_FAILURE_TRANSLATION_KEY_MAP: {
    [action in ExtensionAction]: TranslationKey;
} = {
    [ExtensionAction.UPDATE]: 'extension.label.update_failed',
    [ExtensionAction.INSTALL]: 'extension.label.installation_failed',
    [ExtensionAction.UNINSTALL]: 'extension.label.uninstallation_failed',
};

export const extensionLanguageToTranslationKey: { [state in ExtensionGroupState | DefaultLanguage]: TranslationKey } = {
    [ExtensionGroupState.INSTALLED]: 'extension.state.label.installed',
    [ExtensionGroupState.UPDATE_PENDING]: 'extension.state.label.update_pending',
    [ExtensionGroupState.OBSOLETE]: 'extension.state.label.obsolete',
    [DefaultLanguage.ALL]: 'extension.language.all',
    [DefaultLanguage.OTHER]: 'extension.language.other',
    [DefaultLanguage.LOCAL_SOURCE]: 'extension.language.other',
    [DefaultLanguage.PINNED]: 'global.label.pinned',
    [DefaultLanguage.LAST_USED_SOURCE]: 'global.label.last_used',
};
