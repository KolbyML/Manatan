/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import { memo, useLayoutEffect } from 'react';
import Popover from '@mui/material/Popover';
import { bindPopover, bindTrigger, usePopupState } from 'material-ui-popup-state/hooks';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { Link } from 'react-router-dom';
import { Select } from '@/base/components/inputs/Select.tsx';
import { ReaderChapterList } from '@/features/reader/overlay/navigation/components/ReaderChapterList.tsx';
import { ReaderNavBarDesktopNextPreviousButton } from '@/features/reader/overlay/navigation/desktop/components/ReaderNavBarDesktopNextPreviousButton.tsx';
import { getOptionForDirection } from '@/features/theme/services/ThemeCreator.ts';
import { ReaderService } from '@/features/reader/services/ReaderService.ts';
import { ReaderControls } from '@/features/reader/services/ReaderControls.ts';
import { ReaderStateChapters } from '@/features/reader/Reader.types.ts';
import { withPropsFrom } from '@/base/hoc/withPropsFrom.tsx';
import { ChapterIdInfo } from '@/features/chapter/Chapter.types.ts';

const BaseReaderNavBarDesktopChapterNavigation = ({
    currentChapterId,
    currentChapterName,
    currentChapterNumber,
    previousChapter,
    nextChapter,
    chapters = [],
    readerThemeDirection,
}: {
    currentChapterId: ChapterIdInfo['id'] | undefined;
    currentChapterName: string | undefined;
    currentChapterNumber: number | undefined;
} & Pick<ReaderStateChapters, 'chapters' | 'previousChapter' | 'nextChapter'> & {
        readerThemeDirection: ReturnType<typeof ReaderService.useGetThemeDirection>;
    }) => {
    const { t } = useTranslation();

    const popupState = usePopupState({ variant: 'popover', popupId: 'reader-nav-bar-desktop-chapter-list' });

    useLayoutEffect(() => {
        popupState.close();
    }, [currentChapterId]);

    // Prepare Ghost Text for the "Chapter" Label
    const chapterLabelText = t('chapter.title_one');
    const chapterLabelGhost = (
        <span className="yomitan-ghost-text" data-text={chapterLabelText} />
    );

    // Prepare Ghost Text for the Current Chapter Value (#1 Chapter Name)
    const currentChapterText = currentChapterNumber !== undefined 
        ? `#${currentChapterNumber} ${currentChapterName}` 
        : '';

    return (
        <Stack sx={{ flexDirection: 'row', gap: 1 }} dir="ltr">
            <ReaderNavBarDesktopNextPreviousButton
                type="previous"
                title={t(
                    getOptionForDirection(
                        'reader.button.previous_chapter',
                        'reader.button.next_chapter',
                        readerThemeDirection,
                    ),
                )}
                onClick={() => {
                    ReaderControls.openChapter(getOptionForDirection('previous', 'next', readerThemeDirection));
                }}
                disabled={getOptionForDirection(!previousChapter, !nextChapter, readerThemeDirection)}
            />
            <FormControl sx={{ flexBasis: '70%', flexGrow: 0, flexShrink: 0 }}>
                {/* Fix 1: Apply ghost text to InputLabel */}
                <InputLabel id="reader-nav-bar-desktop-chapter-select">
                    {chapterLabelGhost}
                </InputLabel>
                
                <Select
                    {...bindTrigger(popupState)}
                    open={popupState.isOpen}
                    value={currentChapterId ?? 0}
                    // hide actual select menu
                    MenuProps={{ sx: { visibility: 'hidden' } }}
                    // Fix 2: Apply ghost text to Select 'label' prop (for the outline cutout)
                    label={chapterLabelGhost}
                    labelId="reader-nav-bar-desktop-chapter-select"
                >
                    {/* hacky way to use the select component with a custom menu, the only possible value that is needed is the current chapter */}
                    <MenuItem key={currentChapterId} value={currentChapterId ?? 0}>
                        {/* Fix 3: Apply ghost text to the current selected chapter name */}
                        <span className="yomitan-ghost-text" data-text={currentChapterText} />
                    </MenuItem>
                </Select>
            </FormControl>
            <ReaderNavBarDesktopNextPreviousButton
                component={Link}
                type="next"
                title={t(
                    getOptionForDirection(
                        'reader.button.next_chapter',
                        'reader.button.previous_chapter',
                        readerThemeDirection,
                    ),
                )}
                onClick={() => {
                    ReaderControls.openChapter(getOptionForDirection('next', 'previous', readerThemeDirection));
                }}
                disabled={getOptionForDirection(!nextChapter, !previousChapter, readerThemeDirection)}
            />
            <Popover
                {...bindPopover(popupState)}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
            >
                <Box sx={{ mb: 1 }}>
                    <ReaderChapterList
                        style={{
                            width: '500px',
                            maxWidth: '90vw',
                            minHeight: '150px',
                            maxHeight: '300px',
                        }}
                        currentChapterId={currentChapterId}
                        chapters={chapters}
                    />
                </Box>
            </Popover>
        </Stack>
    );
};

export const ReaderNavBarDesktopChapterNavigation = withPropsFrom(
    memo(BaseReaderNavBarDesktopChapterNavigation),
    [
        () => ({
            readerThemeDirection: ReaderService.useGetThemeDirection(),
        }),
    ],
    ['readerThemeDirection'],
);
