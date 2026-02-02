/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { BaseSyntheticEvent, ChangeEvent, useMemo, ForwardedRef } from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { PopupState } from 'material-ui-popup-state/hooks';
import { bindTrigger } from 'material-ui-popup-state';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { SelectableCollectionReturnType } from '@/base/collection/hooks/useSelectableCollection.ts';
import { MangaType } from '@/lib/graphql/generated/graphql.ts';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';

export const MangaOptionButton = ({
    id,
    selected,
    handleSelection,
    asCheckbox = false,
    popupState,
    ref,
}: {
    id: number;
    selected?: boolean | null;
    handleSelection?: SelectableCollectionReturnType<MangaType['id']>['handleSelection'];
    asCheckbox?: boolean;
    popupState: PopupState;
    ref?: ForwardedRef<HTMLButtonElement | null>;
}) => {
    const { t } = useTranslation();

    const bindTriggerProps = useMemo(() => bindTrigger(popupState), [popupState]);

    const preventDefaultAction = (e: BaseSyntheticEvent) => {
        e.stopPropagation();
        e.preventDefault();
    };

    const handleSelectionChange = (e: ChangeEvent, isSelected: boolean) => {
        preventDefaultAction(e);
        handleSelection?.(id, isSelected);
    };

    if (!handleSelection) {
        return null;
    }

    const isSelected = selected !== null;
    if (isSelected) {
        if (!asCheckbox) {
            return null;
        }

        return (
            <CustomTooltip title={t(selected ? 'global.button.deselect' : 'global.button.select')}>
                <Checkbox {...MUIUtil.preventRippleProp()} checked={selected} onChange={handleSelectionChange} />
            </CustomTooltip>
        );
    }

    if (asCheckbox) {
        return (
            <CustomTooltip title={t('global.button.options')}>
                <IconButton
                    ref={ref}
                    {...MUIUtil.preventRippleProp(bindTriggerProps, { onClick: preventDefaultAction })}
                    aria-label="more"
                >
                    <MoreVertIcon />
                </IconButton>
            </CustomTooltip>
        );
    }

    return (
        <CustomTooltip title={t('global.button.options')}>
            <Button
                ref={ref}
                {...MUIUtil.preventRippleProp(bindTriggerProps, { onClick: preventDefaultAction })}
                className="manga-option-button"
                size="small"
                variant="contained"
                sx={{
                    minWidth: 'unset',
                    paddingX: '0',
                    paddingY: '2.5px',
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
            </Button>
        </CustomTooltip>
    );
};
