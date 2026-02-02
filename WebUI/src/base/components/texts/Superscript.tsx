/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Trans, useTranslation } from 'react-i18next';

import { TranslationKey } from '@/base/Base.types.ts';

/**
 * Expects a translation key of format "{{value}}<0>superscript</0>"
 * @param i18nKey
 * @param value
 * @constructor
 */
export const Superscript = ({ i18nKey, value }: { i18nKey: TranslationKey; value: string }) => {
    const { t } = useTranslation();

    return (
        <Stack sx={{ flexDirection: 'row', gap: 0.25 }}>
            <Trans
                t={t}
                // the type of "key" causes tsc error: "TS2590: Expression produces a union type that is too complex to represent"
                i18nKey={i18nKey as any}
                values={{ value }}
                components={[<Typography variant="caption" sx={{ fontSize: 'x-small', opacity: 0.75 }} />]}
            />
        </Stack>
    );
};
