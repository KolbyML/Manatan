/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { memo } from 'react';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { useGetOptionForDirection } from '@/features/theme/services/ThemeCreator.ts';
import { withPropsFrom } from '@/base/hoc/withPropsFrom.tsx';
import { ReaderService } from '@/features/reader/services/ReaderService.ts';

const BaseReaderExitButton = ({ exit }: { exit: ReturnType<typeof ReaderService.useExit> }) => {
    const { t } = useTranslation();
    const getOptionForDirection = useGetOptionForDirection();

    return (
        <CustomTooltip title={t('reader.button.exit')}>
            <IconButton sx={{ marginRight: 2 }} onClick={exit} color="inherit">
                {getOptionForDirection(<ArrowBack />, <ArrowForwardIcon />)}
            </IconButton>
        </CustomTooltip>
    );
};

export const ReaderExitButton = withPropsFrom(
    memo(BaseReaderExitButton),
    [() => ({ exit: ReaderService.useExit() })],
    ['exit'],
);
