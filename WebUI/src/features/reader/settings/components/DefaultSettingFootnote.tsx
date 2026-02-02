/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';

export const DefaultSettingFootnote = ({ areDefaultSettings }: { areDefaultSettings?: boolean }) => {
    const { t } = useTranslation();
    const isTouchDevice = MediaQuery.useIsTouchDevice();

    if (!isTouchDevice || areDefaultSettings) {
        return null;
    }

    return (
        <Stack sx={{ alignItems: 'end' }}>
            <Typography variant="caption">{t('reader.settings.default_setting_footnote')}</Typography>
        </Stack>
    );
};
