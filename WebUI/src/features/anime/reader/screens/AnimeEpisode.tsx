/*
 * Copyright (C) Contributors to the Manatan project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { AnimeVideoPlayer } from '@/features/anime/reader/components/AnimeVideoPlayer.tsx';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { useOCR } from '@/Manatan/context/OCRContext.tsx';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import {
    JimakuFileEntry,
    loadJimakuEpisodeFiles,
    loadJimakuTitleSuggestions,
    JimakuTitleSuggestion,
} from '@/features/anime/reader/services/jimaku.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';

type EpisodeResponse = {
    id: number;
    name: string;
    episodeNumber: number;
    summary?: string | null;
    index: number;
};

type VideoResponse = {
    videoTitle: string;
    resolution?: number | null;
    preferred: boolean;
    proxyUrl: string;
    videoUrl: string;
    isHls: boolean;
    subtitleTracks: Array<{ url: string; lang: string }>;
};

type AnimeInfoResponse = {
    id: number;
    title: string;
    anilistId?: number | null;
    anilist_id?: number | null;
};

type SubtitleTrack = {
    url: string;
    lang: string;
    label?: string;
    source?: 'video' | 'jimaku';
};

const normalizeVideoLabel = (label: string) =>
    label
        .replace(/\b\d{3,4}p\b/gi, '')
        .replace(/\b\d{3,4}x\d{3,4}\b/gi, '')
        .replace(/[^a-z0-9]+/gi, '')
        .toLowerCase();

export const AnimeEpisode = () => {
    const { t } = useTranslation();
    const { id, episodeIndex } = useParams<{ id: string; episodeIndex: string }>();
    const navigate = useNavigate();
    const theme = useTheme();
    const isTouchDevice = MediaQuery.useIsTouchDevice();
    const isNarrowScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const isMobile = isTouchDevice || isNarrowScreen;
    const { settings } = useOCR();
    const { setOverride } = useNavBarContext();
    const [animeTitle, setAnimeTitle] = useState<string | null>(null);
    const [animeAnilistId, setAnimeAnilistId] = useState<number | null>(null);
    const [savedVideoLabel, setSavedVideoLabel] = useLocalStorage<string | null>(
        `anime-${id ?? 'unknown'}-video-label`,
        null,
    );
    const [savedVideoKey, setSavedVideoKey] = useLocalStorage<string | null>(
        `anime-${id ?? 'unknown'}-video-key`,
        null,
    );
    const [jimakuTitleOverride, setJimakuTitleOverride] = useLocalStorage<string | null>(
        `anime-${id ?? 'unknown'}-jimaku-title-override`,
        null,
    );
    const [isJimakuTitleDialogOpen, setIsJimakuTitleDialogOpen] = useState(false);
    const [jimakuDraftTitle, setJimakuDraftTitle] = useState('');
    const [jimakuTitleSuggestions, setJimakuTitleSuggestions] = useState<JimakuTitleSuggestion[]>([]);
    const [jimakuSuggestionsLoading, setJimakuSuggestionsLoading] = useState(false);
    const [jimakuSuggestionValue, setJimakuSuggestionValue] = useState('');
    const [braveAudioFixMode, setBraveAudioFixMode] = useLocalStorage<'auto' | 'on' | 'off'>(
        `anime-${id ?? 'unknown'}-brave-audio-fix-mode`,
        'auto',
    );
    const [episode, setEpisode] = useState<EpisodeResponse | null>(null);
    const [episodeList, setEpisodeList] = useState<EpisodeResponse[]>([]);
    const [videos, setVideos] = useState<VideoResponse[]>([]);
    const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [videosLoading, setVideosLoading] = useState(true);
    const [refreshToken, setRefreshToken] = useState(0);
    const [videoRetryCount, setVideoRetryCount] = useState(0);
    const [jimakuFiles, setJimakuFiles] = useState<JimakuFileEntry[]>([]);
    const [jimakuReady, setJimakuReady] = useState(true);
    const lastVideoWarningRef = useRef<string | null>(null);
    const dialogContainer = typeof document !== 'undefined' ? document.fullscreenElement ?? undefined : undefined;
    const dialogZIndex =
        (typeof document !== 'undefined' && document.fullscreenElement) || isMobile
            ? theme.zIndex.modal + 400
            : undefined;

    useEffect(() => {
        if (!id || !episodeIndex) {
            setError('Missing anime episode info');
            setLoading(false);
            return;
        }


        let isMounted = true;
        const isRefresh = refreshToken > 0;
        const shouldForceFetch = isRefresh || videoRetryCount > 0;

        setError(null);
        if (!isRefresh) {
            setLoading(true);
        }

        const refreshQuery = shouldForceFetch ? `?onlineFetch=true&ts=${refreshToken}` : '';
        setVideosLoading(true);

        requestManager
            .getClient()
            .fetcher(`/api/v1/anime/${id}/episode/${episodeIndex}${refreshQuery}`)
            .then((response) => response.json())
            .then((episodeData: EpisodeResponse) => {
                if (isMounted) {
                    setEpisode(episodeData);
                }
            })
            .catch((fetchError) => {
                if (isMounted) {
                    setError(fetchError?.message ?? t('global.error.label.failed_to_load_data'));
                }
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                }
            });

        requestManager
            .getClient()
            .fetcher(`/api/v1/anime/${id}/episode/${episodeIndex}/videos${refreshQuery}`)
            .then((response) => response.json())
            .then((videosData: VideoResponse[]) => {
                if (!isMounted) {
                    return;
                }
                setVideos(videosData);
                if (videosData.length === 0 && videoRetryCount === 0) {
                    setVideoRetryCount(1);
                    setRefreshToken((prev) => prev + 1);
                }
            })
            .catch((fetchError) => {
                if (isMounted) {
                    setError(fetchError?.message ?? t('global.error.label.failed_to_load_data'));
                    if (videoRetryCount === 0) {
                        setVideoRetryCount(1);
                        setRefreshToken((prev) => prev + 1);
                    }
                }
            })
            .finally(() => {
                if (isMounted) {
                    setVideosLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [id, episodeIndex, refreshToken, t, videoRetryCount]);

    useEffect(() => {
        if (!id) {
            setEpisodeList([]);
            return;
        }
        let isMounted = true;
        requestManager
            .getClient()
            .fetcher(`/api/v1/anime/${id}/episodes`)
            .then((response) => response.json())
            .then((episodesData: EpisodeResponse[]) => {
                if (isMounted) {
                    setEpisodeList(episodesData);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setEpisodeList([]);
                }
            });
        return () => {
            isMounted = false;
        };
    }, [id]);

    useLayoutEffect(() => {
        setOverride({ status: true, value: <Box /> });
        return () => setOverride({ status: false, value: null });
    }, [setOverride]);

    useEffect(() => {
        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, []);

    useEffect(() => {
        if (!id) {
            setAnimeTitle(null);
            setAnimeAnilistId(null);
            return;
        }
        let isMounted = true;
        setAnimeTitle(null);
        setAnimeAnilistId(null);

        requestManager
            .getClient()
            .fetcher(`/api/v1/anime/${id}`)
            .then((response) => response.json())
            .then((animeData: AnimeInfoResponse) => {
                if (!isMounted) {
                    return;
                }
                setAnimeTitle(animeData?.title ?? null);
                const rawAnilistId = animeData?.anilistId ?? animeData?.anilist_id;
                const parsedAnilistId = rawAnilistId !== undefined && rawAnilistId !== null
                    ? Number(rawAnilistId)
                    : null;
                setAnimeAnilistId(Number.isFinite(parsedAnilistId) ? parsedAnilistId : null);
            })
            .catch((fetchError) => {
                console.warn('[AnimeEpisode] Failed to load anime info', fetchError);
            });

        return () => {
            isMounted = false;
        };
    }, [id]);

    useEffect(() => {
        setVideoRetryCount(0);
        setVideos([]);
        setSelectedVideoIndex(0);
        lastVideoWarningRef.current = null;
    }, [id, episodeIndex]);

    const episodeNumber = episode?.episodeNumber ?? episode?.index;
    const hasEpisodeNumber = episodeNumber !== undefined && episodeNumber !== null;
    const numericEpisodeNumber = hasEpisodeNumber ? Number(episodeNumber) : Number.NaN;
    const episodeTitle = episode?.name || (hasEpisodeNumber ? `Episode ${episodeNumber}` : 'Episode');
    const resolvedVideoIndex = videos.length
        ? Math.min(Math.max(selectedVideoIndex, 0), videos.length - 1)
        : 0;
    const currentVideo = videos[resolvedVideoIndex];
    const isLikelyHlsUrl = (url?: string | null) => Boolean(url && /m3u8?/i.test(url));
    const isHlsSource = Boolean(
        currentVideo?.isHls ||
            isLikelyHlsUrl(currentVideo?.proxyUrl) ||
            isLikelyHlsUrl(currentVideo?.videoUrl),
    );
    const proxyBaseUrl = currentVideo?.proxyUrl
        ? currentVideo.proxyUrl.startsWith('http')
            ? currentVideo.proxyUrl
            : currentVideo.proxyUrl.startsWith('/api')
                ? `${requestManager.getBaseUrl()}${currentVideo.proxyUrl}`
                : `${requestManager.getBaseUrl()}/${currentVideo.proxyUrl}`
        : '';
    const baseUrl = requestManager.getBaseUrl();
    const isDirectVideo = proxyBaseUrl.startsWith('http') && !proxyBaseUrl.startsWith(baseUrl);
    const playlistSrc = !isDirectVideo && isHlsSource && id && episodeIndex
        ? `${requestManager.getBaseUrl()}/api/v1/anime/${id}/episode/${episodeIndex}/video/${resolvedVideoIndex}/playlist`
        : null;
    const videoSrc = playlistSrc ?? proxyBaseUrl ?? '';
    const enableBraveAudioFix = Boolean(videoSrc && isHlsSource);
    const videoLabel = useMemo(
        () =>
            videos.map((video, index) => {
                const resolutionLabel = video.resolution ? ` • ${video.resolution}p` : '';
                const name = video.videoTitle?.trim() || `Video ${index + 1}`;
                return `${name}${resolutionLabel}`;
            }),
        [videos],
    );
    const episodeOptions = useMemo(
        () =>
            [...episodeList]
                .sort((a, b) => a.index - b.index)
                .map((episodeItem) => {
                    const number = episodeItem.episodeNumber ?? episodeItem.index;
                    const label = episodeItem.name?.trim() || `Episode ${number}`;
                    return {
                        index: episodeItem.index,
                        label,
                    };
                }),
        [episodeList],
    );
    const currentEpisodeIndex = episode?.index ?? (episodeIndex ? Number(episodeIndex) : null);
    const handleEpisodeSelect = (targetIndex: number) => {
        if (!id) {
            return;
        }
        navigate(AppRoutes.anime.childRoutes.episode.path(id, targetIndex));
    };

    useEffect(() => {
        if (!videos.length) {
            return;
        }

        if (savedVideoLabel || savedVideoKey) {
            const matchedIndex = savedVideoLabel
                ? videoLabel.findIndex((label) => label === savedVideoLabel)
                : -1;
            if (matchedIndex >= 0) {
                if (selectedVideoIndex !== matchedIndex) {
                    setSelectedVideoIndex(matchedIndex);
                }
                return;
            }

            const normalizedKey = savedVideoKey ?? (savedVideoLabel ? normalizeVideoLabel(savedVideoLabel) : null);
            if (normalizedKey) {
                const matchedByKey = videoLabel.findIndex(
                    (label) => normalizeVideoLabel(label) === normalizedKey,
                );
                if (matchedByKey >= 0) {
                    if (selectedVideoIndex !== matchedByKey) {
                        setSelectedVideoIndex(matchedByKey);
                    }
                    if (videoLabel[matchedByKey] !== savedVideoLabel) {
                        setSavedVideoLabel(videoLabel[matchedByKey]);
                    }
                    if (savedVideoKey !== normalizedKey) {
                        setSavedVideoKey(normalizedKey);
                    }
                    return;
                }
            }

            const warningLabel = savedVideoLabel ?? 'Selected video';
            if (lastVideoWarningRef.current !== warningLabel) {
                makeToast(`Video preset "${warningLabel}" is not available for this episode.`, 'warning');
                lastVideoWarningRef.current = warningLabel;
            }
        }

        const preferredIndex = videos.findIndex((video) => video.preferred);
        const fallbackIndex = preferredIndex >= 0 ? preferredIndex : 0;
        if (selectedVideoIndex !== fallbackIndex) {
            setSelectedVideoIndex(fallbackIndex);
        }
    }, [
        savedVideoKey,
        savedVideoLabel,
        selectedVideoIndex,
        setSavedVideoKey,
        setSavedVideoLabel,
        videoLabel,
        videos,
    ]);

    useEffect(() => {
        const apiKey = settings.jimakuApiKey?.trim();
        if (!apiKey) {
            setJimakuFiles([]);
            setJimakuReady(true);
            return;
        }

        const resolvedTitle = jimakuTitleOverride?.trim() || animeTitle;
        if (!resolvedTitle || !Number.isFinite(numericEpisodeNumber)) {
            setJimakuFiles([]);
            setJimakuReady(false);
            return;
        }

        let isMounted = true;
        setJimakuReady(false);
        const shouldUseAnilistId = !jimakuTitleOverride?.trim();
        loadJimakuEpisodeFiles({
            apiKey,
            title: resolvedTitle,
            anilistId: shouldUseAnilistId ? animeAnilistId : null,
            episodeNumber: numericEpisodeNumber,
        })
            .then((files) => {
                if (isMounted) {
                    setJimakuFiles(files);
                }
            })
            .catch((fetchError) => {
                console.warn('[AnimeEpisode] Jimaku subtitles unavailable', fetchError);
                if (isMounted) {
                    setJimakuFiles([]);
                }
            })
            .finally(() => {
                if (isMounted) {
                    setJimakuReady(true);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [settings.jimakuApiKey, jimakuTitleOverride, animeTitle, animeAnilistId, numericEpisodeNumber]);

    const openJimakuTitleDialog = useCallback(() => {
        const currentTitle = jimakuTitleOverride?.trim() || animeTitle || '';
        setJimakuDraftTitle(currentTitle);
        setJimakuSuggestionValue('');
        setIsJimakuTitleDialogOpen(true);
    }, [animeTitle, jimakuTitleOverride]);

    const closeJimakuTitleDialog = useCallback(() => {
        setIsJimakuTitleDialogOpen(false);
    }, []);

    const handleSaveJimakuTitle = useCallback(() => {
        const trimmed = jimakuDraftTitle.trim();
        setJimakuTitleOverride(trimmed ? trimmed : null);
        if (trimmed) {
            makeToast(`Jimaku title set to "${trimmed}".`, { variant: 'success', autoHideDuration: 1500 });
        } else {
            makeToast('Cleared Jimaku title override.', { variant: 'info', autoHideDuration: 1500 });
        }
        setIsJimakuTitleDialogOpen(false);
    }, [jimakuDraftTitle, setJimakuTitleOverride]);

    const handleResetJimakuTitle = useCallback(() => {
        setJimakuTitleOverride(null);
        setJimakuDraftTitle(animeTitle ?? '');
        setJimakuSuggestionValue('');
        makeToast('Cleared Jimaku title override.', { variant: 'info', autoHideDuration: 1500 });
        setIsJimakuTitleDialogOpen(false);
    }, [animeTitle, setJimakuTitleOverride]);

    const formatJimakuSuggestionLabel = useCallback((suggestion: JimakuTitleSuggestion) => {
        const baseTitle = suggestion.title;
        const entryName = suggestion.entry.name;
        if (!entryName || entryName === baseTitle) {
            return baseTitle;
        }
        return `${baseTitle} (${entryName})`;
    }, []);

    useEffect(() => {
        if (!isJimakuTitleDialogOpen) {
            return;
        }
        const apiKey = settings.jimakuApiKey?.trim();
        const queryTitle = animeTitle?.trim();
        if (!apiKey || !queryTitle) {
            setJimakuTitleSuggestions([]);
            return;
        }
        let isActive = true;
        setJimakuTitleSuggestions([]);
        setJimakuSuggestionsLoading(true);
        loadJimakuTitleSuggestions({
            apiKey,
            title: queryTitle,
            anilistId: animeAnilistId,
            limit: 20,
        })
            .then((entries) => {
                if (isActive) {
                    setJimakuTitleSuggestions(entries);
                }
            })
            .catch(() => {
                if (isActive) {
                    setJimakuTitleSuggestions([]);
                }
            })
            .finally(() => {
                if (isActive) {
                    setJimakuSuggestionsLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [isJimakuTitleDialogOpen, settings.jimakuApiKey, animeTitle, animeAnilistId]);

    const jimakuSubtitleTracks = useMemo<SubtitleTrack[]>(() => {
        const isSubtitleFile = (name: string) => /\.(srt|vtt|ass|ssa)$/i.test(name);
        return jimakuFiles
            .filter((file) => isSubtitleFile(file.name))
            .map((file) => ({
                url: file.url,
                lang: file.name,
                label: `Jimaku - ${file.name}`,
                source: 'jimaku',
            }));
    }, [jimakuFiles]);

    const combinedSubtitleTracks = useMemo<SubtitleTrack[]>(() => {
        const baseTracks = currentVideo?.subtitleTracks ?? [];
        return [
            ...baseTracks.map((track) => ({ ...track, source: 'video' as const })),
            ...jimakuSubtitleTracks,
        ];
    }, [currentVideo?.subtitleTracks, jimakuSubtitleTracks]);

    const subtitleTracksReady = jimakuReady;

    const handleVideoChange = (index: number) => {
        setSelectedVideoIndex(index);
        const label = videoLabel[index] ?? null;
        setSavedVideoLabel(label);
        if (label) {
            setSavedVideoKey(normalizeVideoLabel(label));
        }
    };

    useEffect(() => {
        if (error) {
            makeToast(getErrorMessage(error), 'error');
        }
    }, [error]);


    if (loading && !episode) {
        return <LoadingPlaceholder />;
    }

    if (!episode) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
            />
        );
    }

    const playerStatusMessage = videosLoading
        ? 'Loading videos…'
        : !videoSrc
            ? 'No videos available for this episode.'
            : null;

    const playerContent = (
        <AnimeVideoPlayer
            videoSrc={videoSrc}
            enableBraveAudioFix={enableBraveAudioFix}
            braveAudioFixMode={braveAudioFixMode}
            onBraveAudioFixModeChange={setBraveAudioFixMode}
            episodeOptions={episodeOptions}
            currentEpisodeIndex={currentEpisodeIndex}
            onEpisodeSelect={handleEpisodeSelect}
            isHlsSource={Boolean(videoSrc && isHlsSource)}
            videoOptions={videoLabel.map((label, index) => ({ label, index }))}
            selectedVideoIndex={resolvedVideoIndex}
            onVideoChange={handleVideoChange}
            subtitleTracks={combinedSubtitleTracks}
            subtitleTracksReady={subtitleTracksReady}
            jimakuTitleOverride={jimakuTitleOverride}
            onRequestJimakuTitleOverride={openJimakuTitleDialog}
            title={episodeTitle}
            animeId={id ?? 'unknown'}
            fillHeight
            showFullscreenButton={!isMobile}
            statusMessage={playerStatusMessage}
            onExit={() => {
                if (id) {
                    navigate(AppRoutes.anime.childRoutes.details.path(id), { replace: true });
                } else {
                    navigate(-1);
                }
            }}
        />
    );

    return (
        <Stack
            sx={{
                p: 0,
                gap: 0,
                minHeight: '100vh',
                height: '100vh',
                backgroundColor: 'black',
            }}
        >
            <Box
                sx={{
                    width: '100%',
                    backgroundColor: 'black',
                    minHeight: '100vh',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Box
                    sx={{
                        width: '100%',
                        maxWidth: '100%',
                        height: '100%',
                    }}
                >
                    {playerContent}
                </Box>
            </Box>
            <Dialog
                fullWidth
                maxWidth="xs"
                open={isJimakuTitleDialogOpen}
                onClose={closeJimakuTitleDialog}
                container={dialogContainer}
                sx={dialogZIndex ? { zIndex: dialogZIndex } : undefined}
                PaperProps={dialogZIndex ? { sx: { position: 'relative' } } : undefined}
            >
                <DialogTitle>Jimaku title</DialogTitle>
                <DialogContent>
                    <TextField
                        margin="dense"
                        label="Suggested titles"
                        fullWidth
                        select
                        value={jimakuSuggestionValue}
                        onChange={(event) => {
                            const value = event.target.value;
                            setJimakuSuggestionValue(value);
                            setJimakuDraftTitle(value);
                        }}
                        helperText={
                            jimakuSuggestionsLoading
                                ? 'Loading suggestions...'
                                : jimakuTitleSuggestions.length
                                    ? 'Select a suggestion to fill the title field.'
                                    : 'No suggestions found for this title.'
                        }
                        SelectProps={{
                            displayEmpty: true,
                            renderValue: (value) => (value ? String(value) : 'Select a title'),
                        }}
                        InputLabelProps={{ shrink: true }}
                    >
                        <MenuItem value="" disabled>
                            Select a title
                        </MenuItem>
                        {jimakuTitleSuggestions.map((suggestion) => (
                            <MenuItem key={suggestion.entry.id} value={suggestion.title}>
                                {formatJimakuSuggestionLabel(suggestion)}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Title"
                        fullWidth
                        value={jimakuDraftTitle}
                        onChange={(event) => {
                            setJimakuDraftTitle(event.target.value);
                            setJimakuSuggestionValue('');
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleResetJimakuTitle}>Reset</Button>
                    <Button onClick={closeJimakuTitleDialog}>Cancel</Button>
                    <Button onClick={handleSaveJimakuTitle} variant="contained">
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
};
