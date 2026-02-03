/*
 * Copyright (C) Contributors to the Manatan project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Link from '@mui/material/Link';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Checkbox from '@mui/material/Checkbox';
import { styled } from '@mui/material/styles';
import PopupState, { bindMenu, bindTrigger } from 'material-ui-popup-state';
import { useLongPress } from 'use-long-press';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { SpinnerImage } from '@/base/components/SpinnerImage.tsx';
import { TypographyMaxLines } from '@/base/components/texts/TypographyMaxLines.tsx';
import { MANGA_COVER_ASPECT_RATIO } from '@/features/manga/Manga.constants.ts';
import { Menu } from '@/base/components/menu/Menu.tsx';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';
import { GridLayout } from '@/base/Base.types.ts';
import { AnimeActionMenuItems } from '@/features/anime/components/AnimeActionMenuItems.tsx';
import { AnimeBadges } from '@/features/anime/components/AnimeBadges.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';

const BottomGradient = styled('div')({
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: '30%',
    background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 100%)',
});

const BottomGradientDoubledDown = styled('div')({
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: '20%',
    background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 100%)',
});

type AnimeCardData = {
    id: number;
    title: string;
    thumbnailUrl?: string | null;
    url?: string | null;
    inLibrary?: boolean;
};

type AnimeGridCardProps = {
    anime: AnimeCardData;
    linkTo: string;
    onLibraryChange?: (inLibrary: boolean) => void;
    gridLayout?: GridLayout;
    mode?: 'default' | 'source';
    inLibraryIndicator?: boolean;
    selected?: boolean | null;
    onSelect?: (id: number, selected: boolean, isShiftKey?: boolean) => void;
};

export const AnimeGridCard = ({
    anime,
    linkTo,
    onLibraryChange,
    gridLayout = GridLayout.Compact,
    mode = 'default',
    inLibraryIndicator,
    selected,
    onSelect,
}: AnimeGridCardProps) => {
    const { t } = useTranslation();
    const preventMobileContextMenu = MediaQuery.usePreventMobileContextMenu();
    const optionButtonRef = useRef<HTMLButtonElement>(null);
    const [isInLibrary, setIsInLibrary] = useState(!!anime.inLibrary);

    useEffect(() => {
        setIsInLibrary(!!anime.inLibrary);
    }, [anime.inLibrary]);

    const handleToggleLibrary = async () => {
        const nextState = !isInLibrary;
        await requestManager.updateAnime(anime.id, { inLibrary: nextState }).response;
        setIsInLibrary(nextState);
        onLibraryChange?.(nextState);
    };

    const isSelecting = selected !== null && selected !== undefined;

    const longPressBind = useLongPress(
        useCallback(
            (event: any, { context }: any) => {
                event.preventDefault();
                event.stopPropagation();
                if (mode === 'source') {
                    handleToggleLibrary();
                    return;
                }
                if (isSelecting) {
                    onSelect?.(anime.id, !selected, event.shiftKey);
                    return;
                }
                (context as () => {})?.();
            },
            [mode, handleToggleLibrary, isSelecting, onSelect, anime.id, selected],
        ),
    );

    return (
        <PopupState variant="popover" popupId="anime-card-action-menu">
            {(popupState) => (
                <>
                    <Link
                        component={RouterLink}
                        {...longPressBind(() => popupState.open(optionButtonRef.current))}
                        onClick={(event) => {
                            if (isSelecting) {
                                event.preventDefault();
                                onSelect?.(anime.id, !selected, event.shiftKey);
                            }
                        }}
                        to={linkTo}
                        onContextMenu={preventMobileContextMenu}
                        sx={{
                            ...MediaQuery.preventMobileContextMenuSx(),
                            textDecoration: 'none',
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                m: 0.25,
                                outline: selected ? '4px solid' : undefined,
                                borderRadius: selected ? '1px' : undefined,
                                outlineColor: (theme) => theme.palette.primary.main,
                                backgroundColor: (theme) => (selected ? theme.palette.primary.main : undefined),
                                '@media (hover: hover) and (pointer: fine)': {
                                    '&:hover .anime-option-button': {
                                        visibility: 'visible',
                                        pointerEvents: 'all',
                                    },
                                    '&:hover .source-anime-library-state-button': {
                                        display: mode === 'source' ? 'inline-flex' : 'none',
                                    },
                                    '&:hover .source-anime-library-state-indicator': {
                                        display: mode === 'source' ? 'none' : 'flex',
                                    },
                                },
                            }}
                        >
                            <Card
                                sx={{
                                    aspectRatio: MANGA_COVER_ASPECT_RATIO,
                                    display: 'flex',
                                }}
                            >
                                <CardActionArea
                                    sx={{
                                        position: 'relative',
                                        height: '100%',
                                    }}
                                >
                                    <SpinnerImage
                                        alt={anime.title}
                                        src={anime.thumbnailUrl ?? ''}
                                        imgStyle={{
                                            height: '100%',
                                            width: '100%',
                                            objectFit: 'cover',
                                            filter:
                                                mode === 'source' && inLibraryIndicator && isInLibrary
                                                    ? 'brightness(0.4)'
                                                    : undefined,
                                        }}
                                        spinnerStyle={{
                                            display: 'grid',
                                            placeItems: 'center',
                                        }}
                                    />
                                    <Stack
                                        direction="row"
                                        sx={{
                                            alignItems: 'start',
                                            justifyContent: 'space-between',
                                            position: 'absolute',
                                            top: (theme) => theme.spacing(1),
                                            left: (theme) => theme.spacing(1),
                                            right: (theme) => theme.spacing(1),
                                        }}
                                    >
                                        {mode === 'source' ? (
                                            <AnimeBadges
                                                inLibraryIndicator={inLibraryIndicator}
                                                isInLibrary={isInLibrary}
                                                updateLibraryState={handleToggleLibrary}
                                            />
                                        ) : (
                                            <Box />
                                        )}
                                        {mode !== 'source' && (
                                            <>
                                                {isSelecting ? (
                                                    <CustomTooltip
                                                        title={t(
                                                            selected ? 'global.button.deselect' : 'global.button.select',
                                                        )}
                                                    >
                                                        <Checkbox checked={!!selected} />
                                                    </CustomTooltip>
                                                ) : (
                                                    <CustomTooltip title={t('global.button.options')}>
                                                        <IconButton
                                                            ref={optionButtonRef}
                                                            {...MUIUtil.preventRippleProp(bindTrigger(popupState), {
                                                                onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
                                                                    event.stopPropagation();
                                                                    event.preventDefault();
                                                                    popupState.open();
                                                                },
                                                            })}
                                                            className="anime-option-button"
                                                            size="small"
                                                            sx={{
                                                                minWidth: 'unset',
                                                                paddingX: 0,
                                                                paddingY: '2.5px',
                                                                backgroundColor: 'primary.main',
                                                                color: 'common.white',
                                                                '&:hover': {
                                                                    backgroundColor: 'primary.main',
                                                                },
                                                                visibility: popupState.isOpen ? 'visible' : 'hidden',
                                                                pointerEvents: 'none',
                                                                '@media not (pointer: fine)': {
                                                                    visibility: 'hidden',
                                                                    width: 0,
                                                                    height: 0,
                                                                    p: 0,
                                                                    m: 0,
                                                                },
                                                            }}
                                                        >
                                                            <MoreVertIcon />
                                                        </IconButton>
                                                    </CustomTooltip>
                                                )}
                                            </>
                                        )}
                                    </Stack>
                                    {gridLayout !== GridLayout.Comfortable && (
                                        <>
                                            <BottomGradient />
                                            <BottomGradientDoubledDown />
                                        </>
                                    )}
                                    <Stack
                                        direction="row"
                                        sx={{
                                            justifyContent: gridLayout !== GridLayout.Comfortable ? 'space-between' : 'end',
                                            alignItems: 'end',
                                            position: 'absolute',
                                            bottom: 0,
                                            width: '100%',
                                            p: 1,
                                            gap: 1,
                                        }}
                                    >
                                        {gridLayout !== GridLayout.Comfortable && (
                                            <CustomTooltip title={anime.title} placement="top">
                                                <TypographyMaxLines
                                                    component="h3"
                                                    sx={{
                                                        color: 'white',
                                                        textShadow: '0px 0px 3px #000000',
                                                    }}
                                                >
                                                    {anime.title}
                                                </TypographyMaxLines>
                                            </CustomTooltip>
                                        )}
                                    </Stack>
                                </CardActionArea>
                            </Card>
                            {gridLayout === GridLayout.Comfortable && (
                                <Stack sx={{ pb: 1 }}>
                                    <CustomTooltip title={anime.title} placement="top">
                                        <TypographyMaxLines
                                            component="h3"
                                            sx={{
                                                color: 'text.primary',
                                                height: '3rem',
                                                pt: 0.5,
                                            }}
                                        >
                                            {anime.title}
                                        </TypographyMaxLines>
                                    </CustomTooltip>
                                </Stack>
                            )}
                        </Box>
                    </Link>
                    {mode !== 'source' && popupState.isOpen && (
                        <Menu {...bindMenu(popupState)}>
                            {(onClose) => (
                                <AnimeActionMenuItems
                                    anime={{
                                        ...anime,
                                        inLibrary: isInLibrary,
                                    }}
                                    onClose={onClose}
                                        onLibraryChange={(nextState) => {
                                            setIsInLibrary(nextState);
                                            onLibraryChange?.(nextState);
                                        }}
                                    />
                            )}
                        </Menu>
                    )}
                </>
            )}
        </PopupState>
    );
};
