/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import { useEffect, useMemo, useRef, useState } from 'react';
import DialogContent from '@mui/material/DialogContent';
import { useTranslation } from 'react-i18next';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { Trackers } from '@/features/tracker/services/Trackers.ts';
import { TrackerCard, TrackerMode } from '@/features/tracker/components/cards/TrackerCard.tsx';
import { makeToast } from '@/base/utils/Toast.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { GetMangaTrackRecordsQuery, GetTrackersBindQuery, MangaType } from '@/lib/graphql/generated/graphql.ts';
import { GET_TRACKERS_BIND } from '@/lib/graphql/tracker/TrackerQuery.ts';
import { GET_MANGA_TRACK_RECORDS } from '@/lib/graphql/manga/MangaQuery.ts';
import { MangaIdInfo } from '@/features/manga/Manga.types.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { EmptyView } from '@/base/components/feedback/EmptyView.tsx';

const getTrackerMode = (id: number, trackersInUse: number[], searchModeForTracker?: number): TrackerMode => {
    if (id === searchModeForTracker) {
        return TrackerMode.SEARCH;
    }

    if (trackersInUse.includes(id)) {
        return TrackerMode.INFO;
    }

    return TrackerMode.UNTRACKED;
};

export const TrackManga = ({ manga }: { manga: MangaIdInfo & Pick<MangaType, 'title'> }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [searchModeForTracker, setSearchModeForTracker] = useState<number>();

    const trackerList = requestManager.useGetTrackerList<GetTrackersBindQuery>(GET_TRACKERS_BIND, {
        notifyOnNetworkStatusChange: true,
    });
    const trackers = trackerList.data?.trackers.nodes ?? [];

    const mangaTrackRecordsList = requestManager.useGetManga<GetMangaTrackRecordsQuery>(
        GET_MANGA_TRACK_RECORDS,
        manga.id,
    );
    const mangaTrackRecords = mangaTrackRecordsList.data?.manga.trackRecords.nodes ?? [];

    const loggedInTrackers = Trackers.getLoggedIn(trackers);
    const trackersInUse = Trackers.getLoggedIn(Trackers.getTrackers(mangaTrackRecords, trackers));
    const trackersInUseIds = Trackers.getIds(trackersInUse);

    const isSearchActive = searchModeForTracker !== undefined;
    const OptionalDialogContent = useMemo(() => (isSearchActive ? Box : DialogContent), [isSearchActive]);

    const loading = trackerList.loading || mangaTrackRecordsList.loading;
    const error = trackerList.error ?? mangaTrackRecordsList.error;

    useEffect(() => {
        if (!loading && !error && !trackersInUse.length && !loggedInTrackers.length) {
            navigate(AppRoutes.settings.childRoutes.tracking.path);
        }
    }, [loading]);

    const fetchedLatestTrackDataRef = useRef(false);
    useEffect(() => {
        if (!mangaTrackRecords.length || fetchedLatestTrackDataRef.current) {
            return;
        }

        fetchedLatestTrackDataRef.current = true;
        Promise.all(
            mangaTrackRecords
                .filter((trackRecord) => trackersInUseIds.includes(trackRecord.trackerId))
                .map((trackRecord) => requestManager.fetchTrackBind(trackRecord.id).response),
        ).catch((e) => makeToast(t('tracking.error.label.could_not_fetch_track_info'), 'error', getErrorMessage(e)));
    }, [mangaTrackRecords]);

    const trackerComponents = useMemo(
        () =>
            loggedInTrackers.map((tracker) => {
                const mode = getTrackerMode(tracker.id, trackersInUseIds, searchModeForTracker);
                const trackRecord = Trackers.getTrackRecordFor(tracker, mangaTrackRecords);

                const isSearchForTracker = mode === TrackerMode.SEARCH;
                if (isSearchActive && !isSearchForTracker) {
                    return null;
                }

                return (
                    <TrackerCard
                        key={tracker.id}
                        tracker={tracker}
                        manga={manga}
                        trackRecord={trackRecord}
                        mode={mode}
                        setSearchMode={(id) => setSearchModeForTracker(id)}
                    />
                );
            }),
        [trackersInUseIds, searchModeForTracker, mangaTrackRecords],
    );

    if (error) {
        return (
            <EmptyView
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => {
                    if (trackerList.error) {
                        trackerList.refetch().catch(defaultPromiseErrorHandler('TrackManga::refetch: trackerList'));
                    }

                    if (mangaTrackRecordsList.error) {
                        mangaTrackRecordsList
                            .refetch()
                            .catch(defaultPromiseErrorHandler('TrackManga::refetch: mangaTrackRecordsList'));
                    }
                }}
            />
        );
    }

    if (loading) {
        return <LoadingPlaceholder />;
    }

    if (!isSearchActive) {
        return (
            <OptionalDialogContent
                sx={{
                    padding: 0,
                    // MUI adds a bottom padding to the last child of type CardContent which can only be removed via actual css styling
                    // do it here, so it is done in one place for all track related CardContent components
                    '.MuiPaper-root .MuiCardContent-root': { paddingBottom: '0' },
                }}
            >
                {trackerComponents}
            </OptionalDialogContent>
        );
    }

    return trackerComponents;
};
