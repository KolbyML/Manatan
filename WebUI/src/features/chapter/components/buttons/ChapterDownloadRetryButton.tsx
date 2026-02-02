/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Refresh from '@mui/icons-material/Refresh';
import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';
import { DownloadState } from '@/lib/graphql/generated/graphql.ts';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';
import { ChapterIdInfo } from '@/features/chapter/Chapter.types.ts';

export const ChapterDownloadRetryButton = ({ chapterId }: { chapterId: ChapterIdInfo['id'] }) => {
    const { t } = useTranslation();
    const download = Chapters.useDownloadStatusFromCache(chapterId);

    const handleRetry = async () => {
        try {
            await requestManager.addChapterToDownloadQueue(chapterId).response;
        } catch (e) {
            makeToast(t('download.queue.error.label.failed_to_retry'), 'error', getErrorMessage(e));
        }
    };

    if (download?.state !== DownloadState.Error) {
        return null;
    }

    return (
        <CustomTooltip title={t('global.button.retry')}>
            <IconButton
                {...MUIUtil.preventRippleProp()}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRetry();
                }}
            >
                <Refresh />
            </IconButton>
        </CustomTooltip>
    );
};
