/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { styled, Theme, TypographyVariant } from '@mui/material/styles';
import Typography, { TypographyProps } from '@mui/material/Typography';
import { shouldForwardProp } from '@/base/utils/ShouldForwardProp.ts';

const DEFAULT_LINE_HEIGHT = '1.5';

const getLineHeight = (theme: Theme, variant: TypographyProps['variant']): string => {
    if (variant === undefined) {
        return DEFAULT_LINE_HEIGHT;
    }

    if (!(variant in theme.typography)) {
        return DEFAULT_LINE_HEIGHT;
    }

    return theme.typography[variant as TypographyVariant].lineHeight?.toString() ?? DEFAULT_LINE_HEIGHT;
};

type TypographyMaxLinesProps = {
    lines?: number;
};

export const TypographyMaxLines = styled(Typography, {
    shouldForwardProp: shouldForwardProp<TypographyMaxLinesProps>(['lines']),
})<TypographyProps & TypographyMaxLinesProps>(({ variant, theme, lines = 2 }) => ({
    lineHeight: getLineHeight(theme, variant),
    display: '-webkit-box',
    WebkitLineClamp: `${lines}`,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    overflowWrap: 'break-word',
}));
