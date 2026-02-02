/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import { useCallback } from 'react';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { NumberSetting } from '@/base/components/settings/NumberSetting.tsx';
import { getPersistedServerSetting, usePersistedValue } from '@/base/hooks/usePersistedValue.tsx';
import { makeToast } from '@/base/utils/Toast.ts';
import { ServerSettings } from '@/features/settings/Settings.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { WEB_UI_UPDATE_INTERVAL } from '@/features/settings/Settings.constants.ts';

export const WebUIUpdateIntervalSetting = ({
    disabled = false,
    updateCheckInterval,
}: {
    disabled?: boolean;
    updateCheckInterval: ServerSettings['webUIUpdateCheckInterval'];
}) => {
    const { t } = useTranslation();

    const shouldAutoUpdate = !!updateCheckInterval;
    const [mutateSettings] = requestManager.useUpdateServerSettings();
    const [currentUpdateCheckInterval, persistUpdateCheckInterval] = usePersistedValue(
        'lastUpdateCheckInterval',
        WEB_UI_UPDATE_INTERVAL.default,
        updateCheckInterval,
        getPersistedServerSetting,
    );

    const updateSetting = useCallback(
        (webUIUpdateCheckInterval: number) => {
            persistUpdateCheckInterval(
                webUIUpdateCheckInterval === 0 ? currentUpdateCheckInterval : webUIUpdateCheckInterval,
            );
            mutateSettings({ variables: { input: { settings: { webUIUpdateCheckInterval } } } }).catch((e) =>
                makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
            );
        },
        [currentUpdateCheckInterval],
    );

    const setDoAutoUpdates = (enable: boolean) => {
        const globalUpdateInterval = enable ? currentUpdateCheckInterval : 0;
        updateSetting(globalUpdateInterval);
    };

    return (
        <List>
            <ListItem>
                <ListItemText primary={t('settings.webui.auto_update.label.title')} />
                <Switch
                    disabled={disabled}
                    edge="end"
                    checked={shouldAutoUpdate}
                    onChange={(e) => setDoAutoUpdates(e.target.checked)}
                />
            </ListItem>
            <NumberSetting
                settingTitle={t('settings.webui.auto_update.label.interval')}
                settingValue={t('library.settings.global_update.auto_update.interval.label.value', {
                    hours: currentUpdateCheckInterval,
                })}
                value={currentUpdateCheckInterval}
                minValue={WEB_UI_UPDATE_INTERVAL.min}
                maxValue={WEB_UI_UPDATE_INTERVAL.max}
                defaultValue={WEB_UI_UPDATE_INTERVAL.default}
                showSlider
                valueUnit={t('global.time.hour_short')}
                handleUpdate={updateSetting}
                disabled={disabled || !shouldAutoUpdate}
            />
        </List>
    );
};
