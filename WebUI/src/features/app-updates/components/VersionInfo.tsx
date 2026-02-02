/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { t as translate } from 'i18next';
import DownloadingIcon from '@mui/icons-material/Downloading';
import { UpdateState } from '@/lib/graphql/generated/graphql.ts';

export type BaseVersionInfoProps = {
    version: string;
    isCheckingForUpdate: boolean;
    isUpdateAvailable: boolean;
    updateCheckError: any;
    checkForUpdate: () => void;
};
export type LinkVersionInfoProps = {
    downloadAsLink: true;
    url: string;
};
export type TriggerVersionInfoProps = {
    triggerUpdate: () => void;
    updateState: UpdateState;
    progress: number;
};
export type VersionInfoProps =
    | (BaseVersionInfoProps & PropertiesNever<TriggerVersionInfoProps> & LinkVersionInfoProps)
    | (BaseVersionInfoProps & TriggerVersionInfoProps & PropertiesNever<LinkVersionInfoProps>);

const getUpdateCheckButtonIcon = (
    isLoading: boolean,
    isUpdateAvailable: boolean,
    updateState?: UpdateState,
    asLink: boolean = false,
) => {
    const isUpdateInProgress = updateState === UpdateState.Downloading;
    if (isUpdateInProgress) {
        return <DownloadingIcon />;
    }

    if (isLoading) {
        return <CircularProgress size={15} />;
    }

    const isRefreshRequired = !isUpdateAvailable || updateState === UpdateState.Error;
    if (isRefreshRequired) {
        return <RefreshIcon />;
    }

    return asLink ? <OpenInNewIcon /> : <DownloadIcon />;
};

const getUpdateCheckButtonText = (
    isLoading: boolean,
    isUpdateAvailable: boolean,
    error: any,
    updateState?: UpdateState,
    progress: number = 0,
) => {
    const isUpdating = updateState === UpdateState.Downloading;
    if (isUpdating) {
        return translate('global.update.label.updating', { progress });
    }

    const didUpdateFail = updateState === UpdateState.Error;
    if (didUpdateFail) {
        return translate('global.update.label.update_failure');
    }

    if (isLoading) {
        return translate('global.update.label.checking');
    }

    if (error) {
        return translate('global.update.label.check_failure');
    }

    if (isUpdateAvailable) {
        return translate('global.update.label.available');
    }

    return translate('global.update.label.up_to_date');
};

export const VersionInfo = ({
    version,
    isCheckingForUpdate,
    isUpdateAvailable,
    updateCheckError,
    checkForUpdate,
    triggerUpdate,
    updateState,
    progress,
    downloadAsLink,
    url,
}: VersionInfoProps) => {
    const isUpdateInProgress = updateState === UpdateState.Downloading;

    const onClick = () => {
        if (isUpdateInProgress) {
            return;
        }

        const shouldCheckForUpdate = !isUpdateAvailable || updateCheckError || updateState === UpdateState.Error;
        if (shouldCheckForUpdate) {
            checkForUpdate();
            return;
        }

        if (isUpdateAvailable) {
            triggerUpdate?.();
        }
    };

    return (
        <Stack
            sx={{
                alignItems: 'start',
            }}
        >
            <Typography component="span" variant="body2">
                {version}
            </Typography>
        </Stack>
    );
};


export const WebUIVersionInfo = () => {
    return (
        <Stack
            sx={{
                alignItems: 'start',
            }}
        >
            <Typography component="span" variant="body2">
                Bundled with Manatan
            </Typography>
        </Stack>
    );
};
