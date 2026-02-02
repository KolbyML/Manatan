/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useDefaultReaderSettingsWithDefaultFlag } from '@/features/reader/settings/ReaderSettingsMetadata.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { IReaderSettings, ReadingMode } from '@/features/reader/Reader.types.ts';
import { ReaderService } from '@/features/reader/services/ReaderService.ts';
import { ReaderSettingsTabs } from '@/features/reader/settings/components/ReaderSettingsTabs.tsx';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';

export const GlobalReaderSettings = () => {
    const { t } = useTranslation();

    useAppTitle(t('reader.settings.title.reader'));

    const [activeTab, setActiveTab] = useState(0);

    const {
        settings,
        request: { loading, error, refetch },
    } = useDefaultReaderSettingsWithDefaultFlag();

    const updateSetting = <Setting extends keyof IReaderSettings>(
        key: Setting,
        value: IReaderSettings[Setting],
        commit?: boolean,
        profile?: ReadingMode,
    ) => {
        ReaderService.updateSetting(key, value, commit, true, profile);
    };

    if (loading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('DefaultReaderSettings::refetch'))}
            />
        );
    }

    return (
        <ReaderSettingsTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            areDefaultSettings
            settings={settings}
            updateSetting={(setting, value, commit, _, profile) => updateSetting(setting, value, commit, profile)}
            deleteSetting={(setting) => ReaderService.deleteSetting(setting, true)}
        />
    );
};
