/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';
import { memo } from 'react';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { ChapterAction, TChapterReader } from '@/features/chapter/Chapter.types.ts';
import { CHAPTER_ACTION_TO_TRANSLATION } from '@/features/chapter/Chapter.constants.ts';

const BaseReaderBookmarkButton = ({ id, isBookmarked }: Pick<TChapterReader, 'id' | 'isBookmarked'>) => {
    const { t } = useTranslation();

    const bookmarkAction: Extract<ChapterAction, 'unbookmark' | 'bookmark'> = isBookmarked ? 'unbookmark' : 'bookmark';

    return (
        <CustomTooltip title={t(CHAPTER_ACTION_TO_TRANSLATION[bookmarkAction].action.single)}>
            <IconButton onClick={() => Chapters.performAction(bookmarkAction, [id], {})} color="inherit">
                {isBookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
            </IconButton>
        </CustomTooltip>
    );
};

export const ReaderBookmarkButton = memo(BaseReaderBookmarkButton);
