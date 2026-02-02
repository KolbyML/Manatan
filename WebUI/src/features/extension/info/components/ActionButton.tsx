/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';
import { INSTALLED_STATE_TO_TRANSLATION_KEY_MAP } from '@/features/extension/Extensions.constants.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { getInstalledState, updateExtension } from '@/features/extension/Extensions.utils.ts';
import { useBackButton } from '@/base/hooks/useBackButton.ts';
import { ExtensionAction, InstalledState, TExtension } from '@/features/extension/Extensions.types.ts';

export const ActionButton = ({ pkgName, isInstalled, isObsolete, hasUpdate }: TExtension) => {
    const handleBack = useBackButton();
    const { t } = useTranslation();

    const installedState = getInstalledState(isInstalled, isObsolete, hasUpdate);

    return (
        <Box sx={{ px: 1, flexGrow: 1, flexBasis: 0 }}>
            <Button
                sx={{
                    width: '100%',
                    color: installedState === InstalledState.OBSOLETE ? 'red' : 'inherit',
                }}
                variant="outlined"
                size="large"
                onClick={async () => {
                    const action = hasUpdate && !isObsolete ? ExtensionAction.UPDATE : ExtensionAction.UNINSTALL;

                    try {
                        await updateExtension(pkgName, isObsolete, action);

                        if (action === ExtensionAction.UNINSTALL) {
                            handleBack();
                        }
                    } catch (e) {
                        defaultPromiseErrorHandler('ExtensionInfo::ActionButton::onClick');
                    }
                }}
            >
                {t(INSTALLED_STATE_TO_TRANSLATION_KEY_MAP[installedState])}
            </Button>
        </Box>
    );
};
