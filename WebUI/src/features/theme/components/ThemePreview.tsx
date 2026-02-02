/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { styled, ThemeProvider, useTheme } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import { bindDialog, usePopupState } from 'material-ui-popup-state/hooks';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { useAppThemeContext } from '@/features/theme/AppThemeContext.tsx';
import { AppTheme } from '@/features/theme/services/AppThemes.ts';
import { createTheme } from '@/features/theme/services/ThemeCreator.ts';
import { ThemeCreationDialog } from '@/features/theme/components/CreateThemeDialog.tsx';
import { makeToast } from '@/base/utils/Toast.ts';
import { TypographyMaxLines } from '@/base/components/texts/TypographyMaxLines.tsx';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { ThemeFontLoader } from '@/features/theme/services/ThemeFontLoader.ts';

const ThemePreviewBadge = styled(Box)(() => ({
    width: '15px',
    height: '20px',
}));

export const ThemePreview = ({ appTheme, onDelete }: { appTheme: AppTheme; onDelete: () => void }) => {
    const { getName } = appTheme;

    const { t } = useTranslation();
    const theme = useTheme();
    const { themeMode, setAppTheme, appTheme: activeAppTheme, shouldUsePureBlackMode } = useAppThemeContext();

    const popupState = usePopupState({ variant: 'popover', popupId: `theme-edit-dialog-${appTheme.id}` });

    const isSelected = appTheme.id === activeAppTheme;

    const muiTheme = useMemo(
        () => createTheme(themeMode, appTheme, shouldUsePureBlackMode),
        [appTheme, themeMode, shouldUsePureBlackMode],
    );

    return (
        <>
            <Stack
                sx={{
                    justifyContent: 'center',
                    alignItems: 'center',
                    minWidth: '150px',
                    maxWidth: '150px',
                    gap: 1,
                }}
            >
                <ThemeProvider theme={muiTheme}>
                    <Card
                        sx={{
                            width: '100%',
                            height: '225px',
                            position: 'relative',
                        }}
                    >
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                bottom: 0,
                                left: 0,
                                border: '4px solid',
                                borderColor: isSelected ? muiTheme.palette.primary.light : muiTheme.palette.grey['100'],
                                zIndex: 1,
                                pointerEvents: 'none',
                                borderRadius: 1,
                                ...theme.applyStyles('dark', {
                                    borderColor: isSelected
                                        ? muiTheme.palette.primary.light
                                        : muiTheme.palette.grey['900'],
                                }),
                            }}
                        />
                        <CardActionArea
                            sx={{
                                height: '100%',
                                backgroundColor: 'background.default',
                            }}
                            onClick={() => {
                                const needToLoadFonts = ThemeFontLoader.hasMissing(appTheme.muiTheme);
                                if (!needToLoadFonts) {
                                    setAppTheme(appTheme.id);
                                    return;
                                }

                                makeToast(t('settings.appearance.theme.select.fonts.loading'), 'info');
                                ThemeFontLoader.load(appTheme.muiTheme)
                                    .then(() => setAppTheme(appTheme.id))
                                    .catch((e) =>
                                        makeToast(
                                            t('settings.appearance.theme.select.fonts.error'),
                                            'error',
                                            getErrorMessage(e),
                                        ),
                                    );
                            }}
                        >
                            <Stack sx={{ height: '100%', m: 0 }}>
                                <Stack sx={{ height: '100%', gap: 2, p: 2 }}>
                                    <Stack
                                        sx={{
                                            maxHeight: '20px',
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: '65%',
                                                height: '20px',
                                                backgroundColor: 'primary.dark',
                                                borderRadius: 1,
                                            }}
                                        />
                                        <Stack
                                            sx={{
                                                alignItems: 'center',
                                                gap: 1,
                                                mt: -0.25,
                                            }}
                                        >
                                            {isSelected && (
                                                <CheckCircleIcon
                                                    sx={{
                                                        visibility: isSelected ? 'visible' : 'hidden',
                                                        color: 'primary.light',
                                                    }}
                                                />
                                            )}
                                            {!isSelected && appTheme.isCustom && (
                                                <IconButton
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        onDelete();
                                                    }}
                                                    component="div"
                                                    size="small"
                                                    sx={{ mt: -0.5 }}
                                                >
                                                    <CustomTooltip title={t('global.button.delete')}>
                                                        <DeleteIcon />
                                                    </CustomTooltip>
                                                </IconButton>
                                            )}
                                            {appTheme.isCustom && (
                                                <IconButton
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        popupState.open();
                                                    }}
                                                    component="div"
                                                    size="small"
                                                >
                                                    <CustomTooltip title={t('global.button.edit')}>
                                                        <EditIcon />
                                                    </CustomTooltip>
                                                </IconButton>
                                            )}
                                        </Stack>
                                    </Stack>
                                    <Box
                                        sx={{
                                            width: '55%',
                                            height: '65%',
                                            backgroundColor: 'background.paper',
                                            p: 1,
                                            borderRadius: 1,
                                        }}
                                    >
                                        <Stack
                                            sx={{
                                                width: 'max-content',
                                                flexDirection: 'row',
                                                overflow: 'hidden',
                                                borderRadius: 1,
                                            }}
                                        >
                                            <ThemePreviewBadge sx={{ backgroundColor: 'primary.main' }} />
                                            <ThemePreviewBadge sx={{ backgroundColor: 'secondary.main' }} />
                                        </Stack>
                                    </Box>
                                </Stack>
                                <Stack
                                    sx={{
                                        height: '25%',
                                        backgroundColor: 'background.paper',
                                        alignItems: 'center',
                                        flexDirection: 'row',
                                        gap: 2,
                                        p: 2,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            backgroundColor: 'primary.main',
                                        }}
                                    />
                                    <Box
                                        sx={{
                                            flexGrow: 1,
                                            height: '20px',
                                            borderRadius: 1,
                                            backgroundColor: 'primary.light',
                                        }}
                                    />
                                </Stack>
                            </Stack>
                        </CardActionArea>
                    </Card>
                </ThemeProvider>
                <CustomTooltip title={getName()} placement="top">
                    <TypographyMaxLines sx={{ maxWidth: '100%' }}>{getName()}</TypographyMaxLines>
                </CustomTooltip>
            </Stack>
            <ThemeCreationDialog bindDialogProps={bindDialog(popupState)} mode="edit" appTheme={appTheme} />
        </>
    );
};
