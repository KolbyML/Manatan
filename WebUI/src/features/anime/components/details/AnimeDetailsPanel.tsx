/*
 * Copyright (C) Contributors to the Manatan project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ButtonGroup from '@mui/material/ButtonGroup';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Modal from '@mui/material/Modal';
import Link from '@mui/material/Link';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { styled } from '@mui/material/styles';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bindPopover, bindTrigger, usePopupState } from 'material-ui-popup-state/hooks';
import { SpinnerImage } from '@/base/components/SpinnerImage.tsx';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { CustomButtonIcon } from '@/base/components/buttons/CustomButtonIcon.tsx';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { IconBrowser } from '@/assets/icons/IconBrowser.tsx';
import { IconWebView } from '@/assets/icons/IconWebView.tsx';
import { MANGA_COVER_ASPECT_RATIO } from '@/features/manga/Manga.constants.ts';
import { Metadata as BaseMetadata } from '@/base/components/texts/Metadata.tsx';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { useResizeObserver } from '@/base/hooks/useResizeObserver.tsx';
import { CustomButton } from '@/base/components/buttons/CustomButton.tsx';

type AnimeDetailsResponse = {
    id: number;
    sourceId: string;
    url: string;
    title: string;
    thumbnailUrl?: string | null;
    backgroundUrl?: string | null;
    description?: string | null;
    genre?: string[] | null;
    artist?: string | null;
    author?: string | null;
    status?: string | null;
    inLibrary: boolean;
};

const DetailsWrapper = styled('div')(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(1),
    [theme.breakpoints.up('md')]: {
        flexBasis: '40%',
        height: 'calc(100vh - 64px)',
        overflowY: 'auto',
    },
}));

const TopContentWrapper = ({
    url,
    animeThumbnailBackdrop,
    children,
}: {
    url: string;
    animeThumbnailBackdrop: boolean;
    children: React.ReactNode;
}) => (
    <Stack sx={{ position: 'relative' }}>
        {animeThumbnailBackdrop && (
            <>
                <SpinnerImage
                    spinnerStyle={{ display: 'none' }}
                    imgStyle={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                    src={url}
                    alt="Anime Thumbnail"
                />
                <Stack
                    sx={{
                        '&::before': (theme) =>
                            applyStyles(animeThumbnailBackdrop, {
                                position: 'absolute',
                                display: 'inline-block',
                                content: '""',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                background: `linear-gradient(to top, ${theme.palette.background.default}, transparent 100%, transparent 1px),linear-gradient(to right, ${theme.palette.background.default}, transparent 50%, transparent 1px),linear-gradient(to bottom, ${theme.palette.background.default}, transparent 50%, transparent 1px),linear-gradient(to left, ${theme.palette.background.default}, transparent 50%, transparent 1px)`,
                                backdropFilter: 'blur(4.5px) brightness(0.75)',
                            }),
                    }}
                />
            </>
        )}
        {children}
    </Stack>
);

const ThumbnailMetadataWrapper = styled('div')(({ theme }) => ({
    display: 'flex',
    paddingBottom: theme.spacing(1),
}));

const MetadataContainer = styled('div')(({ theme }) => ({
    zIndex: 1,
    marginLeft: theme.spacing(1),
}));

const Metadata = (props: ComponentProps<typeof BaseMetadata>) => <BaseMetadata {...props} />;

const AnimeButtonsContainer = styled('div')(({ theme }) => ({
    display: 'flex',
    gap: theme.spacing(1),
}));

const OPEN_CLOSE_BUTTON_HEIGHT = '35px';
const DESCRIPTION_COLLAPSED_SIZE = 75;

const AnimeThumbnail = ({ thumbnailUrl, title }: { thumbnailUrl: string; title: string }) => {
    const popupState = usePopupState({ variant: 'popover', popupId: 'anime-thumbnail-fullscreen' });
    const [isImageReady, setIsImageReady] = useState(false);

    return (
        <>
            <Stack
                sx={{
                    position: 'relative',
                    borderRadius: 1,
                    overflow: 'hidden',
                    backgroundColor: 'background.paper',
                    width: '150px',
                    maxHeight: 'fit-content',
                    aspectRatio: MANGA_COVER_ASPECT_RATIO,
                    flexShrink: 0,
                    flexGrow: 0,
                }}
            >
                <SpinnerImage
                    src={thumbnailUrl}
                    alt={`${title} Thumbnail`}
                    onLoad={() => setIsImageReady(true)}
                    imgStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {isImageReady && (
                    <Stack
                        {...bindTrigger(popupState)}
                        sx={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            width: '100%',
                            justifyContent: 'center',
                            alignItems: 'center',
                            opacity: 0,
                            '&:hover': {
                                background: 'rgba(0, 0, 0, 0.4)',
                                cursor: 'pointer',
                                opacity: 1,
                            },
                        }}
                    >
                        <OpenInFullIcon fontSize="large" color="primary" />
                    </Stack>
                )}
            </Stack>
            <Modal {...bindPopover(popupState)} sx={{ outline: 0 }}>
                <Stack
                    onClick={() => popupState.close()}
                    sx={{ height: '100vh', p: 2, outline: 0, justifyContent: 'center', alignItems: 'center' }}
                >
                    <SpinnerImage
                        src={thumbnailUrl}
                        alt={`${title} Thumbnail`}
                        imgStyle={{ height: '100%', width: '100%', objectFit: 'contain' }}
                    />
                </Stack>
            </Modal>
        </>
    );
};

const OpenSourceButton = ({ url }: { url?: string | null }) => {
    const { t } = useTranslation();

    return (
        <ButtonGroup>
            <CustomTooltip title={t('global.button.open_browser')} disabled={!url}>
                <CustomButtonIcon
                    size="medium"
                    disabled={!url}
                    component={Link}
                    href={url ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    variant="outlined"
                >
                    <IconBrowser />
                </CustomButtonIcon>
            </CustomTooltip>
            <CustomTooltip title={t('global.button.open_webview')} disabled={!url}>
                <CustomButtonIcon
                    size="medium"
                    disabled={!url}
                    component={Link}
                    href={url ? requestManager.getWebviewUrl(url) : undefined}
                    target="_blank"
                    rel="noreferrer"
                    variant="outlined"
                >
                    <IconWebView />
                </CustomButtonIcon>
            </CustomTooltip>
        </ButtonGroup>
    );
};

const AnimeDescriptionGenre = ({
    description,
    genres,
}: {
    description?: string | null;
    genres: string[];
}) => {
    const [descriptionElement, setDescriptionElement] = useState<HTMLSpanElement | null>(null);
    const [descriptionHeight, setDescriptionHeight] = useState<number>();
    useResizeObserver(
        descriptionElement,
        useCallback(() => setDescriptionHeight(descriptionElement?.clientHeight), [descriptionElement]),
    );

    const [isCollapsed, setIsCollapsed] = useLocalStorage('isAnimeDescriptionGenreCollapsed', true);

    const collapsedSize = description
        ? Math.min(DESCRIPTION_COLLAPSED_SIZE, descriptionHeight ?? DESCRIPTION_COLLAPSED_SIZE)
        : 0;
    const genreList = useMemo(() => genres.filter(Boolean), [genres]);

    return (
        <>
            {description && (
                <Stack sx={{ position: 'relative' }}>
                    <Collapse collapsedSize={collapsedSize} in={!isCollapsed}>
                        <Typography
                            ref={setDescriptionElement}
                            sx={{
                                whiteSpace: 'pre-line',
                                textAlign: 'justify',
                                textJustify: 'inter-word',
                                mb: OPEN_CLOSE_BUTTON_HEIGHT,
                            }}
                        >
                            {description}
                        </Typography>
                    </Collapse>
                    <Stack
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        sx={{
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            cursor: 'pointer',
                            position: 'absolute',
                            width: '100%',
                            height: OPEN_CLOSE_BUTTON_HEIGHT,
                            bottom: 0,
                            background: (theme) =>
                                `linear-gradient(transparent -15px, ${theme.palette.background.default})`,
                        }}
                    >
                        <IconButton sx={{ color: (theme) => (theme.palette.mode === 'light' ? 'black' : 'text') }}>
                            {isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                        </IconButton>
                    </Stack>
                </Stack>
            )}
            <Stack
                sx={{
                    flexDirection: 'row',
                    flexWrap: isCollapsed ? 'no-wrap' : 'wrap',
                    gap: 1,
                    overflowX: isCollapsed ? 'auto' : null,
                }}
            >
                {genreList.map((genre) => (
                    <Chip key={genre} label={genre} variant="outlined" />
                ))}
            </Stack>
        </>
    );
};

export const AnimeDetailsPanel = ({
    anime,
    onToggleLibrary,
    isLibraryUpdating,
}: {
    anime: AnimeDetailsResponse;
    onToggleLibrary: (nextInLibrary: boolean) => void;
    isLibraryUpdating: boolean;
}) => {
    const { t } = useTranslation();
    const thumbnailSrc = anime.thumbnailUrl?.startsWith('http')
        ? anime.thumbnailUrl
        : anime.thumbnailUrl
          ? requestManager.getValidImgUrlFor(anime.thumbnailUrl)
          : '';
    const genres = anime.genre ?? [];
    const {
        settings: { mangaThumbnailBackdrop },
    } = useMetadataServerSettings();
    const { data: sourceData } = requestManager.useGetAnimeSourceBrowse(anime.sourceId ?? '-1', {
        skip: !anime.sourceId,
    });
    const sourceBaseUrl = sourceData?.animeSource?.baseUrl ?? null;
    const resolvedUrl = useMemo(() => {
        if (!anime.url) {
            return null;
        }
        if (anime.url.startsWith('http')) {
            return anime.url;
        }
        if (!sourceBaseUrl) {
            return null;
        }
        try {
            return new URL(anime.url, sourceBaseUrl).toString();
        } catch {
            return null;
        }
    }, [anime.url, sourceBaseUrl]);

    return (
        <DetailsWrapper>
            <TopContentWrapper url={thumbnailSrc} animeThumbnailBackdrop={mangaThumbnailBackdrop && !!thumbnailSrc}>
                <ThumbnailMetadataWrapper>
                    <AnimeThumbnail thumbnailUrl={thumbnailSrc} title={anime.title} />
                    <MetadataContainer>
                        <Stack sx={{ flexDirection: 'row', gap: 1, alignItems: 'flex-start', mb: 1 }}>
                            <Typography variant="h5" component="h2" sx={{ wordBreak: 'break-word' }}>
                                {anime.title}
                            </Typography>
                            <CustomTooltip title={t('global.button.copy')}>
                                <IconButton
                                    onClick={() => {
                                        navigator.clipboard
                                            .writeText(anime.title)
                                            .then(() => makeToast(t('global.label.copied_clipboard'), 'info'))
                                            .catch(() => {});
                                    }}
                                    color="inherit"
                                >
                                    <ContentCopyIcon fontSize="small" />
                                </IconButton>
                            </CustomTooltip>
                        </Stack>
                        {anime.author && <Metadata title={t('manga.label.author')} value={anime.author} />}
                        {anime.artist && <Metadata title={t('manga.label.artist')} value={anime.artist} />}
                        {anime.status && <Metadata title={t('manga.label.status')} value={anime.status} />}
                        {anime.sourceId && (
                            <Metadata
                                title={t('source.title_one')}
                                value={sourceData?.animeSource?.displayName ?? anime.sourceId}
                            />
                        )}
                    </MetadataContainer>
                </ThumbnailMetadataWrapper>
                <AnimeButtonsContainer>
                    <CustomButton
                        size="medium"
                        variant={anime.inLibrary ? 'contained' : 'outlined'}
                        onClick={() => onToggleLibrary(!anime.inLibrary)}
                        disabled={isLibraryUpdating}
                    >
                        {anime.inLibrary ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                        {anime.inLibrary ? t('manga.button.in_library') : t('manga.button.add_to_library')}
                    </CustomButton>
                    <OpenSourceButton url={resolvedUrl} />
                </AnimeButtonsContainer>
            </TopContentWrapper>
            <AnimeDescriptionGenre description={anime.description} genres={genres} />
        </DetailsWrapper>
    );
};
