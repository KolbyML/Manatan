/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import TagIcon from '@mui/icons-material/Tag';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { MigrationCard, TMigratableSource } from '@/features/migration/components/MigrationCard.tsx';
import { StyledGroupItemWrapper } from '@/base/components/virtuoso/StyledGroupItemWrapper.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { SortBy, SortOrder, SortSettings, TMigratableSourcesResult } from '@/features/migration/Migration.types.ts';
import { sortByToTranslationKey, sortOrderToTranslationKey } from '@/features/migration/Migration.constants.ts';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';

const getMigratableSources = (
    mangas: TMigratableSourcesResult | undefined,
    { sortBy, sortOrder }: SortSettings,
): TMigratableSource[] => {
    if (!mangas) {
        return [];
    }

    const sourceBySourceId: Record<string, TMigratableSource> = {};

    mangas.forEach(({ sourceId, source }) => {
        const uniqueSource = sourceBySourceId[sourceId] ?? {
            ...{ id: sourceId, name: sourceId, lang: 'unknown', iconUrl: null, mangaCount: 0, ...source },
        };

        sourceBySourceId[sourceId] = {
            ...uniqueSource,
            mangaCount: uniqueSource.mangaCount + 1,
        };
    });

    const sourcesSortedBy = Object.values(sourceBySourceId).toSorted((a, b) => {
        switch (sortBy) {
            case SortBy.SOURCE_NAME:
                return a.name.localeCompare(b.name);
            case SortBy.MANGA_COUNT:
                return a.mangaCount - b.mangaCount;
            default:
                throw new Error(`Unexpected "sortBy" "${sortBy}"`);
        }
    });

    switch (sortOrder) {
        case SortOrder.ASC:
            return sourcesSortedBy;
        case SortOrder.DESC:
            return sourcesSortedBy.toReversed();
        default:
            throw new Error(`Unexpected "sortOrder" "${sortOrder}"`);
    }
};

export const Migration = ({ tabsMenuHeight }: { tabsMenuHeight: number }) => {
    const { t } = useTranslation();
    const { appBarHeight } = useNavBarContext();

    const {
        settings: { migrateSortSettings },
    } = useMetadataServerSettings();
    const updateMetadataServerSettings = createUpdateMetadataServerSettings<'migrateSortSettings'>((e) =>
        makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
    );
    const { sortBy, sortOrder } = migrateSortSettings;

    const { data, loading, error, refetch } = requestManager.useGetMigratableSources({
        notifyOnNetworkStatusChange: true,
    });
    const migratableSources = useMemo(
        () => getMigratableSources(data?.mangas.nodes, migrateSortSettings),
        [data?.mangas.nodes, migrateSortSettings],
    );

    if (loading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('Migration::refetch'))}
            />
        );
    }

    return (
        <>
            <Stack
                sx={{
                    position: 'sticky',
                    top: `${appBarHeight + tabsMenuHeight}px`,
                    flexDirection: 'row',
                    justifyContent: 'end',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    backgroundColor: 'background.default',
                    zIndex: 1,
                }}
            >
                <CustomTooltip title={t(sortByToTranslationKey[sortBy])}>
                    <IconButton
                        color="inherit"
                        onClick={() =>
                            updateMetadataServerSettings('migrateSortSettings', { sortBy: (sortBy + 1) % 2, sortOrder })
                        }
                    >
                        {sortBy ? <TagIcon /> : <SortByAlphaIcon />}
                    </IconButton>
                </CustomTooltip>
                <CustomTooltip title={t(sortOrderToTranslationKey[sortOrder])}>
                    <IconButton
                        color="inherit"
                        onClick={() =>
                            updateMetadataServerSettings('migrateSortSettings', {
                                sortBy,
                                sortOrder: (sortOrder + 1) % 2,
                            })
                        }
                    >
                        {sortOrder ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
                    </IconButton>
                </CustomTooltip>
            </Stack>
            <List sx={{ p: 0 }}>
                {migratableSources.map((migratableSource) => (
                    <StyledGroupItemWrapper key={migratableSource.id}>
                        <MigrationCard {...migratableSource} />
                    </StyledGroupItemWrapper>
                ))}
            </List>
        </>
    );
};
