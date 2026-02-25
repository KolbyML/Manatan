/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import Link from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Stack from '@mui/material/Stack';
import { useColorScheme } from '@mui/material/styles';
import React, { useEffect } from 'react';
import { useAppThemeContext } from '@/features/theme/AppThemeContext.tsx';
import { Select } from '@/base/components/inputs/Select.tsx';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { NumberSetting } from '@/base/components/settings/NumberSetting.tsx';
import { I18nResourceCode, i18nResources } from '@/i18n';
import { languageCodeToName } from '@/base/utils/Languages.ts';
import { ThemeList } from '@/features/theme/components/ThemeList.tsx';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { MetadataThemeSettings, ThemeMode } from '@/features/theme/AppTheme.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { AppStorage } from '@/lib/storage/AppStorage.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { MANGA_GRID_WIDTH, SERVER_SETTINGS_METADATA_DEFAULT } from '@/features/settings/Settings.constants.ts';
import { MUI_THEME_MODE_KEY } from '@/lib/mui/MUI.constants.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { useNavigationSettings } from '@/features/navigation-bar/NavigationBar.hooks.ts';
import { NAVIGATION_BAR_ITEMS } from '@/features/navigation-bar/NavigationBar.constants.ts';

// Modern Setting Card
const SettingCard = ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <Paper
        variant="outlined"
        sx={{
            p: 2,
            mb: 2,
            borderRadius: 3,
            bgcolor: 'background.paper',
            borderColor: 'divider',
        }}
    >
        {title && (
            <Typography
                variant="subtitle2"
                sx={{ mb: 2, fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}
            >
                {title}
            </Typography>
        )}
        <Stack spacing={2}>{children}</Stack>
    </Paper>
);

// Modern Setting Item
const SettingItem = ({
    title,
    description,
    action,
    nested = false,
}: {
    title: React.ReactNode;
    description?: React.ReactNode;
    action: React.ReactNode;
    nested?: boolean;
}) => (
    <Box
        sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pl: nested ? 2 : 0,
        }}
    >
        <Box sx={{ flex: 1, pr: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {title}
            </Typography>
            {description && (
                <Typography variant="caption" sx={{ opacity: 0.7, display: 'block' }}>
                    {description}
                </Typography>
            )}
        </Box>
        <Box sx={{ flexShrink: 0 }}>{action}</Box>
    </Box>
);

export const Appearance = () => {
    const { t, i18n } = useTranslation();
    const { themeMode, setThemeMode, shouldUsePureBlackMode, setShouldUsePureBlackMode } = useAppThemeContext();
    const { mode, setMode } = useColorScheme();
    const actualThemeMode = (mode ?? themeMode) as ThemeMode;

    useEffect(() => {
        if (!mode && themeMode) {
            setMode(themeMode);
        }
    }, [mode, themeMode, setMode]);

    useAppTitle(t('settings.appearance.title'));

    const {
        settings: { mangaThumbnailBackdrop, mangaDynamicColorSchemes, mangaGridItemWidth },
        request: { loading, error, refetch },
    } = useMetadataServerSettings();

    const { defaultStartupPage, setDefaultStartupPage, visibleTabs, toggleTabVisibility } = useNavigationSettings();

    const updateMetadataSetting = createUpdateMetadataServerSettings<keyof MetadataThemeSettings>((e) =>
        makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
    );

    const isDarkMode = MediaQuery.getThemeMode(actualThemeMode) === ThemeMode.DARK;

    if (loading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('Appearance::refetch'))}
            />
        );
    }

    return (
        <Box sx={{ p: 2, pb: 4 }}>
            {/* Theme Section */}
            <SettingCard title={t('settings.appearance.theme.title')}>
                <SettingItem
                    title={t('settings.appearance.theme.mode')}
                    action={
                        <Select<ThemeMode>
                            value={actualThemeMode}
                            size="small"
                            onChange={(e) => {
                                const newMode = e.target.value as 'system' | 'light' | 'dark';
                                setThemeMode(newMode as ThemeMode);
                                setMode(newMode);
                                AppStorage.local.setItem(MUI_THEME_MODE_KEY, newMode, true);
                            }}
                            sx={{ minWidth: 120 }}
                        >
                            <MenuItem key={ThemeMode.SYSTEM} value={ThemeMode.SYSTEM}>
                                {t('global.label.system')}
                            </MenuItem>
                            <MenuItem key={ThemeMode.DARK} value={ThemeMode.DARK}>
                                {t('global.label.dark')}
                            </MenuItem>
                            <MenuItem key={ThemeMode.LIGHT} value={ThemeMode.LIGHT}>
                                {t('global.label.light')}
                            </MenuItem>
                        </Select>
                    }
                />

                <Box sx={{ mx: -2 }}>
                    <ThemeList />
                </Box>

                {isDarkMode && (
                    <SettingItem
                        title={t('settings.appearance.theme.pure_black_mode')}
                        action={
                            <Switch
                                checked={shouldUsePureBlackMode}
                                onChange={(_, enabled) => setShouldUsePureBlackMode(enabled)}
                            />
                        }
                    />
                )}
            </SettingCard>

            {/* Display Section */}
            <SettingCard title={t('global.label.display')}>
                <SettingItem
                    title={t('global.language.label.language')}
                    description={
                        <>
                            <span>{t('settings.label.language_description')} </span>
                            <Link
                                href="https://hosted.weblate.org/projects/kolbyml/manatan-webui"
                                target="_blank"
                                rel="noreferrer"
                            >
                                {t('global.language.title.weblate')}
                            </Link>
                        </>
                    }
                    action={
                        <Select
                            value={i18nResources.includes(i18n.language as I18nResourceCode) ? i18n.language : 'ja'}
                            size="small"
                            onChange={({ target: { value: language } }) =>
                                i18n.changeLanguage(language, (e) => {
                                    if (e) {
                                        makeToast(t('global.language.error.load'), 'error', getErrorMessage(e));
                                    }
                                })
                            }
                            sx={{ minWidth: 120 }}
                        >
                            {i18nResources.map((language) => (
                                <MenuItem key={language} value={language}>
                                    {languageCodeToName(language)}
                                </MenuItem>
                            ))}
                        </Select>
                    }
                />

                <Divider sx={{ opacity: 0.5 }} />

                <Box sx={{ px: 1 }}>
                    <NumberSetting
                        settingTitle={t('settings.label.manga_item_width')}
                        settingValue={`px: ${mangaGridItemWidth}`}
                        value={mangaGridItemWidth}
                        defaultValue={SERVER_SETTINGS_METADATA_DEFAULT.mangaGridItemWidth}
                        minValue={MANGA_GRID_WIDTH.min}
                        maxValue={MANGA_GRID_WIDTH.max}
                        stepSize={MANGA_GRID_WIDTH.step}
                        valueUnit="px"
                        showSlider
                        handleUpdate={(width) => updateMetadataSetting('mangaGridItemWidth', width)}
                    />
                </Box>

                <Divider sx={{ opacity: 0.5 }} />

                <SettingItem
                    title={t('settings.appearance.manga_thumbnail_backdrop.title')}
                    description={t('settings.appearance.manga_thumbnail_backdrop.description')}
                    action={
                        <Switch
                            checked={mangaThumbnailBackdrop}
                            onChange={(e) => updateMetadataSetting('mangaThumbnailBackdrop', e.target.checked)}
                        />
                    }
                />

                <SettingItem
                    title={t('settings.appearance.manga_dynamic_color_schemes.title')}
                    description={t('settings.appearance.manga_dynamic_color_schemes.description')}
                    action={
                        <Switch
                            checked={mangaDynamicColorSchemes}
                            onChange={(e) => updateMetadataSetting('mangaDynamicColorSchemes', e.target.checked)}
                        />
                    }
                />
            </SettingCard>

            {/* Navigation Section */}
            <SettingCard title="Navigation">
                <SettingItem
                    title="Default Startup Page"
                    description="Select the page to show when opening the app"
                    action={
                        <Select
                            value={defaultStartupPage}
                            size="small"
                            onChange={(e) => setDefaultStartupPage(e.target.value as string)}
                            sx={{ minWidth: 150 }}
                        >
                            {NAVIGATION_BAR_ITEMS.filter((item) => item.path !== AppRoutes.more.path).map((item) => (
                                <MenuItem key={item.path} value={item.path}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <item.IconComponent fontSize="small" />
                                        {t(item.title)}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    }
                />

                <Divider sx={{ opacity: 0.5 }} />

                <Typography variant="subtitle2" sx={{ mt: 1, fontWeight: 600 }}>
                    Visible Tabs
                </Typography>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: 1,
                        mt: 1,
                    }}
                >
                    {NAVIGATION_BAR_ITEMS.filter((item) => item.path !== AppRoutes.more.path).map((item) => (
                        <FormControlLabel
                            key={item.path}
                            control={
                                <Checkbox
                                    size="small"
                                    checked={visibleTabs.includes(item.path)}
                                    onChange={() => toggleTabVisibility(item.path)}
                                />
                            }
                            label={
                                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <item.IconComponent sx={{ fontSize: 18, opacity: 0.8 }} />
                                    {t(item.title)}
                                </Typography>
                            }
                        />
                    ))}
                </Box>
            </SettingCard>
        </Box>
    );
};
