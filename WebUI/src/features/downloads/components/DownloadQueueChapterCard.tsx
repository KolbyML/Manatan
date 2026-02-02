/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import DeleteIcon from '@mui/icons-material/Delete';
import DragHandle from '@mui/icons-material/DragHandle';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { ChapterDownloadRetryButton } from '@/features/chapter/components/buttons/ChapterDownloadRetryButton.tsx';
import { DownloadStateIndicator } from '@/base/components/downloads/DownloadStateIndicator.tsx';
import { ChapterCardMetadata } from '@/features/chapter/components/cards/ChapterCardMetadata.tsx';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent.tsx';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { DownloaderState } from '@/lib/graphql/generated/graphql.ts';
import { ChapterDownloadStatus, ChapterIdInfo } from '@/features/chapter/Chapter.types.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';

export const DownloadQueueChapterCard = memo(
    ({ item, status }: { item: ChapterDownloadStatus; status: DownloaderState }) => {
        const { t } = useTranslation();
        const preventMobileContextMenu = MediaQuery.usePreventMobileContextMenu();

        const handleDelete = useCallback(
            async (chapter: ChapterIdInfo) => {
                const isRunning = status === DownloaderState.Started;

                try {
                    if (isRunning) {
                        // required to stop before deleting otherwise the download kept going. Server issue?
                        await requestManager.stopDownloads().response;
                    }

                    await Promise.all([
                        // remove from download queue
                        requestManager.removeChapterFromDownloadQueue(chapter.id).response,
                        // delete partial download, should be handle server side?
                        // bug: The folder and the last image downloaded are not deleted
                        requestManager.deleteDownloadedChapter(chapter.id).response,
                    ]);
                } catch (e) {
                    makeToast(t('download.queue.error.label.failed_to_remove'), 'error', getErrorMessage(e));
                }

                if (!isRunning) {
                    return;
                }

                requestManager
                    .startDownloads()
                    .response.catch(defaultPromiseErrorHandler('DownloadQueue::startDownloads'));
            },
            [status],
        );

        return (
            <Box sx={{ p: 1, pb: 0 }}>
                <Card>
                    <CardActionArea
                        component={Link}
                        to={AppRoutes.manga.path(item.manga.id)}
                        onContextMenu={preventMobileContextMenu}
                        sx={MediaQuery.preventMobileContextMenuSx()}
                    >
                        <ListCardContent>
                            <IconButton {...MUIUtil.preventRippleProp()} sx={{ pointerEvents: 'none' }}>
                                <DragHandle />
                            </IconButton>
                            <ChapterCardMetadata title={item.manga.title} secondaryText={item.chapter.name} />
                            <DownloadStateIndicator chapterId={item.chapter.id} />
                            <ChapterDownloadRetryButton chapterId={item.chapter.id} />
                            <CustomTooltip title={t('chapter.action.download.delete.label.action')}>
                                <IconButton
                                    {...MUIUtil.preventRippleProp()}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDelete(item.chapter);
                                    }}
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </CustomTooltip>
                        </ListCardContent>
                    </CardActionArea>
                </Card>
            </Box>
        );
    },
);
