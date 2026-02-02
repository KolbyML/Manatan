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
import { NumberSetting } from '@/base/components/settings/NumberSetting.tsx';
import { getPersistedServerSetting, usePersistedValue } from '@/base/hooks/usePersistedValue.tsx';
import { updateMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { MetadataDownloadSettings } from '@/features/downloads/Downloads.types.ts';
import { MetadataServerSettings } from '@/features/settings/Settings.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { DOWNLOAD_AHEAD } from '@/features/downloads/Downloads.constants.ts';

export const DownloadAheadSetting = ({
    downloadAheadLimit,
}: {
    downloadAheadLimit: MetadataServerSettings['downloadAheadLimit'];
}) => {
    const { t } = useTranslation();

    const shouldDownloadAhead = !!downloadAheadLimit;
    const [currentDownloadAheadLimit, persistDownloadAheadLimit] = usePersistedValue(
        'lastDownloadAheadLimit',
        DOWNLOAD_AHEAD.default,
        downloadAheadLimit,
        getPersistedServerSetting,
    );

    const updateSetting = (value: MetadataDownloadSettings['downloadAheadLimit']) => {
        persistDownloadAheadLimit(value === 0 ? currentDownloadAheadLimit : value);
        updateMetadataServerSettings('downloadAheadLimit', value).catch((e) =>
            makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
        );
    };

    const setDoAutoUpdates = (enable: boolean) => {
        const globalUpdateInterval = enable ? currentDownloadAheadLimit : 0;
        updateSetting(globalUpdateInterval);
    };

    return (
        <List>
            <ListItem>
                <ListItemText primary={t('download.settings.download_ahead.label.while_reading')} />
                <Switch edge="end" checked={shouldDownloadAhead} onChange={(e) => setDoAutoUpdates(e.target.checked)} />
            </ListItem>
            <NumberSetting
                settingTitle={t('download.settings.download_ahead.label.unread_chapters_to_download')}
                settingValue={t('download.settings.download_ahead.label.value', {
                    chapters: currentDownloadAheadLimit,
                    count: currentDownloadAheadLimit,
                })}
                value={currentDownloadAheadLimit}
                minValue={DOWNLOAD_AHEAD.min}
                maxValue={DOWNLOAD_AHEAD.max}
                defaultValue={DOWNLOAD_AHEAD.default}
                stepSize={DOWNLOAD_AHEAD.step}
                showSlider
                dialogDescription={t('download.settings.download_ahead.label.description')}
                dialogDisclaimer={t('download.settings.download_ahead.label.disclaimer')}
                valueUnit={t('chapter.title_one')}
                handleUpdate={updateSetting}
                disabled={!shouldDownloadAhead}
            />
        </List>
    );
};
