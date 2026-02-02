/*
 * Copyright (C) Contributors to the Manatan project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { HttpMethod } from '@/lib/requests/client/RestClient.ts';

type EpisodeVideo = {
    videoTitle: string;
    resolution?: number | null;
    preferred: boolean;
};

type Props = {
    open: boolean;
    animeId: number;
    episodeIndex: number;
    episodeName: string;
    onClose: () => void;
    onDownloaded: () => void;
};

export const EpisodeDownloadDialog = ({
    open,
    animeId,
    episodeIndex,
    episodeName,
    onClose,
    onDownloaded,
}: Props) => {
    const [videos, setVideos] = useState<EpisodeVideo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        let isMounted = true;
        setLoading(true);
        setError(null);

        requestManager
            .getClient()
            .fetcher(`/api/v1/anime/${animeId}/episode/${episodeIndex}/videos`)
            .then((response) => response.json())
            .then((data: EpisodeVideo[]) => {
                if (isMounted) {
                    setVideos(data ?? []);
                }
            })
            .catch((fetchError) => {
                if (isMounted) {
                    setError(fetchError?.message ?? 'Failed to load videos');
                }
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [open, animeId, episodeIndex]);

    const labelList = useMemo(
        () =>
            videos.map((video, index) => {
                const resolutionLabel = video.resolution ? ` • ${video.resolution}p` : '';
                const name = video.videoTitle?.trim() || `Video ${index + 1}`;
                const preferredLabel = video.preferred ? ' • Preferred' : '';
                return `${name}${resolutionLabel}${preferredLabel}`;
            }),
        [videos],
    );

    const handleDownload = async (videoIndex: number) => {
        setLoading(true);
        setError(null);
        try {
            await requestManager.getClient().fetcher(
                `/api/v1/anime/${animeId}/episode/${episodeIndex}/download/${videoIndex}`,
                {
                    httpMethod: HttpMethod.POST,
                    checkResponseIsJson: false,
                },
            );
            onDownloaded();
            onClose();
        } catch (downloadError: any) {
            setError(downloadError?.message ?? 'Failed to download video');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Download {episodeName}</DialogTitle>
            <DialogContent>
                {loading && (
                    <Stack alignItems="center" sx={{ py: 4 }}>
                        <CircularProgress size={24} />
                    </Stack>
                )}
                {!loading && error && (
                    <Typography variant="body2" color="error" sx={{ py: 2 }}>
                        {error}
                    </Typography>
                )}
                {!loading && !error && !videos.length && (
                    <Typography variant="body2" sx={{ py: 2 }}>
                        No videos available for download.
                    </Typography>
                )}
                {!loading && !error && !!videos.length && (
                    <List>
                        {videos.map((_, index) => (
                            <ListItemButton key={labelList[index]} onClick={() => handleDownload(index)}>
                                <ListItemText primary={labelList[index]} />
                            </ListItemButton>
                        ))}
                    </List>
                )}
            </DialogContent>
        </Dialog>
    );
};
