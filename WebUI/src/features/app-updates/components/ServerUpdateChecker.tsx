/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { useUpdateChecker } from '@/features/app-updates/hooks/useUpdateChecker.tsx';
import { VersionUpdateInfoDialog } from '@/features/app-updates/components/VersionUpdateInfoDialog.tsx';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { AppRoutes } from '@/base/AppRoute.constants.ts';

const disabledUpdateCheck = () => Promise.resolve();

export const ServerUpdateChecker = () => {
    const { t } = useTranslation();

    const [serverVersion, setServerVersion] = useLocalStorage<string>('serverVersion');
    const [open, setOpen] = useState(false);

    const {
        settings: { serverInformAvailableUpdate },
    } = useMetadataServerSettings();

    const {
        data: serverUpdateCheckData,
        loading: isCheckingForServerUpdate,
        error: serverUpdateCheckError,
        refetch: checkForUpdate,
    } = requestManager.useCheckForServerUpdate({
        notifyOnNetworkStatusChange: true,
        fetchPolicy: 'cache-only',
    });

    const { data } = requestManager.useGetAbout();
    const { aboutServer } = data ?? {};

    const selectedServerChannelInfo = serverUpdateCheckData?.checkForServerUpdates?.find(
        (channel) => channel.channel === aboutServer?.buildType,
    );
    const version = aboutServer ? aboutServer.version : undefined;
    const isServerUpdateAvailable = !!selectedServerChannelInfo?.tag && selectedServerChannelInfo.tag !== version;

    const updateChecker = useUpdateChecker(
        'server',
        serverInformAvailableUpdate ? checkForUpdate : disabledUpdateCheck,
        selectedServerChannelInfo?.tag,
    );

    const changelogUrl =
        aboutServer?.buildType.toLowerCase() === 'stable'
            ? `https://github.com/Suwayomi/Suwayomi-Server/releases/tag/${aboutServer.version}`
            : undefined;

    const isSameAsCurrent = !version || !serverVersion || serverVersion === version;

    const saveInitialVersion = !serverVersion && !!version;
    if (saveInitialVersion) {
        setServerVersion(version);
    }

    if (!isSameAsCurrent && !open) {
        setOpen(true);
    }

    if (isCheckingForServerUpdate) {
        return null;
    }

    if (serverUpdateCheckError) {
        return null;
    }

    if (isServerUpdateAvailable) {
        if (!serverInformAvailableUpdate) {
            return null;
        }

        const isAboutPage = window.location.pathname === AppRoutes.about.path;
        if (isAboutPage) {
            return null;
        }

        if (!updateChecker.handleUpdate) {
            return null;
        }

        return (
            <VersionUpdateInfoDialog
                info={t('global.update.label.info', {
                    channel: selectedServerChannelInfo.channel,
                    version: selectedServerChannelInfo.tag,
                })}
                actionTitle={t('global.button.download')}
                actionUrl={selectedServerChannelInfo.url}
                updateCheckerProps={['server', checkForUpdate, selectedServerChannelInfo?.tag]}
            />
        );
    }

    if (!open) {
        return null;
    }

    return (
        <Dialog open={open}>
            <DialogTitle>{t('settings.about.webui.label.updated')}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {t('global.update.label.update_success', {
                        name: t('settings.server.title.server'),
                        version,
                        channel: aboutServer?.buildType,
                    })}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                {changelogUrl && (
                    <Button href={changelogUrl} target="_blank" rel="noreferrer">
                        {t('global.button.changelog')}
                    </Button>
                )}
                <Button
                    onClick={() => {
                        setServerVersion(version);
                        setOpen(false);
                    }}
                    variant="contained"
                >
                    {t('global.button.ok')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
