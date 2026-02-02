/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { LongPressPointerHandlers, LongPressResult } from 'node_modules/use-long-press/lib/use-long-press.types';
import { PopupState } from 'material-ui-popup-state/hooks';
import type { JSX } from 'react';
import { SelectableCollectionReturnType } from '@/base/collection/hooks/useSelectableCollection.ts';
import { useManageMangaLibraryState } from '@/features/manga/hooks/useManageMangaLibraryState.tsx';
import {
    ChapterType,
    MangaReaderFieldsFragment,
    MangaType as MangaTypeGql,
    Maybe,
    SourceType,
    TrackRecordType,
} from '@/lib/graphql/generated/graphql.ts';
import { SingleModeProps } from '@/features/manga/components/MangaActionMenuItems.tsx';
import { GridLayout } from '@/base/Base.types.ts';
import { ChapterListOptions } from '@/features/chapter/Chapter.types.ts';

export type MangaCardMode = 'default' | 'source' | 'migrate.search' | 'migrate.select' | 'duplicate';

type MangaCardBaseProps = Pick<MangaTypeGql, 'id' | 'title' | 'sourceId'> &
    Omit<SingleModeProps['manga'], 'downloadCount' | 'unreadCount' | 'chapters'> &
    Partial<Pick<MangaTypeGql, 'inLibrary' | 'downloadCount' | 'unreadCount'>> & {
        firstUnreadChapter?: Pick<ChapterType, 'id' | 'sourceOrder' | 'isRead' | 'chapterNumber' | 'name'> | null;
    };

export type MangaIdInfo = Pick<MangaTypeGql, 'id'>;
export type MangaChapterCountInfo = { chapters: Pick<MangaTypeGql['chapters'], 'totalCount'> };
export type MangaInLibraryInfo = Pick<MangaTypeGql, 'inLibrary'>;
export type MangaDownloadInfo = Pick<MangaTypeGql, 'downloadCount'> & MangaChapterCountInfo;
export type MangaUnreadInfo = Pick<MangaTypeGql, 'unreadCount'> & MangaChapterCountInfo;
export type MangaThumbnailInfo = Pick<MangaTypeGql, 'thumbnailUrl' | 'thumbnailUrlLastFetched' | 'sourceId'>;
export type MangaTrackRecordInfo = MangaIdInfo & {
    trackRecords: { nodes: Pick<TrackRecordType, 'id' | 'trackerId'>[] };
};
export type MangaGenreInfo = Pick<MangaTypeGql, 'genre'>;
export type MangaSourceIdInfo = Pick<MangaTypeGql, 'sourceId'>;
export type MangaSourceNameInfo = { source?: Maybe<Pick<SourceType, 'name'>> };
export type MangaSourceLngInfo = { source?: Maybe<Pick<SourceType, 'lang'>> };
export type MangaArtistInfo = Pick<MangaTypeGql, 'artist'>;
export type MangaAuthorInfo = Pick<MangaTypeGql, 'author'>;
export type MangaTitleInfo = Pick<MangaTypeGql, 'title'>;
export type MangaDescriptionInfo = Pick<MangaTypeGql, 'description'>;
export type MangaStatusInfo = Pick<MangaTypeGql, 'status'>;

export type MigrateMode = 'copy' | 'migrate';

type MangaCardSpecificProps = MangaCardBaseProps & MangaThumbnailInfo;

export interface MangaCardProps {
    manga: MangaCardBaseProps;
    gridLayout?: GridLayout;
    inLibraryIndicator?: boolean;
    selected?: boolean | null;
    handleSelection?: SelectableCollectionReturnType<MangaTypeGql['id']>['handleSelection'];
    mode?: MangaCardMode;
}

export type SpecificMangaCardProps = Omit<MangaCardProps, 'manga'> &
    Pick<ReturnType<typeof useManageMangaLibraryState>, 'isInLibrary'> & {
        manga: MangaCardSpecificProps;
        longPressBind: LongPressResult<LongPressPointerHandlers>;
        popupState: PopupState;
        handleClick: (event: React.MouseEvent | React.TouchEvent) => void;
        mangaLinkTo: string;
        continueReadingButton: JSX.Element;
        mangaBadges: JSX.Element;
    };

export type MangaMetadata = ChapterListOptions;

export type MangaMetadataKeys = keyof MangaMetadata;

export type MangaAction =
    | 'download'
    | 'delete'
    | 'mark_as_read'
    | 'mark_as_unread'
    | 'remove_from_library'
    | 'change_categories'
    | 'migrate'
    | 'track';

export type TMangaReader = MangaReaderFieldsFragment;

export enum MangaType {
    MANGA,
    COMIC,
    WEBTOON,
    MANHWA,
    MANHUA,
}

export interface MangaLocationState {
    mangaTitle: string;
    mode: MangaCardMode | undefined;
}
