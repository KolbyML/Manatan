/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import { useTranslation } from 'react-i18next';
import {
    updateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { MutableListSetting } from '@/base/components/settings/MutableListSetting.tsx';
import { useDeviceContext } from '@/features/device/DeviceContext.tsx';
import { Select } from '@/base/components/inputs/Select.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { DEFAULT_DEVICE } from '@/features/device/services/Device.ts';
import { MetadataServerSettingKeys, MetadataServerSettings } from '@/features/settings/Settings.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';

export const DeviceSetting = () => {
    const { t } = useTranslation();

    useAppTitle(t('settings.device.title.device'));

    const {
        metadata,
        settings: { devices },
        loading,
        request: { error, refetch },
    } = useMetadataServerSettings();

    const { activeDevice, setActiveDevice } = useDeviceContext();

    const updateMetadataSetting = <Setting extends MetadataServerSettingKeys>(
        setting: Setting,
        value: MetadataServerSettings[Setting],
    ) => {
        if (!metadata) {
            return;
        }

        const wasActiveDeviceDeleted = setting === 'devices' && !(value as string[]).includes(activeDevice);
        if (wasActiveDeviceDeleted) {
            setActiveDevice(DEFAULT_DEVICE);
        }

        updateMetadataServerSettings(setting, value).catch((e) =>
            makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
        );
    };

    if (loading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('DeviceSetting::refetch'))}
            />
        );
    }

    return (
        <List sx={{ pt: 0 }}>
            <MutableListSetting
                settingName={t('settings.device.devices.label.title')}
                description={t('settings.device.devices.label.description')}
                handleChange={(deviceList) => {
                    updateMetadataSetting('devices', [
                        ...new Set(
                            [DEFAULT_DEVICE, ...deviceList].filter((device) => device !== t('global.label.default')),
                        ),
                    ]);
                }}
                valueInfos={devices.map((device) => [
                    device === DEFAULT_DEVICE ? t('global.label.default') : device,
                    { mutable: false, deletable: device !== DEFAULT_DEVICE },
                ])}
                addItemButtonTitle={t('global.button.create')}
                validateItem={(device) => device.length <= 16 && !!device.match(/^[a-zA-Z0-9\-_]+$/g)}
                placeholder={t('settings.device.label.placeholder')}
            />
            <ListItem>
                <ListItemText
                    primary={t('settings.device.active_device.label.title')}
                    secondary={t('settings.device.active_device.label.description')}
                />
                <Select value={activeDevice} onChange={({ target: { value: device } }) => setActiveDevice(device)}>
                    {devices.map((device) => (
                        <MenuItem key={device} value={device}>
                            {device === DEFAULT_DEVICE ? t('global.label.default') : device}
                        </MenuItem>
                    ))}
                </Select>
            </ListItem>
        </List>
    );
};
