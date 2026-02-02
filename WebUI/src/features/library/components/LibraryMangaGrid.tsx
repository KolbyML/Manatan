/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IMangaGridProps, MangaGrid } from '@/features/manga/components/MangaGrid.tsx';
import { GridLayout } from '@/base/Base.types.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';

interface LibraryMangaGridProps
    extends Required<Pick<IMangaGridProps, 'isSelectModeActive' | 'selectedMangaIds' | 'handleSelection' | 'mangas'>>,
        Pick<IMangaGridProps, 'retry' | 'message' | 'messageExtra'> {
    showFilteredOutMessage: boolean;
    isLoading: boolean;
}

const loadMoreNoop = () => undefined;

export const LibraryMangaGrid: React.FC<LibraryMangaGridProps> = ({
    showFilteredOutMessage,
    message,
    messageExtra,
    ...gridProps
}) => {
    const { t } = useTranslation();

    const {
        settings: { gridLayout },
    } = useMetadataServerSettings();

    useLayoutEffect(() => {
        document.body.style.overflowY = gridLayout === GridLayout.List ? 'auto' : 'scroll';
        return () => {
            document.body.style.overflowY = 'auto';
        };
    }, []);

    return (
        <MangaGrid
            gridWrapperProps={{ sx: { p: 1 } }}
            {...gridProps}
            hasNextPage={false}
            loadMore={loadMoreNoop}
            message={showFilteredOutMessage ? t('library.error.label.no_matches') : message}
            messageExtra={showFilteredOutMessage ? undefined : messageExtra}
            gridLayout={gridLayout}
        />
    );
};
