/*
 * Copyright (C) Contributors to the Suwayomi project
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
import { styled } from '@mui/material/styles';
import { memo, useRef } from 'react';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { SpinnerImage } from '@/base/components/SpinnerImage.tsx';
import { MangaOptionButton } from '@/features/manga/components/MangaOptionButton.tsx';
import { Mangas } from '@/features/manga/services/Mangas.ts';
import { SpecificMangaCardProps } from '@/features/manga/Manga.types.ts';
import { TypographyMaxLines } from '@/base/components/texts/TypographyMaxLines.tsx';
import { MANGA_COVER_ASPECT_RATIO } from '@/features/manga/Manga.constants.ts';
import { GridLayout } from '@/base/Base.types.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';

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

export const MangaGridCard = memo(
    ({
        manga,
        longPressBind,
        popupState,
        handleClick,
        mangaLinkTo,
        selected,
        inLibraryIndicator,
        isInLibrary,
        gridLayout,
        handleSelection,
        continueReadingButton,
        mangaBadges,
        mode,
    }: SpecificMangaCardProps) => {
        const preventMobileContextMenu = MediaQuery.usePreventMobileContextMenu();
        const optionButtonRef = useRef<HTMLButtonElement>(null);

        const { id, title } = manga;

        return (
            <Link
                component={RouterLink}
                {...longPressBind(() => popupState.open(optionButtonRef.current))}
                onClick={handleClick}
                to={mangaLinkTo}
                state={Mangas.createLocationState(manga, mode)}
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
                            '&:hover .manga-option-button': {
                                visibility: 'visible',
                                pointerEvents: 'all',
                            },
                            '&:hover .source-manga-library-state-button': {
                                display: 'inline-flex',
                            },
                            '&:hover .source-manga-library-state-indicator': {
                                display: mode === 'source' ? 'none' : 'flex',
                            },
                        },
                    }}
                >
                    <Card
                        sx={{
                            // force standard aspect ratio of manga covers
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
                                alt={title}
                                src={Mangas.getThumbnailUrl(manga)}
                                imgStyle={
                                    inLibraryIndicator && isInLibrary
                                        ? {
                                              height: '100%',
                                              width: '100%',
                                              objectFit: 'cover',
                                              filter: 'brightness(0.4)',
                                          }
                                        : {
                                              height: '100%',
                                              width: '100%',
                                              objectFit: 'cover',
                                          }
                                }
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
                                {mangaBadges}
                                <MangaOptionButton
                                    ref={optionButtonRef}
                                    popupState={popupState}
                                    id={id}
                                    selected={selected}
                                    handleSelection={handleSelection}
                                />
                            </Stack>
                            <>
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
                                        <CustomTooltip title={title} placement="top">
                                            <TypographyMaxLines
                                                component="h3"
                                                sx={{
                                                    color: 'white',
                                                    textShadow: '0px 0px 3px #000000',
                                                }}
                                            >
                                                {title}
                                            </TypographyMaxLines>
                                        </CustomTooltip>
                                    )}
                                    {continueReadingButton}
                                </Stack>
                            </>
                        </CardActionArea>
                    </Card>
                    {gridLayout === GridLayout.Comfortable && (
                        <Stack sx={{ pb: 1 }}>
                            <CustomTooltip title={title} placement="top">
                                <TypographyMaxLines
                                    component="h3"
                                    sx={{
                                        color: (theme) =>
                                            selected ? theme.palette.primary.contrastText : 'text.primary',
                                        height: '3rem',
                                        pt: 0.5,
                                    }}
                                >
                                    {title}
                                </TypographyMaxLines>
                            </CustomTooltip>
                        </Stack>
                    )}
                </Box>
            </Link>
        );
    },
);
