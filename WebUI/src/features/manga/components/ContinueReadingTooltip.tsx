/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomTooltip } from '@/base/components/CustomTooltip';
import {
    ChapterNameInfo,
    ChapterNumberInfo,
    ChapterScanlatorInfo,
    ChapterSourceOrderInfo,
} from '@/features/chapter/Chapter.types.ts';

export const ContinueReadingTooltip = ({
    children,
    chapterNumber,
    name,
    sourceOrder,
    scanlator,
}: ChapterNumberInfo &
    ChapterSourceOrderInfo &
    ChapterNameInfo &
    ChapterScanlatorInfo & {
        children: ReactElement;
    }) => {
    const { t } = useTranslation();

    const isFirstChapter = sourceOrder === 1;

    return (
        <CustomTooltip
            slotProps={{
                tooltip: {
                    sx: {
                        whiteSpace: 'pre-line',
                    },
                },
            }}
            title={t(isFirstChapter ? 'chapter.action.read.start' : 'chapter.action.read.resume', {
                chapterNumber,
                title: name,
                scanlator,
            })}
        >
            {children}
        </CustomTooltip>
    );
};
