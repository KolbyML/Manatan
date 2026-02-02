/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import { TExtension } from '@/features/extension/Extensions.types.ts';
import { ExtensionMetadata } from '@/features/extension/info/components/ExtensionMetadata.tsx';
import { languageCodeToName } from '@/base/utils/Languages.ts';

export const Meta = ({ versionName, lang, isNsfw }: TExtension) => {
    const { t } = useTranslation();

    return (
        <Stack sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <ExtensionMetadata title={t('global.label.version')} value={versionName} />
            <ExtensionMetadata title={t('global.language.label.language')} value={languageCodeToName(lang)} />
            {isNsfw && (
                <ExtensionMetadata
                    title={t('extension.label.age_rating')}
                    value="18+"
                    valueProps={{ color: 'error' }}
                />
            )}
        </Stack>
    );
};
