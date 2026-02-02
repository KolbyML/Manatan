/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import { useEffect, useMemo, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import InfoIcon from '@mui/icons-material/Info';
import PopupState, { bindPopover, bindTrigger } from 'material-ui-popup-state';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { SearchTextField } from '@/base/components/inputs/SearchTextField.tsx';
import { makeToast } from '@/base/utils/Toast.ts';
import { TrackerMangaCard } from '@/features/tracker/components/cards/TrackerMangaCard.tsx';
import { DIALOG_PADDING } from '@/features/tracker/Tracker.constants.ts';
import { useGetOptionForDirection } from '@/features/theme/services/ThemeCreator.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { MangaType } from '@/lib/graphql/generated/graphql.ts';

import { MangaIdInfo } from '@/features/manga/Manga.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { Tracker, TrackerIdInfo, TTrackerBind } from '@/features/tracker/Tracker.types.ts';
import { CustomButtonIcon } from '@/base/components/buttons/CustomButtonIcon.tsx';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';

const TrackButton = ({
    mangaId,
    selectedTrackerRemoteId,
    trackerId,
    closeSearchMode,
    supportsPrivateTracking,
}: {
    trackerId: TrackerIdInfo['id'];
    mangaId: MangaIdInfo['id'];
    selectedTrackerRemoteId: string | undefined;
    closeSearchMode: () => void;
    supportsPrivateTracking: boolean;
}) => {
    const { t } = useTranslation();
    const [bindTracker, bindTrackerMutation] = requestManager.useBindTracker();

    const trackManga = (asPrivate: boolean) => {
        if (selectedTrackerRemoteId === undefined) {
            return;
        }

        bindTracker({
            variables: { input: { mangaId, remoteId: selectedTrackerRemoteId, trackerId, private: asPrivate } },
        })
            .then(() => {
                makeToast(t('manga.action.track.add.label.success'), 'success');
                closeSearchMode();
            })
            .catch((e) => makeToast(t('manga.action.track.add.label.error'), 'error', getErrorMessage(e)));
    };

    return (
        <Stack
            direction="row"
            sx={{
                justifyContent: 'center',
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                paddingBottom: DIALOG_PADDING,
                gap: 2,
                px: DIALOG_PADDING,
            }}
        >
            <Button
                disabled={bindTrackerMutation.loading}
                size="large"
                variant="contained"
                onClick={() => trackManga(false)}
                sx={{ flexBasis: '65%' }}
            >
                {t('manga.action.track.add.label.action')}
            </Button>
            {supportsPrivateTracking && (
                <CustomTooltip
                    title={t('tracking.action.button.track_privately')}
                    disabled={bindTrackerMutation.loading}
                >
                    <CustomButtonIcon
                        disabled={bindTrackerMutation.loading}
                        sx={{ flexBasis: '10%', maxWidth: '100px' }}
                        variant="contained"
                        onClick={() => trackManga(true)}
                    >
                        <VisibilityOffIcon />
                    </CustomButtonIcon>
                </CustomTooltip>
            )}
        </Stack>
    );
};

export const TrackerSearch = ({
    manga,
    tracker,
    closeSearchMode,
    trackedId,
}: {
    manga: MangaIdInfo & Pick<MangaType, 'title'>;
    tracker: TTrackerBind;
    closeSearchMode: () => void;
    trackedId?: string;
}) => {
    const { t } = useTranslation();
    const getOptionForDirection = useGetOptionForDirection();

    const [searchString, setSearchString] = useState<string>(manga.title);
    const [tmpSearchString, setTmpSearchString] = useState(searchString);

    const [selectedTrackerRemoteId, setSelectedTrackerRemoteId] = useState<string | undefined>(trackedId);

    const trackerSearch = requestManager.useTrackerSearch(tracker.id, searchString, {
        notifyOnNetworkStatusChange: true,
    });
    const searchResults = trackerSearch.data?.searchTracker.trackSearches ?? [];

    const hasResults = !!searchResults.length;
    const hasNoResults = !trackerSearch.loading && !trackerSearch.error && !hasResults;
    const hasError = !!trackerSearch.error && !trackerSearch.loading;

    useEffect(() => {
        setSelectedTrackerRemoteId(trackedId);

        return () =>
            trackerSearch.abortRequest(new Error(`MangaTrackerSearchCard(${tracker.id}, ${manga.id}): search changed`));
    }, [searchString]);

    const showTrackButton =
        useMemo(
            () =>
                !!selectedTrackerRemoteId &&
                !!searchResults.find((searchResult) => searchResult.remoteId === selectedTrackerRemoteId),
            [selectedTrackerRemoteId, searchResults],
        ) && !hasError;

    return (
        <>
            <DialogTitle sx={{ padding: DIALOG_PADDING }}>
                <Stack
                    direction="row"
                    sx={{
                        gap: '10px',
                        alignItems: 'center',
                    }}
                >
                    <IconButton onClick={closeSearchMode}>
                        {getOptionForDirection(<ArrowBack />, <ArrowForwardIcon />)}
                    </IconButton>
                    <SearchTextField
                        sx={{ width: '100%' }}
                        variant="standard"
                        value={tmpSearchString}
                        onChange={(e) => setTmpSearchString(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setSearchString(tmpSearchString);
                            }
                        }}
                        onCancel={() => setTmpSearchString('')}
                        InputProps={{
                            startAdornment: tracker.id === Tracker.MYANIMELIST && (
                                <InputAdornment position="start">
                                    <PopupState variant="popover" popupId="tracker-search-info">
                                        {(popupState) => (
                                            <>
                                                <IconButton {...bindTrigger(popupState)} color="inherit">
                                                    <InfoIcon />
                                                </IconButton>
                                                <Popover
                                                    {...bindPopover(popupState)}
                                                    anchorOrigin={{
                                                        vertical: 'bottom',
                                                        horizontal: 'left',
                                                    }}
                                                >
                                                    <Typography sx={{ padding: 1, whiteSpace: 'pre-line' }}>
                                                        {t('tracking.my_anime_list.search.label.hint')}
                                                    </Typography>
                                                </Popover>
                                            </>
                                        )}
                                    </PopupState>
                                </InputAdornment>
                            ),
                        }}
                    />
                </Stack>
            </DialogTitle>
            <DialogContent
                dividers
                sx={{
                    padding: DIALOG_PADDING,
                    height: '100vh',
                    ...applyStyles(hasNoResults || hasError, { position: 'relative' }),
                }}
            >
                {hasNoResults && <EmptyViewAbsoluteCentered message={t('manga.error.label.no_mangas_found')} />}
                {trackerSearch.loading && <LoadingPlaceholder />}
                {hasError && (
                    <EmptyViewAbsoluteCentered
                        message={t('global.error.label.failed_to_load_data')}
                        messageExtra={getErrorMessage(trackerSearch.error)}
                        retry={() =>
                            trackerSearch.refetch().catch(defaultPromiseErrorHandler('TrackerSearch::refetch'))
                        }
                    />
                )}
                <List sx={{ padding: 0 }}>
                    {hasResults &&
                        searchResults.map((trackerManga) => (
                            <TrackerMangaCard
                                key={trackerManga.id}
                                manga={trackerManga}
                                selected={trackerManga.remoteId === selectedTrackerRemoteId}
                                onSelect={() => setSelectedTrackerRemoteId(trackerManga.remoteId)}
                            />
                        ))}
                </List>
                {showTrackButton && (
                    <TrackButton
                        mangaId={manga.id}
                        trackerId={tracker.id}
                        closeSearchMode={closeSearchMode}
                        selectedTrackerRemoteId={selectedTrackerRemoteId}
                        supportsPrivateTracking={tracker.supportsPrivateTracking}
                    />
                )}
            </DialogContent>
        </>
    );
};
