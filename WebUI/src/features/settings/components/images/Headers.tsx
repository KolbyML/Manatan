/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import { Maybe } from '@/lib/graphql/generated/graphql.ts';
import { addStableIdToHeaders, isDuplicateHeader } from '@/features/settings/ImageProcessing.utils.ts';
import { Header } from '@/features/settings/components/images/Header.tsx';
import { TSettingsDownloadConversionHeader } from '@/features/settings/Settings.types.ts';

export const Headers = ({
    open,
    headers,
    onChange,
}: {
    open: boolean;
    headers: Maybe<TSettingsDownloadConversionHeader[] | undefined>;
    onChange: (headers: Maybe<TSettingsDownloadConversionHeader[]>) => void;
}) => {
    const { t } = useTranslation();

    return (
        <Collapse in={open}>
            <Stack sx={{ justifyContent: 'start', gap: 2, pt: 2 }}>
                <Typography>{t('download.settings.conversion.headers.title')}</Typography>
                {headers?.map((header, index) => (
                    <Header
                        key={header.id}
                        {...header}
                        isDuplicate={isDuplicateHeader(header.name, index, headers)}
                        onChange={(updatedHeader) => {
                            const isDeletion = updatedHeader == null;
                            if (isDeletion) {
                                onChange(headers?.toSpliced(index, 1));
                                return;
                            }

                            onChange((headers ?? []).toSpliced(index, 1, updatedHeader));
                        }}
                    />
                ))}
                <Button
                    onClick={() => onChange([...(headers ?? []), ...addStableIdToHeaders([{ name: '', value: '' }])])}
                    variant="contained"
                    sx={{ width: 'fit-content' }}
                >
                    {t('global.button.add')}
                </Button>
            </Stack>
        </Collapse>
    );
};
