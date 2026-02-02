/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { t as translate } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { CheckboxContainer } from '@/base/components/inputs/CheckboxContainer.ts';
import { CheckboxInput } from '@/base/components/inputs/CheckboxInput.tsx';
import { GlobalUpdateSkipEntriesSettings, ServerSettings } from '@/features/settings/Settings.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { GLOBAL_UPDATE_SKIP_ENTRIES_TO_TRANSLATION } from '@/features/settings/Settings.constants.ts';

const getSkipMangasText = (settings: GlobalUpdateSkipEntriesSettings) => {
    const skipSettings: string[] = [];

    if (settings.excludeUnreadChapters) {
        skipSettings.push(translate(GLOBAL_UPDATE_SKIP_ENTRIES_TO_TRANSLATION.excludeUnreadChapters) as string);
    }

    if (settings.excludeNotStarted) {
        skipSettings.push(translate(GLOBAL_UPDATE_SKIP_ENTRIES_TO_TRANSLATION.excludeNotStarted) as string);
    }

    if (settings.excludeCompleted) {
        skipSettings.push(translate(GLOBAL_UPDATE_SKIP_ENTRIES_TO_TRANSLATION.excludeCompleted) as string);
    }

    const isNothingExcluded = !skipSettings.length;
    if (isNothingExcluded) {
        skipSettings.push(translate('global.label.none'));
    }

    return skipSettings.join(', ');
};

const extractSkipEntriesSettings = (serverSettings: ServerSettings): GlobalUpdateSkipEntriesSettings => ({
    excludeCompleted: serverSettings.excludeCompleted,
    excludeNotStarted: serverSettings.excludeNotStarted,
    excludeUnreadChapters: serverSettings.excludeUnreadChapters,
});

export const GlobalUpdateSettingsEntries = ({ serverSettings }: { serverSettings: ServerSettings }) => {
    const { t } = useTranslation();

    const globalUpdateSettings = extractSkipEntriesSettings(serverSettings);
    const [mutateSettings] = requestManager.useUpdateServerSettings();

    const [dialogSettings, setDialogSettings] = useState<GlobalUpdateSkipEntriesSettings>(
        globalUpdateSettings ?? ({} as GlobalUpdateSkipEntriesSettings),
    );
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const skipEntriesText = getSkipMangasText(globalUpdateSettings);

    const updateSettings = async () => {
        const didSettingsChange =
            globalUpdateSettings?.excludeCompleted !== dialogSettings.excludeCompleted ||
            globalUpdateSettings.excludeNotStarted !== dialogSettings.excludeNotStarted ||
            globalUpdateSettings.excludeUnreadChapters !== dialogSettings.excludeUnreadChapters;

        setIsDialogOpen(false);

        if (!didSettingsChange) {
            return;
        }

        try {
            await mutateSettings({ variables: { input: { settings: dialogSettings } } });
        } catch (e) {
            makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e));
        }
    };

    const closeDialog = () => {
        setDialogSettings(globalUpdateSettings ?? ({} as GlobalUpdateSkipEntriesSettings));
        setIsDialogOpen(false);
    };

    useEffect(() => {
        if (!globalUpdateSettings) {
            return;
        }

        setDialogSettings(globalUpdateSettings);
    }, [
        globalUpdateSettings?.excludeCompleted,
        globalUpdateSettings?.excludeNotStarted,
        globalUpdateSettings?.excludeUnreadChapters,
    ]);

    return (
        <>
            <ListItemButton onClick={() => setIsDialogOpen(true)}>
                <ListItemText
                    primary={t('library.settings.global_update.entries.title')}
                    secondary={skipEntriesText}
                    onClick={() => setIsDialogOpen(true)}
                />
            </ListItemButton>

            <Dialog open={isDialogOpen} onClose={closeDialog}>
                <DialogTitle>{t('library.settings.global_update.entries.title')}</DialogTitle>
                <DialogContent>
                    <CheckboxContainer>
                        {Object.entries(dialogSettings).map(([setting, value]) => (
                            <CheckboxInput
                                key={setting}
                                label={t(
                                    GLOBAL_UPDATE_SKIP_ENTRIES_TO_TRANSLATION[
                                        setting as keyof GlobalUpdateSkipEntriesSettings
                                    ],
                                )}
                                checked={value}
                                onChange={(_, checked) => {
                                    setDialogSettings({
                                        ...dialogSettings,
                                        [setting]: checked,
                                    });
                                }}
                            />
                        ))}
                    </CheckboxContainer>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDialog} color="primary">
                        {t('global.button.cancel')}
                    </Button>
                    <Button onClick={updateSettings} color="primary">
                        {t('global.button.ok')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};
