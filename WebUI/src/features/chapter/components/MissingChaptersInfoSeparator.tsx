/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

export const MissingChaptersInfoSeparator = ({ missingChaptersGap }: { missingChaptersGap: number }) => {
    const { t } = useTranslation();

    return (
        <Stack
            sx={{
                width: '100%',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                p: 2,
                pt: 3.5,
                pb: 2.5,
            }}
        >
            <Box
                sx={{
                    flexGrow: 1,
                    border: '1px solid',
                    borderColor: (theme) => theme.palette.text.secondary,
                }}
            />
            <Typography sx={{ px: 2 }} variant="body2" color="textSecondary">
                {t('chapter.missing', { count: missingChaptersGap })}
            </Typography>
            <Box
                sx={{
                    flexGrow: 1,
                    border: '1px solid',
                    borderColor: (theme) => theme.palette.text.secondary,
                }}
            />
        </Stack>
    );
};
