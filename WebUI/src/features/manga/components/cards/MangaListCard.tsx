/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { Link as RouterLink } from 'react-router-dom';
import { memo, useRef } from 'react';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { TypographyMaxLines } from '@/base/components/texts/TypographyMaxLines.tsx';
import { SpecificMangaCardProps } from '@/features/manga/Manga.types.ts';
import { Mangas } from '@/features/manga/services/Mangas.ts';
import { MangaOptionButton } from '@/features/manga/components/MangaOptionButton.tsx';
import { ListCardAvatar } from '@/base/components/lists/cards/ListCardAvatar.tsx';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';

export const MangaListCard = memo(
    ({
        manga,
        longPressBind,
        popupState,
        handleClick,
        mangaLinkTo,
        selected,
        inLibraryIndicator,
        isInLibrary,
        handleSelection,
        continueReadingButton,
        mangaBadges,
        mode,
    }: SpecificMangaCardProps) => {
        const preventMobileContextMenu = MediaQuery.usePreventMobileContextMenu();

        const optionButtonRef = useRef<HTMLButtonElement>(null);

        const { id, title } = manga;

        return (
            <Card>
                <CardActionArea
                    component={RouterLink}
                    to={mangaLinkTo}
                    state={Mangas.createLocationState(manga, mode)}
                    onClick={handleClick}
                    {...longPressBind(() => popupState.open(optionButtonRef.current))}
                    onContextMenu={preventMobileContextMenu}
                    sx={{
                        ...MediaQuery.preventMobileContextMenuSx(),
                        '@media (hover: hover) and (pointer: fine)': {
                            '&:hover .manga-option-button': {
                                visibility: 'visible',
                                pointerEvents: 'all',
                            },
                            '&:hover .source-manga-library-state-button': {
                                display: 'inline-flex',
                            },
                            '&:hover .source-manga-library-state-indicator': {
                                display: mode === 'source' ? 'none' : 'inline-flex',
                            },
                        },
                    }}
                >
                    <ListCardContent
                        sx={{
                            justifyContent: 'space-between',
                            position: 'relative',
                        }}
                    >
                        <ListCardAvatar
                            iconUrl={Mangas.getThumbnailUrl(manga)}
                            alt={manga.title}
                            slots={{
                                spinnerImageProps: {
                                    imgStyle: {
                                        imageRendering: 'pixelated',
                                        filter: inLibraryIndicator && isInLibrary ? 'brightness(0.4)' : undefined,
                                    },
                                },
                            }}
                        />
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'row',
                                flexGrow: 1,
                                width: 'min-content',
                            }}
                        >
                            <CustomTooltip title={title} placement="top">
                                <TypographyMaxLines variant="h6" component="h3">
                                    {title}
                                </TypographyMaxLines>
                            </CustomTooltip>
                        </Box>
                        <Stack
                            direction="row"
                            sx={{
                                alignItems: 'center',
                                gap: 0.5,
                            }}
                        >
                            {mangaBadges}
                            {continueReadingButton}
                            <MangaOptionButton
                                ref={optionButtonRef}
                                popupState={popupState}
                                id={id}
                                selected={selected}
                                handleSelection={handleSelection}
                                asCheckbox
                            />
                        </Stack>
                    </ListCardContent>
                </CardActionArea>
            </Card>
        );
    },
);
