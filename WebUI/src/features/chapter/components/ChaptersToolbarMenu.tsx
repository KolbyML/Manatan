/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import FilterList from '@mui/icons-material/FilterList';
import IconButton from '@mui/material/IconButton';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import PopupState, { bindMenu, bindTrigger } from 'material-ui-popup-state';
import Menu from '@mui/material/Menu';
import DownloadIcon from '@mui/icons-material/Download';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { useMemo } from 'react';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { ChapterOptions } from '@/features/chapter/components/ChapterOptions.tsx';
import { isFilterActive, updateChapterListOptions } from '@/features/chapter/utils/ChapterList.util.tsx';
import {
    ChapterBookmarkInfo,
    ChapterDownloadInfo,
    ChapterIdInfo,
    ChapterListOptions,
    ChapterReadInfo,
} from '@/features/chapter/Chapter.types.ts';
import { ChaptersDownloadActionMenuItems } from '@/features/chapter/components/actions/ChaptersDownloadActionMenuItems.tsx';
import { Chapters } from '@/features/chapter/services/Chapters.ts';

interface IProps {
    mangaId: number;
    options: ChapterListOptions;
    updateOption: ReturnType<typeof updateChapterListOptions>;
    chapters: (ChapterIdInfo & ChapterReadInfo & ChapterDownloadInfo & ChapterBookmarkInfo)[];
    scanlators: string[];
    excludeScanlators: string[];
}

export const ChaptersToolbarMenu = ({
    mangaId,
    options,
    updateOption,
    chapters,
    scanlators,
    excludeScanlators,
}: IProps) => {
    const { t } = useTranslation();

    const [open, setOpen] = React.useState(false);
    const isFiltered = isFilterActive(options);

    const areAllChaptersRead = useMemo(() => chapters.every(Chapters.isRead), [chapters]);
    const areAllChaptersDownloaded = useMemo(() => chapters.every(Chapters.isDownloaded), [chapters]);

    return (
        <>
            <CustomTooltip title={t('chapter.action.mark_as_read.add.label.action.all')} disabled={areAllChaptersRead}>
                <IconButton
                    disabled={areAllChaptersRead}
                    onClick={() => Chapters.markAsRead(Chapters.getNonRead(chapters), true, mangaId)}
                    color="inherit"
                >
                    <DoneAllIcon />
                </IconButton>
            </CustomTooltip>
            <PopupState variant="popover" popupId="chapterlist-download-button">
                {(popupState) => (
                    <>
                        <CustomTooltip title={t('global.button.download')} disabled={areAllChaptersRead}>
                            <IconButton
                                disabled={areAllChaptersDownloaded}
                                {...bindTrigger(popupState)}
                                color="inherit"
                            >
                                <DownloadIcon />
                            </IconButton>
                        </CustomTooltip>
                        {popupState.isOpen && (
                            <Menu {...bindMenu(popupState)}>
                                <ChaptersDownloadActionMenuItems mangaIds={[mangaId]} closeMenu={popupState.close} />
                            </Menu>
                        )}
                    </>
                )}
            </PopupState>
            <CustomTooltip title={t('chapter.action.filter_and_sort.label')}>
                <IconButton onClick={() => setOpen(true)} color="inherit">
                    <FilterList color={isFiltered ? 'warning' : undefined} />
                </IconButton>
            </CustomTooltip>
            <ChapterOptions
                open={open}
                onClose={() => setOpen(false)}
                options={options}
                updateOption={updateOption}
                scanlators={scanlators}
                excludedScanlators={excludeScanlators}
            />
        </>
    );
};
