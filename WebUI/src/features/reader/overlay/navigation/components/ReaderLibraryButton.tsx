/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { memo } from 'react';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { useManageMangaLibraryState } from '@/features/manga/hooks/useManageMangaLibraryState.tsx';
import { FALLBACK_MANGA } from '@/features/manga/Manga.constants.ts';
import { useReaderStore } from '@/features/reader/stores/ReaderStore.ts';

const ACTION_FALLBACK_MANGA = {
    ...FALLBACK_MANGA,
    title: 'Fallback',
    inLibrary: false,
};

export const ReaderLibraryButton = memo(() => {
    const manga = useReaderStore((state) => state.manga);

    const { inLibrary } = manga ?? ACTION_FALLBACK_MANGA;

    const { t } = useTranslation();
    const { updateLibraryState } = useManageMangaLibraryState(manga ?? ACTION_FALLBACK_MANGA, true);

    return (
        <CustomTooltip
            title={inLibrary ? t('manga.action.library.remove.label.action') : t('manga.button.add_to_library')}
        >
            <IconButton onClick={updateLibraryState} color="inherit">
                {inLibrary ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            </IconButton>
        </CustomTooltip>
    );
});
