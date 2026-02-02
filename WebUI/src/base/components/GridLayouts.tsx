/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import React from 'react';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import { useTranslation } from 'react-i18next';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';

import { GridLayout } from '@/base/Base.types.ts';

// TODO: clean up this to use a FormControl, and remove dependency on name o radio button
export function GridLayouts({
    gridLayout,
    onChange,
}: {
    gridLayout: GridLayout;
    onChange: (gridLayout: GridLayout) => void;
}) {
    const { t } = useTranslation();

    const [anchorEl, setAnchorEl] = React.useState(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: any) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleSelection = (layout: GridLayout) => {
        onChange(layout);
        handleClose();
    };

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        onChange(parseInt(e.target.name, 10));
    }

    return (
        <>
            <CustomTooltip title={t('global.label.display')}>
                <IconButton
                    onClick={handleClick}
                    size="small"
                    aria-controls={open ? 'account-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={open ? 'true' : undefined}
                    color="inherit"
                >
                    <ViewModuleIcon />
                </IconButton>
            </CustomTooltip>
            <Menu
                id="basic-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                MenuListProps={{ 'aria-labelledby': 'basic-button' }}
            >
                <MenuItem onClick={() => handleSelection(GridLayout.Compact)}>
                    <FormControlLabel
                        label={t('global.grid_layout.label.compact_grid')}
                        value={GridLayout.Compact}
                        control={
                            <Radio
                                name={GridLayout.Compact.toString()}
                                checked={gridLayout === GridLayout.Compact}
                                onChange={handleChange}
                            />
                        }
                    />
                </MenuItem>
                <MenuItem onClick={() => handleSelection(GridLayout.Comfortable)}>
                    <FormControlLabel
                        label={t('global.grid_layout.label.comfortable_grid')}
                        control={
                            <Radio
                                name={GridLayout.Comfortable.toString()}
                                checked={gridLayout === GridLayout.Comfortable}
                                onChange={handleChange}
                            />
                        }
                    />
                </MenuItem>
                <MenuItem onClick={() => handleSelection(GridLayout.List)}>
                    <FormControlLabel
                        label={t('global.grid_layout.label.list')}
                        control={
                            <Radio
                                name={GridLayout.List.toString()}
                                checked={gridLayout === GridLayout.List}
                                onChange={handleChange}
                            />
                        }
                    />
                </MenuItem>
            </Menu>
        </>
    );
}
