/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Button from '@mui/material/Button';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Link } from 'react-router-dom';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';
import {
    ChapterNameInfo,
    ChapterNumberInfo,
    ChapterReadInfo,
    ChapterScanlatorInfo,
    ChapterSourceOrderInfo,
} from '@/features/chapter/Chapter.types.ts';
import { ContinueReadingTooltip } from '@/features/manga/components/ContinueReadingTooltip.tsx';

export const ContinueReadingButton = ({
    showContinueReadingButton,
    chapter,
    mangaLinkTo,
}: {
    showContinueReadingButton: boolean;
    chapter?:
        | (ChapterSourceOrderInfo & ChapterReadInfo & ChapterNumberInfo & ChapterNameInfo & ChapterScanlatorInfo)
        | null;
    mangaLinkTo: string;
}) => {
    if (!showContinueReadingButton || !chapter) {
        return null;
    }

    const { sourceOrder, chapterNumber, name, scanlator } = chapter;

    return (
        <ContinueReadingTooltip
            chapterNumber={chapterNumber}
            name={name}
            sourceOrder={sourceOrder}
            scanlator={scanlator}
        >
            <Button
                {...MUIUtil.preventRippleProp()}
                variant="contained"
                size="small"
                sx={{ minWidth: 'unset', py: 0.5, px: 0.75 }}
                component={Link}
                to={`${mangaLinkTo}/chapter/${sourceOrder}`}
                state={Chapters.getReaderOpenChapterLocationState(chapter)}
                onClick={(e) => e.stopPropagation()}
            >
                <PlayArrowIcon />
            </Button>
        </ContinueReadingTooltip>
    );
};
