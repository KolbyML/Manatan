/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Warning from '@mui/icons-material/Warning';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';
import { isNetworkRequestInFlight } from '@/lib/requests/RequestStatus.ts';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { ChapterList } from '@/features/chapter/components/ChapterList.tsx';
import { useRefreshManga } from '@/features/manga/hooks/useRefreshManga.ts';
import { MangaDetails } from '@/features/manga/components/details/MangaDetails.tsx';
import { MangaToolbarMenu } from '@/features/manga/components/MangaToolbarMenu.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { useAppTitleAndAction } from '@/features/navigation-bar/hooks/useAppTitleAndAction.ts';
import { MangaLocationState } from '@/features/manga/Manga.types.ts';

export const Manga: React.FC = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const { mode } = useLocation<MangaLocationState>().state ?? {};

    const autofetchedRef = useRef(false);

    const {
        data,
        error: mangaError,
        loading: isLoading,
        networkStatus,
        refetch,
    } = requestManager.useGetMangaScreen(id);
    const isValidating = isNetworkRequestInFlight(networkStatus);
    const manga = data?.manga;

    const [refresh, { loading: refreshing, error: refreshError }] = useRefreshManga(id);

    // `refetch` is not referentially stable (it is recreated every render). If we use it directly in
    // callbacks/effects dependencies, it can trigger infinite update loops through NavBar context.
    const refetchRef = useRef(refetch);
    useEffect(() => {
        refetchRef.current = refetch;
    }, [refetch]);

    const refreshAndRefetch = useCallback(async () => {
        await refresh();
        await refetchRef.current();
    }, [refresh]);

    const error = mangaError ?? refreshError;

    useEffect(() => {
        if (manga == null) return;

        const doFetch = !autofetchedRef.current && !manga.initialized;
        if (doFetch) {
            autofetchedRef.current = true;
            refreshAndRefetch().catch(() => {});
        }
    }, [manga, refreshAndRefetch]);

    useAppTitleAndAction(
        manga?.title ?? t('manga.title_one'),
        <Stack
            direction="row"
            sx={{
                alignItems: 'center',
            }}
        >
            {error && !isValidating && !refreshing && (
                <CustomTooltip
                    title={
                        <>
                            {t('manga.error.label.request_failure')}
                            <br />
                            {getErrorMessage(error)}
                        </>
                    }
                >
                    <IconButton onClick={() => refetchRef.current()}>
                        <Warning color="error" />
                    </IconButton>
                </CustomTooltip>
            )}
            {manga && (refreshing || isValidating) && (
                <IconButton disabled>
                    <CircularProgress size={16} />
                </IconButton>
            )}
            {manga && <MangaToolbarMenu manga={manga} onRefresh={refreshAndRefetch} refreshing={refreshing} />}
        </Stack>,
        [t, error, isValidating, refreshing, manga, refreshAndRefetch],
    );

    if (error && !manga) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('manga.error.label.request_failure')}
                messageExtra={getErrorMessage(error)}
            />
        );
    }
    return (
        <Box sx={{ display: { md: 'flex' }, overflow: 'hidden' }}>
            {isLoading && <LoadingPlaceholder />}

            {manga && <MangaDetails manga={manga} mode={mode} />}
            {manga && <ChapterList manga={manga} isRefreshing={refreshing} />}
        </Box>
    );
};
