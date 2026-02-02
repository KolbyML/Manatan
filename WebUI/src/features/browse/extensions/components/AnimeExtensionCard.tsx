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
import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { ListCardAvatar } from '@/base/components/lists/cards/ListCardAvatar.tsx';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent.tsx';
import {
    ExtensionAction,
    ExtensionState,
    InstalledState,
    InstalledStates,
} from '@/features/extension/Extensions.types.ts';
import {
    EXTENSION_ACTION_TO_NEXT_ACTION_MAP,
    EXTENSION_ACTION_TO_STATE_MAP,
    INSTALLED_STATE_TO_TRANSLATION_KEY_MAP,
} from '@/features/extension/Extensions.constants.ts';
import { getInstalledState } from '@/features/extension/Extensions.utils.ts';
import { languageCodeToName } from '@/base/utils/Languages.ts';

export type AnimeExtensionInfo = {
    repo: string | null;
    apkName: string;
    iconUrl: string;
    name: string;
    pkgName: string;
    versionName: string;
    versionCode: number;
    lang: string;
    isNsfw: boolean;
    installed: boolean;
    hasUpdate: boolean;
    obsolete: boolean;
};

interface AnimeExtensionCardProps {
    extension: AnimeExtensionInfo;
    handleUpdate: () => void;
    showSourceRepo: boolean;
    forcedState?: ExtensionState;
}

export function AnimeExtensionCard(props: AnimeExtensionCardProps) {
    const { t } = useTranslation();

    const {
        extension: { name, lang, versionName, installed, hasUpdate, obsolete, pkgName, iconUrl, isNsfw, repo },
        handleUpdate,
        showSourceRepo,
        forcedState,
    } = props;

    const [localInstalledState, setInstalledState] = useState<InstalledStates>(
        getInstalledState(installed, obsolete, hasUpdate),
    );
    const installedState = forcedState ?? localInstalledState;

    useEffect(() => {
        setInstalledState(getInstalledState(installed, obsolete, hasUpdate));
    }, [installed, obsolete, hasUpdate]);

    const requestExtensionAction = async (action: ExtensionAction) => {
        const nextAction = EXTENSION_ACTION_TO_NEXT_ACTION_MAP[action];
        const state = EXTENSION_ACTION_TO_STATE_MAP[action];

        try {
            setInstalledState(state);
            const patch =
                action === ExtensionAction.INSTALL
                    ? { install: true }
                    : action === ExtensionAction.UPDATE
                      ? { update: true }
                      : { uninstall: true };
            await requestManager.updateAnimeExtension(pkgName, patch).response;
            setInstalledState(nextAction);
            handleUpdate();
        } catch (_) {
            setInstalledState(getInstalledState(installed, obsolete, hasUpdate));
        }
    };

    const handleButtonClick = () => {
        switch (installedState) {
            case ExtensionAction.INSTALL:
            case ExtensionAction.UPDATE:
            case ExtensionAction.UNINSTALL:
                requestExtensionAction(installedState);
                break;
            case ExtensionState.OBSOLETE:
                requestExtensionAction(ExtensionAction.UNINSTALL);
                break;
            default:
                break;
        }
    };

    return (
        <Card>
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
                        {installed ? `${languageCodeToName(lang)} ` : ''}
                        {versionName}
                        {isNsfw && (
                            <Typography variant="caption" color="error">
                                {' 18+'}
                            </Typography>
                        )}
                    </Typography>
                    {showSourceRepo && <Typography variant="caption">{repo}</Typography>}
                </Stack>
                <Button
                    variant="outlined"
                    sx={{
                        color: installedState === InstalledState.OBSOLETE ? 'red' : 'inherit',
                        flexShrink: 0,
                    }}
                    onClick={handleButtonClick}
                >
                    {t(INSTALLED_STATE_TO_TRANSLATION_KEY_MAP[installedState])}
                </Button>
            </ListCardContent>
        </Card>
    );
}
