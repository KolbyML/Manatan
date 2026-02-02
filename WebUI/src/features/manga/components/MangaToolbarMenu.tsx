/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Label from '@mui/icons-material/Label';
import MoreHoriz from '@mui/icons-material/MoreHoriz';
import Refresh from '@mui/icons-material/Refresh';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { AwaitableComponent } from 'awaitable-component';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { MangaType } from '@/lib/graphql/generated/graphql.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { CategorySelect } from '@/features/category/components/CategorySelect.tsx';

interface IProps {
    manga: Pick<MangaType, 'id' | 'inLibrary' | 'sourceId' | 'title'>;
    onRefresh: () => any;
    refreshing: boolean;
}

export const MangaToolbarMenu = ({ manga, onRefresh, refreshing }: IProps) => {
    const { t } = useTranslation();

    const theme = useTheme();
    const isLargeScreen = useMediaQuery(theme.breakpoints.up('sm'));

    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClose = () => {
        setAnchorEl(null);
    };

    const openCategorySelection = () => {
        AwaitableComponent.show(CategorySelect, { mangaId: manga.id });
    };

    return (
        <>
            {isLargeScreen && (
                <>
                    <CustomTooltip title={t('manga.label.reload_from_source')} disabled={refreshing}>
                        <IconButton
                            onClick={() => {
                                onRefresh();
                            }}
                            disabled={refreshing}
                            color="inherit"
                        >
                            <Refresh />
                        </IconButton>
                    </CustomTooltip>
                    {manga.inLibrary && (
                        <>
                            <CustomTooltip title={t('global.button.migrate')}>
                                <Link
                                    to={AppRoutes.migrate.childRoutes.search.path(
                                        manga.sourceId,
                                        manga.id,
                                        manga.title,
                                    )}
                                    state={{ mangaTitle: manga.title }}
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                >
                                    <IconButton color="inherit">
                                        <SyncAltIcon />
                                    </IconButton>
                                </Link>
                            </CustomTooltip>
                            <CustomTooltip title={t('manga.label.edit_categories')}>
                                <IconButton
                                    onClick={() => {
                                        openCategorySelection();
                                    }}
                                    color="inherit"
                                >
                                    <Label />
                                </IconButton>
                            </CustomTooltip>
                        </>
                    )}
                </>
            )}
            {!isLargeScreen && (
                <>
                    <IconButton
                        id="chaptersMenuButton"
                        aria-controls={open ? 'chaptersMenu' : undefined}
                        aria-haspopup="true"
                        aria-expanded={open ? 'true' : undefined}
                        onClick={(e) => setAnchorEl(e.currentTarget)}
                        color="inherit"
                    >
                        <MoreHoriz />
                    </IconButton>
                    <Menu
                        id="chaptersMenu"
                        anchorEl={anchorEl}
                        open={open}
                        onClose={handleClose}
                        MenuListProps={{
                            'aria-labelledby': 'chaptersMenuButton',
                        }}
                    >
                        <MenuItem
                            onClick={() => {
                                onRefresh();
                                handleClose();
                            }}
                            disabled={refreshing}
                        >
                            <ListItemIcon>
                                <Refresh fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>{t('manga.label.reload_from_source')}</ListItemText>
                        </MenuItem>
                        {manga.inLibrary && [
                            <MenuItem
                                key="migrate"
                                component={Link}
                                to={AppRoutes.migrate.childRoutes.search.path(manga.sourceId, manga.id, manga.title)}
                                state={{ mangaTitle: manga.title }}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                                <ListItemIcon>
                                    <SyncAltIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText>{t('migrate.title')}</ListItemText>
                            </MenuItem>,
                            <MenuItem
                                key="categories"
                                onClick={() => {
                                    openCategorySelection();
                                    handleClose();
                                }}
                            >
                                <ListItemIcon>
                                    <Label fontSize="small" />
                                </ListItemIcon>
                                <ListItemText>{t('manga.label.edit_categories')}</ListItemText>
                            </MenuItem>,
                        ]}
                    </Menu>
                </>
            )}
        </>
    );
};
