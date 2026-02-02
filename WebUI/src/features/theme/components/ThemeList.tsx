/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import Stack from '@mui/material/Stack';
import { useMemo } from 'react';
import { appThemes } from '@/features/theme/services/AppThemes.ts';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { EmptyView } from '@/base/components/feedback/EmptyView.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { CreateThemeButton } from '@/features/theme/components/CreateThemeButton.tsx';
import { ThemePreview } from '@/features/theme/components/ThemePreview.tsx';
import { MetadataThemeSettings } from '@/features/theme/AppTheme.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';

export const ThemeList = () => {
    const { t } = useTranslation();

    const {
        settings: { customThemes },
        request: { loading, error, refetch },
    } = useMetadataServerSettings();

    const allThemes = useMemo(
        () => [
            ...appThemes,
            ...Object.values(customThemes).map((customTheme) => ({
                ...customTheme,
                getName: () => customTheme.id,
            })),
        ],
        [customThemes],
    );

    const updateCustomThemes = createUpdateMetadataServerSettings<keyof MetadataThemeSettings>((e) => {
        throw e;
    });

    if (loading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyView
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('ThemeList::refetch'))}
            />
        );
    }

    return (
        <Stack
            sx={{ flexDirection: 'row', flexWrap: 'no-wrap', alignItems: 'start', overflowX: 'auto', gap: 1, mx: 2 }}
        >
            <CreateThemeButton />
            {allThemes.map((theme) => (
                <ThemePreview
                    key={theme.id}
                    appTheme={theme}
                    onDelete={() => {
                        makeToast(t('settings.appearance.theme.delete.action', { theme: theme.getName() }), 'info');
                        updateCustomThemes(
                            'customThemes',
                            Object.fromEntries(Object.entries(customThemes).filter(([id]) => id !== theme.id)),
                        )
                            .then(() =>
                                makeToast(
                                    t('settings.appearance.theme.delete.success', { theme: theme.getName() }),
                                    'success',
                                ),
                            )
                            .catch((e) =>
                                makeToast(
                                    t('settings.appearance.theme.delete.failure', { theme: theme.getName() }),
                                    'error',
                                    getErrorMessage(e),
                                ),
                            );
                    }}
                />
            ))}
        </Stack>
    );
};
