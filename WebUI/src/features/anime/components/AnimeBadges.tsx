/*
 * Copyright (C) Contributors to the Manatan project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';

const BadgeContainer = styled('div')(({ theme }) => ({
    display: 'flex',
    height: 'fit-content',
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
}));

export const AnimeBadges = ({
    inLibraryIndicator,
    updateLibraryState,
    isInLibrary,
}: {
    inLibraryIndicator?: boolean;
    updateLibraryState: () => void;
    isInLibrary: boolean;
}) => {
    const { t } = useTranslation();
    const isTouchDevice = MediaQuery.useIsTouchDevice();

    return (
        <BadgeContainer>
            {!isTouchDevice && inLibraryIndicator && (
                <Button
                    className="source-anime-library-state-button"
                    component="div"
                    variant="contained"
                    size="small"
                    {...MUIUtil.preventRippleProp()}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        updateLibraryState();
                    }}
                    sx={{
                        display: 'none',
                    }}
                    color={isInLibrary ? 'error' : 'primary'}
                >
                    {t(isInLibrary ? 'manga.action.library.remove.label.action' : 'manga.button.add_to_library')}
                </Button>
            )}
            {inLibraryIndicator && isInLibrary && (
                <Typography
                    className="source-anime-library-state-indicator"
                    sx={{ backgroundColor: 'primary.dark', color: 'primary.contrastText', p: 0.3 }}
                >
                    {t('manga.button.in_library')}
                </Typography>
            )}
        </BadgeContainer>
    );
};
