/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { DownloadState } from '@/lib/graphql/generated/graphql.ts';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { ChapterIdInfo } from '@/features/chapter/Chapter.types.ts';
import { TranslationKey } from '@/base/Base.types.ts';

const DOWNLOAD_STATE_TO_TRANSLATION_KEY_MAP: { [state in DownloadState]: TranslationKey } = {
    DOWNLOADING: 'download.state.label.downloading',
    ERROR: 'download.state.label.error',
    FINISHED: 'download.state.label.finished',
    QUEUED: 'download.state.label.queued',
} as const;

export const DownloadStateIndicator = ({ chapterId, color }: { chapterId: ChapterIdInfo['id']; color?: string }) => {
    const { t } = useTranslation();

    const download = Chapters.useDownloadStatusFromCache(chapterId);

    if (!download) {
        return null;
    }

    const isDownloading = download.state === DownloadState.Downloading;
    const isPartiallyDownloaded = download.progress !== 0;

    const progress = `${Math.round(download.progress * 100)}%`;

    return (
        <Box
            sx={{
                position: 'relative',
                display: 'inline-flex',
                width: '50px',
                justifyContent: 'center',
            }}
        >
            {isDownloading && <CircularProgress variant="determinate" value={download.progress * 100} sx={{ color }} />}
            <Box
                sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Typography variant="caption" component="div" sx={{ color }}>
                    <>
                        {isDownloading && progress}
                        {!isDownloading &&
                            t('global.value', {
                                value: t(DOWNLOAD_STATE_TO_TRANSLATION_KEY_MAP[download.state]),
                                unit: isPartiallyDownloaded ? ` (${progress})` : '',
                            })}
                    </>
                </Typography>
            </Box>
        </Box>
    );
};
