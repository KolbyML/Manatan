/*
 * Copyright (C) Contributors to the Manatan project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Link as RouterLink } from 'react-router-dom';
import { useCallback, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import PopupState, { bindMenu, bindTrigger } from 'material-ui-popup-state';
import { useLongPress } from 'use-long-press';
import { useTranslation } from 'react-i18next';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { TypographyMaxLines } from '@/base/components/texts/TypographyMaxLines.tsx';
import { ListCardAvatar } from '@/base/components/lists/cards/ListCardAvatar.tsx';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';
import { Menu } from '@/base/components/menu/Menu.tsx';
import { AnimeActionMenuItems } from '@/features/anime/components/AnimeActionMenuItems.tsx';
import { AnimeBadges } from '@/features/anime/components/AnimeBadges.tsx';

type AnimeCardData = {
    id: number;
    title: string;
    thumbnailUrl?: string | null;
    url?: string | null;
    inLibrary?: boolean;
};

type AnimeListCardProps = {
    anime: AnimeCardData;
    linkTo: string;
    mode?: 'default' | 'source';
    inLibraryIndicator?: boolean;
    selected?: boolean | null;
    onSelect?: (id: number, selected: boolean, isShiftKey?: boolean) => void;
    onLibraryChange?: (inLibrary: boolean) => void;
    onToggleLibrary: () => void;
};

export const AnimeListCard = ({
    anime,
    linkTo,
    mode = 'default',
    inLibraryIndicator,
    selected,
    onSelect,
    onLibraryChange,
    onToggleLibrary,
}: AnimeListCardProps) => {
    const { t } = useTranslation();
    const preventMobileContextMenu = MediaQuery.usePreventMobileContextMenu();
    const optionButtonRef = useRef<HTMLButtonElement>(null);
    const isSelecting = selected !== null && selected !== undefined;

    const handleClick = useCallback(
        (event: React.MouseEvent | React.TouchEvent) => {
            if (!isSelecting) {
                return;
            }
            event.preventDefault();
            onSelect?.(anime.id, !selected, event.shiftKey);
        },
        [isSelecting, onSelect, selected, anime.id],
    );

    const longPressBind = useLongPress(
        useCallback(
            (event: any, { context }: any) => {
                event.preventDefault();
                event.stopPropagation();
                if (mode === 'source') {
                    onToggleLibrary();
                    return;
                }
                if (isSelecting) {
                    onSelect?.(anime.id, !selected, event.shiftKey);
                    return;
                }
                (context as () => {})?.();
            },
            [mode, onToggleLibrary, isSelecting, onSelect, anime.id, selected],
        ),
    );

    return (
        <PopupState variant="popover" popupId="anime-list-card-action-menu">
            {(popupState) => (
                <>
                    <Card>
                        <CardActionArea
                            component={RouterLink}
                            to={linkTo}
                            onClick={handleClick}
                            {...longPressBind(() => popupState.open(optionButtonRef.current))}
                            onContextMenu={preventMobileContextMenu}
                            sx={{
                                ...MediaQuery.preventMobileContextMenuSx(),
                                '@media (hover: hover) and (pointer: fine)': {
                                    '&:hover .anime-option-button': {
                                        visibility: 'visible',
                                        pointerEvents: 'all',
                                    },
                                    '&:hover .source-anime-library-state-button': {
                                        display: mode === 'source' ? 'inline-flex' : 'none',
                                    },
                                    '&:hover .source-anime-library-state-indicator': {
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
                                    iconUrl={anime.thumbnailUrl ?? ''}
                                    alt={anime.title}
                                    slots={{
                                        spinnerImageProps: {
                                            imgStyle: {
                                                imageRendering: 'pixelated',
                                                filter:
                                                    mode === 'source' && inLibraryIndicator && anime.inLibrary
                                                        ? 'brightness(0.4)'
                                                        : undefined,
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
                                    <CustomTooltip title={anime.title} placement="top">
                                        <TypographyMaxLines variant="h6" component="h3">
                                            {anime.title}
                                        </TypographyMaxLines>
                                    </CustomTooltip>
                                </Box>
                                <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                                    {mode === 'source' ? (
                                        <AnimeBadges
                                            inLibraryIndicator={inLibraryIndicator}
                                            updateLibraryState={onToggleLibrary}
                                            isInLibrary={!!anime.inLibrary}
                                        />
                                    ) : null}
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
                                                        aria-label="more"
                                                    >
                                                        <MoreVertIcon />
                                                    </IconButton>
                                                </CustomTooltip>
                                            )}
                                        </>
                                    )}
                                </Stack>
                            </ListCardContent>
                        </CardActionArea>
                    </Card>
                    {mode !== 'source' && popupState.isOpen && (
                        <Menu {...bindMenu(popupState)}>
                            {(onClose) => (
                                <AnimeActionMenuItems
                                    anime={anime}
                                    onClose={onClose}
                                    onLibraryChange={onLibraryChange}
                                />
                            )}
                        </Menu>
                    )}
                </>
            )}
        </PopupState>
    );
};
