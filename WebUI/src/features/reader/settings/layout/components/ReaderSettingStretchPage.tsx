/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { IReaderSettings } from '@/features/reader/Reader.types.ts';
import { READER_PAGE_SCALE_MODE_TO_SCALING_ALLOWED } from '@/features/reader/settings/ReaderSettings.constants.tsx';

export const ReaderSettingStretchPage = ({
    pageScaleMode,
    shouldStretchPage,
    setShouldStretchPage,
}: Pick<IReaderSettings, 'pageScaleMode' | 'shouldStretchPage'> & {
    setShouldStretchPage: (mode: IReaderSettings['shouldStretchPage']) => void;
}) => {
    const { t } = useTranslation();

    if (!READER_PAGE_SCALE_MODE_TO_SCALING_ALLOWED[pageScaleMode]) {
        return null;
    }

    return (
        <Box>
            <Button
                onClick={() => setShouldStretchPage(!shouldStretchPage)}
                variant={shouldStretchPage ? 'contained' : 'outlined'}
            >
                {t('reader.settings.page_scale.stretch')}
            </Button>
        </Box>
    );
};
