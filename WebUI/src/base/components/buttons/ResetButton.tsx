/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Button, { ButtonProps } from '@mui/material/Button';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';

type PropsIconButton = { asIconButton: true } & IconButtonProps;
type PropsButton = { asIconButton?: false } & ButtonProps;
type Props = PropsIconButton | PropsButton;

export const ResetButton = ({ asIconButton, ...props }: Props) => {
    const { t } = useTranslation();

    if (asIconButton) {
        return (
            <CustomTooltip title={t('global.button.reset')}>
                <IconButton color="inherit" {...props}>
                    <RestartAltIcon />
                </IconButton>
            </CustomTooltip>
        );
    }

    return (
        <Button startIcon={<RestartAltIcon />} {...(props as ButtonProps)}>
            {t('global.button.reset')}
        </Button>
    );
};
