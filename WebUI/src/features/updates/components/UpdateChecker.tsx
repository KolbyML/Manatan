/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import PopupState, { bindMenu, bindTrigger } from 'material-ui-popup-state';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ClearIcon from '@mui/icons-material/Clear';
import Stack from '@mui/material/Stack';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { Progress } from '@/base/components/feedback/Progress.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { dateTimeFormatter } from '@/base/utils/DateHelper.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';

import { CategoryIdInfo } from '@/features/category/Category.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';

let lastRunningState = false;

export function UpdateChecker({
    categoryId,
    handleFinishedUpdate,
}: {
    categoryId?: CategoryIdInfo['id'];
    handleFinishedUpdate?: () => void;
}) {
    const { t } = useTranslation();
    const isTouchDevice = MediaQuery.useIsTouchDevice();

    const [isHovered, setIsHovered] = useState(false);

    const { data: lastUpdateTimestampData, refetch: reFetchLastTimestamp } =
        requestManager.useGetLastGlobalUpdateTimestamp();
    const lastUpdateTimestamp = lastUpdateTimestampData?.lastUpdateTimestamp.timestamp;
    const { data: updaterData } = requestManager.useGetGlobalUpdateSummary();
    const status = updaterData?.libraryUpdateStatus;

    const isRunning = !!status?.jobsInfo.isRunning;
    const progress = status ? (status.jobsInfo.finishedJobs / status.jobsInfo.totalJobs) * 100 : 0;

    useEffect(() => {
        if (!lastRunningState && isRunning) {
            lastRunningState = true;
        }

        const isUpdateFinished = lastRunningState && progress === 100;
        if (!isUpdateFinished) {
            return;
        }

        lastRunningState = false;
        handleFinishedUpdate?.();
        // this re-fetch is necessary since a running update could have been triggered by the server or another client
        reFetchLastTimestamp().catch(defaultPromiseErrorHandler('UpdateChecker::reFetchLastTimestamp'));
    }, [isRunning]);

    const startUpdate = async (category?: CategoryIdInfo['id']) => {
        try {
            lastRunningState = true;
            await requestManager.startGlobalUpdate(category !== undefined ? [category] : undefined).response;
            reFetchLastTimestamp().catch(defaultPromiseErrorHandler('UpdateChecker::reFetchLastTimestamp'));
        } catch (e) {
            lastRunningState = false;
            makeToast(t('global.error.label.update_failed'), 'error', getErrorMessage(e));
        }
    };

    const stopUpdate = async () => {
        try {
            await requestManager.resetGlobalUpdate();
        } catch (e) {
            makeToast(t('library.error.label.stop_global_update'), 'error', getErrorMessage(e));
        }
    };

    const onClick = async (category?: CategoryIdInfo['id']) => {
        if (isRunning) {
            stopUpdate();
        } else {
            startUpdate(category);
        }
    };

    return (
        <PopupState variant="popover" popupId="library-update-checker-menu">
            {(popupState) => (
                <>
                    <CustomTooltip
                        title={
                            isRunning
                                ? t('library.action.label.stop_update')
                                : t('library.settings.global_update.label.last_update_tooltip', {
                                      date: lastUpdateTimestamp ? dateTimeFormatter.format(+lastUpdateTimestamp) : '-',
                                  })
                        }
                    >
                        <IconButton
                            sx={{ position: 'relative' }}
                            {...(categoryId !== undefined && !isRunning
                                ? bindTrigger(popupState)
                                : { onClick: () => onClick() })}
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                            color="inherit"
                        >
                            {!isRunning ? (
                                <RefreshIcon />
                            ) : (
                                <>
                                    <ClearIcon sx={{ opacity: Number(isTouchDevice || isHovered) }} />
                                    <Stack sx={{ position: 'absolute' }}>
                                        <Progress
                                            progress={progress}
                                            showText={!isTouchDevice && !isHovered}
                                            progressProps={{ color: 'inherit' }}
                                        />
                                    </Stack>
                                </>
                            )}
                        </IconButton>
                    </CustomTooltip>
                    <Menu {...bindMenu(popupState)}>
                        <MenuItem
                            onClick={() => {
                                popupState.close();
                                onClick();
                            }}
                        >
                            {t('library.action.label.update_library')}
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                popupState.close();
                                onClick(categoryId);
                            }}
                        >
                            {t('library.action.label.update_category')}
                        </MenuItem>
                    </Menu>
                </>
            )}
        </PopupState>
    );
}
