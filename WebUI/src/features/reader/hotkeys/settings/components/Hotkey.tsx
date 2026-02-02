/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Fragment } from 'react';
import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { Kbd } from '@/base/components/texts/Kbd.tsx';

export const Hotkey = ({ keys, removeKey }: { keys: string[]; removeKey?: (key: string) => void }) => {
    const { t } = useTranslation();

    return (
        <Stack sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
            {keys.map((key, index) => (
                <Fragment key={key}>
                    <CustomTooltip title={t('global.button.delete')} hidden={!removeKey}>
                        <Stack
                            sx={{
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                gap: 0.5,
                                cursor: removeKey ? 'pointer' : undefined,
                            }}
                            onClick={() => removeKey?.(key)}
                        >
                            {key.split('+').map((splitKey, splitIndex, splitKeys) => (
                                <Fragment key={splitKey}>
                                    <Kbd>{splitKey}</Kbd>
                                    {splitIndex === splitKeys.length - 1 ? '' : '+'}
                                </Fragment>
                            ))}
                        </Stack>
                    </CustomTooltip>
                    {index === keys.length - 1 ? '' : ','}
                </Fragment>
            ))}
        </Stack>
    );
};
