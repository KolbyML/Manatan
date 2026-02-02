/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Typography from '@mui/material/Typography';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { StyledGroupedVirtuoso } from '@/base/components/virtuoso/StyledGroupedVirtuoso.tsx';
import { StyledGroupHeader } from '@/base/components/virtuoso/StyledGroupHeader.tsx';
import { StyledGroupItemWrapper } from '@/base/components/virtuoso/StyledGroupItemWrapper.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { VirtuosoUtil } from '@/lib/virtuoso/Virtuoso.util.tsx';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { ChapterHistoryCard } from '@/features/history/components/ChapterHistoryCard.tsx';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';

export const History: React.FC = () => {
    const { t } = useTranslation();

    useAppTitle(t('history.title'));

    const {
        data: chapterHistoryData,
        loading: isLoading,
        error,
        fetchMore,
        refetch,
    } = requestManager.useGetRecentlyReadChapters(undefined, {
        fetchPolicy: 'cache-and-network',
        notifyOnNetworkStatusChange: true,
    });
    const hasNextPage = !!chapterHistoryData?.chapters.pageInfo.hasNextPage;
    const endCursor = chapterHistoryData?.chapters.pageInfo.endCursor;
    const readEntries = chapterHistoryData?.chapters.nodes ?? [];
    const groupedHistory = useMemo(
        () => Object.entries(Chapters.groupByDate(readEntries, 'lastReadAt')),
        [readEntries],
    );
    const groupCounts: number[] = useMemo(
        () => groupedHistory.map((group) => group[VirtuosoUtil.ITEMS].length),
        [groupedHistory],
    );

    const computeItemKey = VirtuosoUtil.useCreateGroupedComputeItemKey(
        groupCounts,
        useCallback((index) => groupedHistory[index][VirtuosoUtil.GROUP], [groupedHistory]),
        useCallback((index) => readEntries[index].id, [readEntries]),
    );

    const loadMore = useCallback(() => {
        if (!hasNextPage) {
            return;
        }

        fetchMore({ variables: { offset: readEntries.length } });
    }, [hasNextPage, endCursor]);

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('History::refetch'))}
            />
        );
    }

    if (!isLoading && readEntries.length === 0) {
        return <EmptyViewAbsoluteCentered message={t('history.error.label.no_history_available')} />;
    }

    return (
        <StyledGroupedVirtuoso
            persistKey="history"
            components={{
                Footer: () => (isLoading ? <LoadingPlaceholder usePadding /> : null),
            }}
            overscan={window.innerHeight * 0.5}
            endReached={loadMore}
            groupCounts={groupCounts}
            groupContent={(index) => (
                <StyledGroupHeader isFirstItem={index === 0}>
                    <Typography variant="h5" component="h2">
                        {groupedHistory[index][VirtuosoUtil.GROUP]}
                    </Typography>
                </StyledGroupHeader>
            )}
            computeItemKey={computeItemKey}
            itemContent={(index) => (
                <StyledGroupItemWrapper>
                    <ChapterHistoryCard chapter={readEntries[index]} />
                </StyledGroupItemWrapper>
            )}
        />
    );
};
