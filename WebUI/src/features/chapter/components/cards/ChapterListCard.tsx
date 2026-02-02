/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import { ComponentProps } from 'react';
import { ChapterCard } from '@/features/chapter/components/cards/ChapterCard.tsx';

import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { MissingChaptersInfoSeparator } from '@/features/chapter/components/MissingChaptersInfoSeparator.tsx';

type ChapterCardProps = ComponentProps<typeof ChapterCard>;

export const ChapterListCard = ({
    index,
    isSortDesc,
    chapters,
    ...chapterCardProps
}: Omit<ChapterCardProps, 'chapter'> & {
    index: number;
    isSortDesc: boolean;
    chapters: ChapterCardProps['chapter'][];
}) => {
    const previousChapterIndex = isSortDesc ? index + 1 : index - 1;

    const chapter = chapters[index];
    const previousChapter = chapters[previousChapterIndex] ?? { chapterNumber: 0 };

    const missingChaptersGap = Chapters.getGap(chapter, previousChapter);
    const areChaptersMissing = missingChaptersGap > 0;

    return (
        <Stack sx={applyStyles(!isSortDesc, { flexDirection: 'column-reverse' })}>
            <ChapterCard {...chapterCardProps} chapter={chapters[index]} />
            {areChaptersMissing && <MissingChaptersInfoSeparator missingChaptersGap={missingChaptersGap} />}
        </Stack>
    );
};
