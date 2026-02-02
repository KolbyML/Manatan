/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Link } from 'react-router-dom';
import PlayArrow from '@mui/icons-material/PlayArrow';
import { useTranslation } from 'react-i18next';
import { StyledFab } from '@/base/components/buttons/StyledFab.tsx';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import {
    ChapterMangaInfo,
    ChapterNameInfo,
    ChapterNumberInfo,
    ChapterReadInfo,
    ChapterScanlatorInfo,
    ChapterSourceOrderInfo,
} from '@/features/chapter/Chapter.types.ts';
import { ContinueReadingTooltip } from '@/features/manga/components/ContinueReadingTooltip.tsx';

export function ResumeFab({
    chapter,
}: {
    chapter: ChapterMangaInfo &
        ChapterSourceOrderInfo &
        ChapterReadInfo &
        ChapterNumberInfo &
        ChapterNameInfo &
        ChapterScanlatorInfo;
}) {
    const { t } = useTranslation();

    const { sourceOrder, name, chapterNumber, scanlator } = chapter;
    const isFirstChapter = sourceOrder === 1;

    return (
        <ContinueReadingTooltip
            chapterNumber={chapterNumber}
            name={name}
            sourceOrder={sourceOrder}
            scanlator={scanlator}
        >
            <StyledFab
                component={Link}
                variant="extended"
                color="primary"
                to={Chapters.getReaderUrl(chapter)}
                state={Chapters.getReaderOpenChapterLocationState(chapter)}
            >
                <PlayArrow />
                {isFirstChapter ? t('global.button.start') : t('global.button.resume')}
            </StyledFab>
        </ContinueReadingTooltip>
    );
}
