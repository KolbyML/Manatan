/*
 * Copyright (C) Contributors to the Manatan project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import MoreVertIcon from '@mui/icons-material/MoreVert';
import CardActionArea from '@mui/material/CardActionArea';
import Checkbox from '@mui/material/Checkbox';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import { MouseEvent, TouchEvent, useRef } from 'react';
import { Link } from 'react-router-dom';
import PopupState, { bindMenu, bindTrigger } from 'material-ui-popup-state';
import { useLongPress } from 'use-long-press';
import { useTranslation } from 'react-i18next';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { getDateString } from '@/base/utils/DateHelper.ts';
import { EpisodeActionMenuItems } from '@/features/anime/components/actions/EpisodeActionMenuItems.tsx';
import { Menu } from '@/base/components/menu/Menu.tsx';
import { ChapterCardMetadata } from '@/features/chapter/components/cards/ChapterCardMetadata.tsx';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent.tsx';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';

type Episode = {
    id: number;
    name: string;
    episodeNumber: number;
    uploadDate: number;
    index: number;
    sourceOrder?: number | null;
    isRead: boolean;
    isDownloaded: boolean;
    realUrl?: string | null;
};

type Props = {
    animeId: string;
    episode: Episode;
    selected: boolean | null;
    onSelect: (episodeId: number, selected: boolean, isShiftKey?: boolean) => void;
    onDownload: () => void;
    onDeleteDownload: () => void;
    onMarkWatched: () => void;
    onMarkUnwatched: () => void;
    onMarkPreviousWatched: () => void;
};

export const EpisodeCard = ({
    animeId,
    episode,
    selected,
    onSelect,
    onDownload,
    onDeleteDownload,
    onMarkWatched,
    onMarkUnwatched,
    onMarkPreviousWatched,
}: Props) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const preventMobileContextMenu = MediaQuery.usePreventMobileContextMenu();
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const isSelecting = selected !== null;

    const episodeNumber = episode.episodeNumber || episode.index;
    const title = episode.name || `Episode ${episodeNumber}`;
    const secondaryText = episode.name ? `Episode ${episodeNumber}` : null;
    const ternaryText = `${getDateString(Number(episode.uploadDate ?? 0), true)}${
        episode.isDownloaded ? ' • Downloaded' : ''
    }`;

    const handleClick = (event: MouseEvent | TouchEvent) => {
        if (!isSelecting) return;
        event.preventDefault();
        event.stopPropagation();
        onSelect(episode.id, !selected, event.shiftKey);
    };

    const handleClickOpenMenu = (
        event: MouseEvent | TouchEvent,
        openMenu?: (e: React.SyntheticEvent) => void,
    ) => {
        event.stopPropagation();
        event.preventDefault();
        openMenu?.(event);
    };

    const longPressBind = useLongPress((event, { context: openMenu }) => {
        if (!isSelecting && !!menuButtonRef.current) {
            handleClickOpenMenu(event, () => (openMenu as (event: Element) => void)?.(menuButtonRef.current!));
            return;
        }
        // eslint-disable-next-line no-param-reassign
        event.shiftKey = true;
        handleClick(event);
    });

    return (
        <PopupState variant="popover" popupId="episode-card-action-menu">
            {(popupState) => (
                <Stack sx={{ pt: 1, px: 1 }}>
                    <Card>
                        <CardActionArea
                            component={Link}
                            to={AppRoutes.anime.childRoutes.episode.path(
                                animeId,
                                episode.sourceOrder ?? episode.index,
                            )}
                            onContextMenu={preventMobileContextMenu}
                            sx={MediaQuery.preventMobileContextMenuSx()}
                            style={{
                                color: theme.palette.text[episode.isRead ? 'disabled' : 'primary'],
                            }}
                            onClick={(e) => handleClick(e)}
                            {...longPressBind(popupState.open)}
                        >
                            <ListCardContent>
                                <ChapterCardMetadata
                                    title={title}
                                    secondaryText={secondaryText}
                                    ternaryText={ternaryText}
                                    slotProps={{
                                        title: {
                                            variant: 'h6',
                                            component: 'h3',
                                        },
                                    }}
                                />
                                <Stack sx={{ minHeight: '48px' }}>
                                    {selected === null ? (
                                        <CustomTooltip title={t('global.button.options')}>
                                            <IconButton
                                                ref={menuButtonRef}
                                                {...MUIUtil.preventRippleProp(bindTrigger(popupState), {
                                                    onClick: (e: MouseEvent) => handleClickOpenMenu(e),
                                                })}
                                                aria-label="more"
                                                sx={{ color: 'inherit' }}
                                            >
                                                <MoreVertIcon />
                                            </IconButton>
                                        </CustomTooltip>
                                    ) : (
                                        <CustomTooltip
                                            title={t(selected ? 'global.button.deselect' : 'global.button.select')}
                                        >
                                            <Checkbox checked={!!selected} />
                                        </CustomTooltip>
                                    )}
                                </Stack>
                            </ListCardContent>
                        </CardActionArea>
                    </Card>
                    {!isSelecting && popupState.isOpen && (
                        <Menu {...bindMenu(popupState)}>
                            {(onClose) => (
                                <EpisodeActionMenuItems
                                    onClose={onClose}
                                    episode={episode}
                                    onSelect={() => onSelect(episode.id, true)}
                                    onDownload={onDownload}
                                    onDeleteDownload={onDeleteDownload}
                                    onMarkWatched={onMarkWatched}
                                    onMarkUnwatched={onMarkUnwatched}
                                    onMarkPreviousWatched={onMarkPreviousWatched}
                                />
                            )}
                        </Menu>
                    )}
                </Stack>
            )}
        </PopupState>
    );
};
