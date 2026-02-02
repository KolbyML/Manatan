/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import IconButton from '@mui/material/IconButton';
import SettingsIcon from '@mui/icons-material/Settings';
import Stack from '@mui/material/Stack';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import {
    ExtensionAction,
    ExtensionState,
    InstalledState,
    InstalledStates,
    TExtension,
} from '@/features/extension/Extensions.types.ts';
import {
    EXTENSION_ACTION_TO_NEXT_ACTION_MAP,
    EXTENSION_ACTION_TO_STATE_MAP,
    INSTALLED_STATE_TO_TRANSLATION_KEY_MAP,
} from '@/features/extension/Extensions.constants.ts';
import { getInstalledState, updateExtension } from '@/features/extension/Extensions.utils.ts';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { ListCardAvatar } from '@/base/components/lists/cards/ListCardAvatar.tsx';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent.tsx';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';
import { OptionalCardActionAreaLink } from '@/base/components/lists/cards/OptionalCardActionAreaLink.tsx';
import { languageCodeToName } from '@/base/utils/Languages.ts';

interface IProps {
    extension: TExtension;
    handleUpdate: () => void;
    showSourceRepo: boolean;
    forcedState?: ExtensionState;
}

export function ExtensionCard(props: IProps) {
    const { t } = useTranslation();

    const {
        extension: { name, lang, versionName, isInstalled, hasUpdate, isObsolete, pkgName, iconUrl, isNsfw, repo },
        handleUpdate,
        showSourceRepo,
        forcedState,
    } = props;
    const [localInstalledState, setInstalledState] = useState<InstalledStates>(
        getInstalledState(isInstalled, isObsolete, hasUpdate),
    );
    const installedState = forcedState ?? localInstalledState;

    useEffect(() => {
        setInstalledState(getInstalledState(isInstalled, isObsolete, hasUpdate));
    }, [getInstalledState(isInstalled, isObsolete, hasUpdate)]);

    const requestExtensionAction = async (action: ExtensionAction): Promise<void> => {
        const nextAction = EXTENSION_ACTION_TO_NEXT_ACTION_MAP[action];
        const state = EXTENSION_ACTION_TO_STATE_MAP[action];

        try {
            setInstalledState(state);

            await updateExtension(pkgName, isObsolete, action);

            setInstalledState(nextAction);

            handleUpdate();
        } catch (_) {
            setInstalledState(getInstalledState(isInstalled, isObsolete, hasUpdate));
        }
    };

    function handleButtonClick() {
        switch (installedState) {
            case ExtensionAction.INSTALL:
            case ExtensionAction.UPDATE:
            case ExtensionAction.UNINSTALL:
                requestExtensionAction(installedState).catch(
                    defaultPromiseErrorHandler(`ExtensionCard:handleButtonClick(${installedState})`),
                );
                break;
            case ExtensionState.OBSOLETE:
                requestExtensionAction(ExtensionAction.UNINSTALL).catch(
                    defaultPromiseErrorHandler(`ExtensionCard:handleButtonClick(${installedState})`),
                );
                break;
            default:
                break;
        }
    }

    return (
        <Card>
            <OptionalCardActionAreaLink disabled={!isInstalled} to={AppRoutes.extension.childRoutes.info.path(pkgName)}>
                <ListCardContent>
                    <ListCardAvatar
                        iconUrl={requestManager.getValidImgUrlFor(iconUrl)}
                        alt={name}
                        slots={{
                            spinnerImageProps: {
                                ignoreQueue: true,
                            },
                        }}
                    />
                    <Stack
                        sx={{
                            justifyContent: 'center',
                            flexGrow: 1,
                            flexShrink: 1,
                            wordBreak: 'break-word',
                        }}
                    >
                        <Typography variant="h6" component="h3">
                            {name}
                        </Typography>
                        <Typography variant="caption">
                            {isInstalled ? `${languageCodeToName(lang)} ` : ''}
                            {versionName}
                            {isNsfw && (
                                <Typography variant="caption" color="error">
                                    {' 18+'}
                                </Typography>
                            )}
                        </Typography>
                        {showSourceRepo && <Typography variant="caption">{repo}</Typography>}
                    </Stack>
                    {isInstalled && (
                        <CustomTooltip title={t('settings.title')}>
                            <IconButton color="inherit" {...MUIUtil.preventRippleProp()}>
                                <SettingsIcon />
                            </IconButton>
                        </CustomTooltip>
                    )}
                    <Button
                        variant="outlined"
                        sx={{
                            color: installedState === InstalledState.OBSOLETE ? 'red' : 'inherit',
                            flexShrink: 0,
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            handleButtonClick();
                        }}
                    >
                        {t(INSTALLED_STATE_TO_TRANSLATION_KEY_MAP[installedState])}
                    </Button>
                </ListCardContent>
            </OptionalCardActionAreaLink>
        </Card>
    );
}
