/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ReactNode } from 'react';
import Link from '@mui/material/Link';
import { Link as RouterLink } from 'react-router-dom';
import { MangaLocationState } from '@/features/manga/Manga.types.ts';
import { SourceIdInfo } from '@/features/source/Source.types.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';

export const SearchLink = ({
    query,
    sourceId,
    mode,
    children,
}: {
    query: string;
    sourceId: SourceIdInfo['id'] | undefined;
    mode: MangaLocationState['mode'] | 'source.global-search';
    children?: ReactNode;
}) => {
    const link = (() => {
        const isSourceMode = mode === 'source' && sourceId !== undefined;
        if (isSourceMode) {
            return AppRoutes.sources.childRoutes.browse.path(sourceId, query);
        }

        if (mode === 'source.global-search') {
            return AppRoutes.sources.childRoutes.searchAll.path(query);
        }

        return AppRoutes.library.path(undefined, query);
    })();

    return (
        <Link component={RouterLink} to={link} sx={{ textDecoration: 'none', color: 'inherit' }}>
            {children ?? query}
        </Link>
    );
};
