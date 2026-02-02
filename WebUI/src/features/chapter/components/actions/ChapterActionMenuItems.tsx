/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import Delete from '@mui/icons-material/Delete';
import Download from '@mui/icons-material/Download';
import RemoveDone from '@mui/icons-material/RemoveDone';
import Done from '@mui/icons-material/Done';
import { useTranslation } from 'react-i18next';
import BookmarkRemove from '@mui/icons-material/BookmarkRemove';
import BookmarkAdd from '@mui/icons-material/BookmarkAdd';
import DoneAll from '@mui/icons-material/DoneAll';
import { ComponentProps, useMemo } from 'react';
import { SelectableCollectionReturnType } from '@/base/collection/hooks/useSelectableCollection.ts';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { MenuItem } from '@/base/components/menu/MenuItem.tsx';
import {
    createGetMenuItemTitle,
    createIsMenuItemDisabled,
    createShouldShowMenuItem,
} from '@/base/components/menu/Menu.utils.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { ChapterCard } from '@/features/chapter/components/cards/ChapterCard.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { GetChaptersMangaQuery } from '@/lib/graphql/generated/graphql.ts';
import { GET_CHAPTERS_MANGA } from '@/lib/graphql/chapter/ChapterQuery.ts';
import { CHAPTER_ACTION_TO_TRANSLATION } from '@/features/chapter/Chapter.constants.ts';
import {
    ChapterAction,
    ChapterBookmarkInfo,
    ChapterDownloadInfo,
    ChapterIdInfo,
    ChapterMangaInfo,
    ChapterReadInfo,
    ChapterRealUrlInfo,
} from '@/features/chapter/Chapter.types.ts';
import { IconWebView } from '@/assets/icons/IconWebView.tsx';
import { IconBrowser } from '@/assets/icons/IconBrowser.tsx';

type BaseProps = { onClose: () => void; selectable?: boolean };

type TChapter = ChapterIdInfo &
    ChapterMangaInfo &
    ChapterDownloadInfo &
    ChapterBookmarkInfo &
    ChapterReadInfo &
    ChapterRealUrlInfo;

type SingleModeProps = {
    chapter: TChapter;
    handleSelection?: SelectableCollectionReturnType<TChapter['id']>['handleSelection'];
    canBeDownloaded: boolean;
};

type SelectModeProps = {
    selectedChapters: ComponentProps<typeof ChapterCard>['chapter'][];
};

type Props =
    | (BaseProps & SingleModeProps & PropertiesNever<SelectModeProps>)
    | (BaseProps & PropertiesNever<SingleModeProps> & SelectModeProps);

export const ChapterActionMenuItems = ({
    chapter,
    handleSelection,
    canBeDownloaded = false,
    selectedChapters = [],
    onClose,
    selectable = true,
}: Props) => {
    const { t } = useTranslation();

    const isSingleMode = !!chapter;
    const { isDownloaded, isRead, isBookmarked } = chapter ?? {};

    const mangaChaptersResponse = requestManager.useGetMangaChapters<GetChaptersMangaQuery>(
        GET_CHAPTERS_MANGA,
        chapter?.mangaId ?? -1,
        {
            skip: !chapter,
            fetchPolicy: 'cache-only',
        },
    );
    const allChapters = mangaChaptersResponse.data?.chapters.nodes ?? [];

    const {
        settings: { deleteChaptersWithBookmark },
    } = useMetadataServerSettings();

    const getMenuItemTitle = createGetMenuItemTitle(isSingleMode, CHAPTER_ACTION_TO_TRANSLATION);
    const shouldShowMenuItem = createShouldShowMenuItem(isSingleMode);
    const isMenuItemDisabled = createIsMenuItemDisabled(isSingleMode);

    const {
        downloadableChapters,
        downloadedChapters,
        unbookmarkedChapters,
        bookmarkedChapters,
        unreadChapters,
        readChapters,
    } = useMemo(
        () => ({
            downloadableChapters: Chapters.getDownloadable(selectedChapters),
            downloadedChapters: Chapters.getDownloaded(selectedChapters),
            unbookmarkedChapters: Chapters.getNonBookmarked(selectedChapters),
            bookmarkedChapters: Chapters.getBookmarked(selectedChapters),
            unreadChapters: Chapters.getNonRead(selectedChapters),
            readChapters: Chapters.getRead(selectedChapters),
        }),
        [selectedChapters],
    );

    const handleSelect = () => {
        handleSelection?.(chapter.id, true);
        onClose();
    };

    const performAction = (action: ChapterAction | 'mark_prev_as_read', chapters: TChapter[]) => {
        const isMarkPrevAsRead = action === 'mark_prev_as_read';
        const actualAction: ChapterAction = isMarkPrevAsRead ? 'mark_as_read' : action;

        if (actualAction === 'delete' && chapter) {
            const isDeletable = Chapters.isDeletable(chapter, deleteChaptersWithBookmark);
            if (!isDeletable) {
                onClose();
                return;
            }
        }

        const getChapters = (): SingleModeProps['chapter'][] => {
            // select mode
            if (!chapter) {
                return chapters;
            }

            if (!isMarkPrevAsRead) {
                return [chapter];
            }

            const index = allChapters.findIndex(({ id: chapterId }) => chapterId === chapter.id);

            const isFirstChapter = index + 1 > allChapters.length - 1;
            if (isFirstChapter) {
                return [];
            }

            const previousChapters = allChapters.slice(index + 1);

            return Chapters.getNonRead(previousChapters);
        };

        const chaptersToUpdate = getChapters();

        if (!chaptersToUpdate.length) {
            onClose();
            return;
        }

        Chapters.performAction(actualAction, Chapters.getIds(chaptersToUpdate), {
            chapters: chaptersToUpdate,
            wasManuallyMarkedAsRead: true,
            trackProgressMangaId: chaptersToUpdate[0]?.mangaId,
        }).catch(defaultPromiseErrorHandler('ChapterActionMenuItems::performAction'));
        onClose();
    };

    return (
        <>
            {isSingleMode && selectable && (
                <MenuItem onClick={handleSelect} Icon={CheckBoxOutlineBlank} title={t('chapter.action.label.select')} />
            )}
            {isSingleMode && (
                <>
                    <MenuItem
                        Icon={IconBrowser}
                        disabled={!chapter!.realUrl}
                        onClick={() => {
                            window.open(chapter!.realUrl!, '_blank', 'noopener,noreferrer');
                            onClose();
                        }}
                        title={t('global.button.open_browser')}
                    />
                    <MenuItem
                        Icon={IconWebView}
                        disabled={!chapter!.realUrl}
                        onClick={() => {
                            window.open(
                                requestManager.getWebviewUrl(chapter!.realUrl!),
                                '_blank',
                                'noopener,noreferrer',
                            );
                            onClose();
                        }}
                        title={t('global.button.open_webview')}
                    />
                </>
            )}
            {shouldShowMenuItem(canBeDownloaded) && (
                <MenuItem
                    Icon={Download}
                    disabled={isMenuItemDisabled(!downloadableChapters.length)}
                    onClick={() => performAction('download', downloadableChapters)}
                    title={getMenuItemTitle('download', downloadableChapters.length)}
                />
            )}
            {shouldShowMenuItem(isDownloaded) && (
                <MenuItem
                    Icon={Delete}
                    disabled={isMenuItemDisabled(!downloadedChapters.length)}
                    onClick={() =>
                        performAction('delete', Chapters.getDeletable(downloadedChapters, deleteChaptersWithBookmark))
                    }
                    title={getMenuItemTitle('delete', downloadedChapters.length)}
                />
            )}
            {shouldShowMenuItem(!isBookmarked) && (
                <MenuItem
                    Icon={BookmarkAdd}
                    disabled={isMenuItemDisabled(!unbookmarkedChapters.length)}
                    onClick={() => performAction('bookmark', unbookmarkedChapters)}
                    title={getMenuItemTitle('bookmark', unbookmarkedChapters.length)}
                />
            )}
            {shouldShowMenuItem(isBookmarked) && (
                <MenuItem
                    Icon={BookmarkRemove}
                    disabled={isMenuItemDisabled(!bookmarkedChapters.length)}
                    onClick={() => performAction('unbookmark', bookmarkedChapters)}
                    title={getMenuItemTitle('unbookmark', bookmarkedChapters.length)}
                />
            )}
            {shouldShowMenuItem(!isRead) && (
                <MenuItem
                    Icon={Done}
                    disabled={isMenuItemDisabled(!unreadChapters.length)}
                    onClick={() => performAction('mark_as_read', unreadChapters)}
                    title={getMenuItemTitle('mark_as_read', unreadChapters.length)}
                />
            )}
            {shouldShowMenuItem(isRead) && (
                <MenuItem
                    Icon={RemoveDone}
                    disabled={isMenuItemDisabled(!readChapters.length)}
                    onClick={() => performAction('mark_as_unread', readChapters)}
                    title={getMenuItemTitle('mark_as_unread', readChapters.length)}
                />
            )}
            {isSingleMode && (
                <MenuItem
                    onClick={() => performAction('mark_prev_as_read', [])}
                    Icon={DoneAll}
                    title={t('chapter.action.mark_as_read.add.label.action.previous')}
                />
            )}
        </>
    );
};
