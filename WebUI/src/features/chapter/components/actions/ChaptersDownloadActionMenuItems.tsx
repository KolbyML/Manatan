/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import MenuItem from '@mui/material/MenuItem';
import { useTranslation } from 'react-i18next';
import gql from 'graphql-tag';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { Mangas } from '@/features/manga/services/Mangas.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import {
    ChapterOrderBy,
    GetChaptersMangaQuery,
    GetChaptersMangaQueryVariables,
    MangaType,
    SortOrder,
} from '@/lib/graphql/generated/graphql.ts';
import { MANGA_META_FIELDS } from '@/lib/graphql/manga/MangaFragments.ts';
import { getMangaMetadata } from '@/features/manga/services/MangaMetadata.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { GET_CHAPTERS_MANGA } from '@/lib/graphql/chapter/ChapterQuery.ts';
import { filterChapters } from '@/features/chapter/utils/ChapterList.util.tsx';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { CHAPTER_ACTION_TO_TRANSLATION } from '@/features/chapter/Chapter.constants.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { TranslationKey } from '@/base/Base.types.ts';

const DOWNLOAD_OPTIONS: {
    title: TranslationKey;
    getCount: (downloadAheadLimit: number) => number | undefined;
    onlyUnread?: boolean;
    isDownloadAhead?: boolean;
}[] = [
    { title: 'chapter.action.download.add.label.next', getCount: () => 1 },
    { title: 'chapter.action.download.add.label.next', getCount: () => 5 },
    { title: 'chapter.action.download.add.label.next', getCount: () => 10 },
    { title: 'chapter.action.download.add.label.next', getCount: () => 25 },
    {
        title: 'chapter.action.download.add.label.ahead',
        getCount: (downloadAheadLimit) => downloadAheadLimit,
        onlyUnread: true,
        isDownloadAhead: true,
    },
    { title: 'chapter.action.download.add.label.unread', getCount: () => undefined, onlyUnread: true },
    { title: 'chapter.action.download.add.label.all', getCount: () => undefined, onlyUnread: false },
];

const handleDownload = async (
    mangaIds: MangaType['id'][],
    onlyUnread: boolean,
    size: number | undefined,
    downloadAhead: boolean,
): Promise<void> => {
    const isMultiMangaManga = mangaIds.length > 1;
    if (isMultiMangaManga) {
        Mangas.performAction('download', mangaIds, {
            downloadAhead,
            onlyUnread,
            size,
        }).catch(defaultPromiseErrorHandler('ChaptersDownloadActionMenuItems::handleSelect:multiMangaMode'));
        return;
    }

    const mangaId = mangaIds[0];
    const manga = Mangas.getFromCache(
        mangaId,
        gql`
            ${MANGA_META_FIELDS}
            fragment MangaInLibraryState on MangaType {
                id
                meta {
                    ...MANGA_META_FIELDS
                }
            }
        `,
        'MangaInLibraryState',
    )!;
    const meta = getMangaMetadata(manga);
    const chapters = await requestManager.getChapters<GetChaptersMangaQuery, GetChaptersMangaQueryVariables>(
        GET_CHAPTERS_MANGA,
        {
            // Align conditions/filters with the query from ChapterList to potentially be able to reuse the cache
            condition: { mangaId: Number(mangaId) },
            order: [{ by: ChapterOrderBy.SourceOrder, byType: SortOrder.Desc }],
        },
    ).response;
    const filteredChapters = filterChapters(chapters.data.chapters.nodes, meta);

    const doNecessaryDownloadAheadDownloadsExist =
        downloadAhead &&
        Chapters.removeDuplicates(filteredChapters.slice(-1)[0], filteredChapters)
            .slice(-(size ?? 0))
            .every((chapter) => !Chapters.isRead(chapter) && Chapters.isDownloaded(chapter));
    if (doNecessaryDownloadAheadDownloadsExist) {
        return;
    }

    const unreadUndownloadedChapters = filteredChapters.filter((chapter) => {
        if (onlyUnread && chapter.isRead) {
            return false;
        }

        return !chapter.isDownloaded;
    });

    const uniqueChapters = Chapters.removeDuplicates(
        unreadUndownloadedChapters.slice(-1)[0],
        unreadUndownloadedChapters,
    );
    const chaptersToDownload = uniqueChapters.slice(-(size ?? 0));
    const chaptersToDownloadWithDuplicates = Chapters.addDuplicates(chaptersToDownload, unreadUndownloadedChapters);

    if (!chaptersToDownloadWithDuplicates.length) {
        return;
    }

    Chapters.performAction('download', Chapters.getIds(chaptersToDownloadWithDuplicates), {}).catch(
        defaultPromiseErrorHandler('ChaptersDownloadActionMenuItems::handleSelect::singleMangaMode'),
    );
};

export const ChaptersDownloadActionMenuItems = ({
    mangaIds,
    closeMenu,
}: {
    mangaIds: MangaType['id'][];
    closeMenu: () => void;
}) => {
    const { t } = useTranslation();

    const {
        settings: { downloadAheadLimit },
    } = useMetadataServerSettings();

    const handleSelect = (size?: number, onlyUnread: boolean = true, downloadAhead: boolean = false) => {
        handleDownload(mangaIds, onlyUnread, size, downloadAhead).catch((e) =>
            makeToast(
                t(CHAPTER_ACTION_TO_TRANSLATION.download.error, {
                    count: size,
                }),
                'error',
                getErrorMessage(e),
            ),
        );

        closeMenu?.();
    };

    return (
        <>
            {DOWNLOAD_OPTIONS.map(({ title, getCount, onlyUnread, isDownloadAhead }) => (
                <MenuItem
                    key={t(title, { count: getCount(downloadAheadLimit) })}
                    onClick={() => handleSelect(getCount(downloadAheadLimit), onlyUnread, isDownloadAhead)}
                >
                    {t(title, { count: getCount(downloadAheadLimit) })}
                </MenuItem>
            ))}
        </>
    );
};
