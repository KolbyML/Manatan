/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { TextSetting } from '@/base/components/settings/text/TextSetting.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';

export const ServerAddressSetting = () => {
    const { t } = useTranslation();

    const [serverAddress, setServerAddress] = requestManager.useBaseUrl();

    const handleServerAddressChange = (address: string) => {
        const serverBaseUrl = address.replaceAll(/(\/)+$/g, '');
        setServerAddress(serverBaseUrl);
        requestManager.reset();
    };

    return (
        <TextSetting
            settingName={t('settings.about.server.label.address')}
            handleChange={handleServerAddressChange}
            value={serverAddress}
            placeholder="http://localhost:4567"
        />
    );
};
