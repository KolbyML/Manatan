/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { SpinnerImage } from '@/base/components/SpinnerImage.tsx';
import { TExtension } from '@/features/extension/Extensions.types.ts';

export const Header = ({ name, pkgName, iconUrl, repo }: TExtension) => (
    <Stack sx={{ alignItems: 'center' }}>
        <SpinnerImage alt={name} src={requestManager.getValidImgUrlFor(iconUrl)} ignoreQueue />
        <Typography variant="h5" component="h2">
            {name}
        </Typography>
        <Typography variant="body2" color="textSecondary">
            {pkgName.replace('eu.kanade.tachiyomi.extension.', '')}
        </Typography>
        {repo && (
            <Typography variant="body2" color="textSecondary">
                {repo}
            </Typography>
        )}
    </Stack>
);
