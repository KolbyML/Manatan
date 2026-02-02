/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// adopted from: https://github.com/tachiyomiorg/tachiyomi/blob/master/app/src/main/java/eu/kanade/tachiyomi/widget/EmptyView.kt

import { type JSX, useMemo, useState } from 'react';
import Typography from '@mui/material/Typography';
import { SxProps, Theme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import { extractGraphqlExceptionInfo } from '@/lib/HelperFunctions.ts';

const ERROR_FACES = ['(･o･;)', 'Σ(ಠ_ಠ)', 'ಥ_ಥ', '(˘･_･˘)', '(；￣Д￣)', '(･Д･。'];

function getRandomErrorFace() {
    const randIndex = Math.floor(Math.random() * ERROR_FACES.length);
    return ERROR_FACES[randIndex];
}

export interface EmptyViewProps {
    message: string;
    messageExtra?: JSX.Element | string;
    retry?: () => void;
    noFaces?: boolean;
    sx?: SxProps<Theme>;
}

const ExtraMessage = ({ messageExtra }: Pick<EmptyViewProps, 'messageExtra'>) => {
    const { t } = useTranslation();

    const [showFullError, setShowFullError] = useState(false);

    const { isGraphqlException, graphqlError, graphqlStackTrace } = extractGraphqlExceptionInfo(messageExtra);

    if (!isGraphqlException) {
        return (
            <Typography
                variant="body1"
                sx={{ wordBreak: 'break-word', whiteSpace: 'pre-line', pointerEvents: 'all' }}
                color="textSecondary"
            >
                {messageExtra}
            </Typography>
        );
    }

    return (
        <>
            <Stack
                sx={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <Typography
                    variant="body1"
                    sx={{ wordBreak: 'break-word', whiteSpace: 'pre-line', pointerEvents: 'all' }}
                >
                    {graphqlError}…
                </Typography>
                <Button variant="text" onClick={() => setShowFullError(!showFullError)} sx={{ pointerEvents: 'all' }}>
                    {t(showFullError ? 'global.button.show_less' : 'global.button.show_more')}
                </Button>
            </Stack>
            <Collapse in={showFullError}>
                <Typography
                    variant="body1"
                    color="textSecondary"
                    sx={{ wordBreak: 'break-word', whiteSpace: 'pre-line', pointerEvents: 'all' }}
                >
                    {graphqlStackTrace}
                </Typography>
            </Collapse>
        </>
    );
};

export function EmptyView({ message, messageExtra, retry, noFaces, sx }: EmptyViewProps) {
    const { t } = useTranslation();

    const errorFace = useMemo(() => getRandomErrorFace(), []);

    return (
        <Stack
            sx={{
                p: 2,
                textAlign: 'center',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 'fill-available',
                maxWidth: '100%',
                minHeight: '100%',
                pointerEvents: 'none',
                ...sx,
            }}
        >
            {!noFaces && (
                <Typography variant="h3" gutterBottom sx={{ pointerEvents: 'all' }}>
                    {errorFace}
                </Typography>
            )}
            <Typography variant="h5" sx={{ wordBreak: 'break-word', whiteSpace: 'pre-line', pointerEvents: 'all' }}>
                {message}
            </Typography>
            <ExtraMessage messageExtra={messageExtra} />
            {retry && (
                <Button onClick={retry} sx={{ pointerEvents: 'all' }}>
                    {t('global.button.retry')}
                </Button>
            )}
        </Stack>
    );
}
