/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Virtuoso, VirtuosoProps } from 'react-virtuoso';
import { useMemo } from 'react';
import { ReaderStateChapters } from '@/features/reader/Reader.types.ts';
import { ChapterListCard } from '@/features/chapter/components/cards/ChapterListCard.tsx';
import { ChapterIdInfo } from '@/features/chapter/Chapter.types.ts';

const onSelectNoop = () => {};

export const ReaderChapterList = ({
    currentChapterId,
    chapters,
    style,
}: { currentChapterId: ChapterIdInfo['id'] | undefined } & Pick<ReaderStateChapters, 'chapters'> &
    Pick<VirtuosoProps<any, any>, 'style'>) => {
    const currentChapterIndex = useMemo(() => {
        if (currentChapterId === undefined) {
            return 0;
        }

        return chapters.findIndex((chapter) => chapter.id === currentChapterId);
    }, [currentChapterId, chapters]);

    return (
        <Virtuoso
            style={{
                height: `calc(${chapters.length} * 100px)`,
                ...style,
            }}
            initialTopMostItemIndex={currentChapterIndex}
            totalCount={chapters.length}
            computeItemKey={(index) => chapters[index].id}
            itemContent={(index) => (
                <ChapterListCard
                    index={index}
                    chapters={chapters}
                    isSortDesc
                    mode="reader"
                    showChapterNumber={false}
                    selected={null}
                    onSelect={onSelectNoop}
                    selectable={false}
                    isActiveChapter={index === currentChapterIndex}
                />
            )}
            increaseViewportBy={400}
        />
    );
};
