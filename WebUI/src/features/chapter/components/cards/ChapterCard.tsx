/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import BookmarkIcon from '@mui/icons-material/Bookmark';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CardActionArea from '@mui/material/CardActionArea';
import Checkbox from '@mui/material/Checkbox';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import React, { memo, MouseEvent, TouchEvent, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PopupState, { bindMenu, bindTrigger } from 'material-ui-popup-state';
import { useLongPress } from 'use-long-press';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { getDateString } from '@/base/utils/DateHelper.ts';
import { DownloadStateIndicator } from '@/base/components/downloads/DownloadStateIndicator.tsx';
import { ChapterType } from '@/lib/requests/types.ts';
import { ChapterActionMenuItems } from '@/features/chapter/components/actions/ChapterActionMenuItems.tsx';
import { Menu } from '@/base/components/menu/Menu.tsx';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { ChapterCardMetadata } from '@/features/chapter/components/cards/ChapterCardMetadata.tsx';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent.tsx';
import { useOCR } from '@/Manatan/context/OCRContext.tsx';
import {
    ChapterBookmarkInfo,
    ChapterDownloadInfo,
    ChapterIdInfo,
    ChapterMangaInfo,
    ChapterNumberInfo,
    ChapterReadInfo,
    ChapterScanlatorInfo,
} from '@/features/chapter/Chapter.types.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';

type TChapter = ChapterIdInfo &
    ChapterMangaInfo &
    ChapterDownloadInfo &
    ChapterReadInfo &
    ChapterBookmarkInfo &
    ChapterNumberInfo &
    ChapterScanlatorInfo &
    Pick<ChapterType, 'name' | 'sourceOrder' | 'uploadDate'>;

interface IProps {
    mode?: 'manga.page' | 'reader';
    chapter: TChapter;
    showChapterNumber: boolean;
    onSelect: (id: number, selected: boolean, isShiftKey?: boolean) => void;
    selected: boolean | null;
    selectable?: boolean;
    isActiveChapter?: boolean; // reader
}

export const ChapterCard = memo((props: IProps) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const preventMobileContextMenu = MediaQuery.usePreventMobileContextMenu();
    const { chapterOcrStatusMap, refreshChapterOcrStatus } = useOCR();

    const menuButtonRef = useRef<HTMLButtonElement>(null);

    const {
        mode = 'manga.page',
        chapter,
        showChapterNumber,
        onSelect,
        selected,
        selectable = true,
        isActiveChapter = false,
    } = props;
    const isSelecting = selected !== null;

    const { isDownloaded } = chapter;
    const chapterName = chapter.name?.trim() ?? '';
    const hasChapterNumber = chapter.chapterNumber !== null && chapter.chapterNumber !== undefined && chapter.chapterNumber >= 0;
    const chapterNumberLabel = hasChapterNumber ? `${t('chapter.title_one')} ${chapter.chapterNumber}` : '';
    const title = showChapterNumber
        ? chapterNumberLabel
            ? chapterName
                ? `${chapterNumberLabel} - ${chapterName}`
                : chapterNumberLabel
            : chapterName
        : chapterName || chapterNumberLabel;
    const secondaryTextParts = [] as string[];
    if (!showChapterNumber && chapterNumberLabel) {
        secondaryTextParts.push(chapterNumberLabel);
    }
    if (chapter.scanlator) {
        secondaryTextParts.push(chapter.scanlator);
    }
    const secondaryText = secondaryTextParts.join(' • ');

    const chapterPath = `/manga/${chapter.mangaId}/chapter/${chapter.sourceOrder}`;
    const ocrStatus = chapterOcrStatusMap.get(chapterPath);

    useEffect(() => {
        if (ocrStatus) return;
        void refreshChapterOcrStatus(chapterPath);
    }, [chapterPath, ocrStatus, refreshChapterOcrStatus]);

    const ocrLabel = (() => {
        if (!ocrStatus) return '';
        if (ocrStatus.status === 'processing') {
            if (ocrStatus.total > 0) return `OCR PROCESSING (${ocrStatus.progress}/${ocrStatus.total})`;
            return 'OCR PROCESSING';
        }
        if (ocrStatus.status === 'processed') return 'OCR PROCESSED';
        if (ocrStatus.status === 'idle' && ocrStatus.cached > 0) {
            if (ocrStatus.total > 0) return `OCR PROCESSED (${ocrStatus.cached}/${ocrStatus.total})`;
            return `OCR PROCESSED (${ocrStatus.cached})`;
        }
        return '';
    })();

    const handleClick = (event: MouseEvent | TouchEvent) => {
        if (!isSelecting) return;

        event.preventDefault();
        event.stopPropagation();
        onSelect(chapter.id, !selected, event.shiftKey);
    };

    const handleClickOpenMenu = (
        event: React.MouseEvent | React.TouchEvent,
        openMenu?: (e: React.SyntheticEvent) => void,
    ) => {
        event.stopPropagation();
        event.preventDefault();
        openMenu?.(event);
    };

    const longPressBind = useLongPress((event, { context: openMenu }) => {
        if (!isSelecting && !!menuButtonRef.current) {
            handleClickOpenMenu(event, () => (openMenu as (event: Element) => void)?.(menuButtonRef.current!));
            return;
        }

        // eslint-disable-next-line no-param-reassign
        event.shiftKey = true;
        handleClick(event);
    });

    return (
        <PopupState variant="popover" popupId="chapter-card-action-menu">
            {(popupState) => (
                <Stack sx={{ pt: 1, px: 1 }}>
                    <Card
                        sx={{
                            ...applyStyles(mode === 'reader' && isActiveChapter, {
                                backgroundColor: 'primary.main',
                            }),
                        }}
                    >
                        <CardActionArea
                            component={Link}
                            to={Chapters.getReaderUrl(chapter)}
                            onContextMenu={preventMobileContextMenu}
                            sx={MediaQuery.preventMobileContextMenuSx()}
                            style={{
                                color: theme.palette.text[chapter.isRead ? 'disabled' : 'primary'],
                            }}
                            state={Chapters.getReaderOpenChapterLocationState(chapter, true)}
                            replace={mode === 'reader'}
                            onClick={(e) => handleClick(e)}
                            {...longPressBind(popupState.open)}
                        >
                            <ListCardContent>
                                <ChapterCardMetadata
                                    title={
                                        title
                                    }
                                    secondaryText={secondaryText || undefined}
                                    ternaryText={`${getDateString(Number(chapter.uploadDate ?? 0), true)}${isDownloaded ? ` • ${t('chapter.status.label.downloaded')}` : ''}${ocrLabel ? ` • ${ocrLabel}` : ''}`}
                                    infoIcons={
                                        chapter.isBookmarked && (
                                            <BookmarkIcon
                                                color={mode === 'reader' && isActiveChapter ? 'secondary' : 'primary'}
                                            />
                                        )
                                    }
                                    slotProps={{
                                        title: {
                                            variant: 'h6',
                                            component: 'h3',
                                            sx: applyStyles(mode === 'reader' && isActiveChapter, {
                                                color: theme.palette.primary.contrastText,
                                            }),
                                        },
                                        secondaryText: {
                                            sx: applyStyles(mode === 'reader' && isActiveChapter, {
                                                color: theme.palette.primary.contrastText,
                                            }),
                                        },
                                        ternaryText: {
                                            sx: applyStyles(mode === 'reader' && isActiveChapter, {
                                                color: theme.palette.primary.contrastText,
                                            }),
                                        },
                                    }}
                                />

                                <DownloadStateIndicator
                                    chapterId={chapter.id}
                                    color={
                                        mode === 'reader' && isActiveChapter
                                            ? theme.palette.primary.contrastText
                                            : undefined
                                    }
                                />

                                <Stack sx={{ minHeight: '48px' }}>
                                    {selected === null ? (
                                        <CustomTooltip title={t('global.button.options')}>
                                            <IconButton
                                                ref={menuButtonRef}
                                                {...MUIUtil.preventRippleProp(bindTrigger(popupState), {
                                                    onClick: (e: MouseEvent) => handleClickOpenMenu(e),
                                                })}
                                                aria-label="more"
                                                sx={{
                                                    color: 'inherit',
                                                    ...applyStyles(mode === 'reader' && isActiveChapter, {
                                                        color: 'primary.contrastText',
                                                    }),
                                                }}
                                            >
                                                <MoreVertIcon />
                                            </IconButton>
                                        </CustomTooltip>
                                    ) : (
                                        <CustomTooltip
                                            title={t(selected ? 'global.button.deselect' : 'global.button.select')}
                                        >
                                            <Checkbox checked={selected} />
                                        </CustomTooltip>
                                    )}
                                </Stack>
                            </ListCardContent>
                        </CardActionArea>
                    </Card>
                    {!isSelecting && popupState.isOpen && (
                        <Menu {...bindMenu(popupState)}>
                            {(onClose) => (
                                <ChapterActionMenuItems
                                    onClose={onClose}
                                    chapter={chapter}
                                    handleSelection={() => onSelect(chapter.id, true)}
                                    canBeDownloaded={Chapters.isDownloadable(chapter)}
                                    selectable={selectable}
                                />
                            )}
                        </Menu>
                    )}
                </Stack>
            )}
        </PopupState>
    );
});
