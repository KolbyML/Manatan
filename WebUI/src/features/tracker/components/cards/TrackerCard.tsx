/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { TrackerUntrackedCard } from '@/features/tracker/components/cards/TrackerUntrackedCard.tsx';
import { TrackerSearch } from '@/features/tracker/components/TrackerSearch.tsx';
import { TrackerActiveCard } from '@/features/tracker/components/cards/TrackerActiveCard.tsx';
import { MangaType } from '@/lib/graphql/generated/graphql.ts';

import { MangaIdInfo } from '@/features/manga/Manga.types.ts';
import { TTrackerBind, TTrackRecordBind } from '@/features/tracker/Tracker.types.ts';

export enum TrackerMode {
    UNTRACKED,
    SEARCH,
    INFO,
}

export const TrackerCard = ({
    tracker,
    manga,
    trackRecord,
    mode,
    setSearchMode,
}: {
    tracker: TTrackerBind;
    manga: MangaIdInfo & Pick<MangaType, 'title'>;
    trackRecord?: TTrackRecordBind;
    mode: TrackerMode;
    setSearchMode: (id?: number) => void;
}) => {
    if (mode === TrackerMode.UNTRACKED) {
        return <TrackerUntrackedCard tracker={tracker} onClick={() => setSearchMode(tracker.id)} />;
    }

    if (mode === TrackerMode.SEARCH) {
        return (
            <TrackerSearch
                manga={manga}
                tracker={tracker}
                trackedId={trackRecord?.remoteId}
                closeSearchMode={() => setSearchMode(undefined)}
            />
        );
    }

    if (mode === TrackerMode.INFO && !trackRecord) {
        throw new Error(`TrackerCard: unable to find track record for tracker "${tracker.id}" of manga "${manga.id}"}`);
    }

    return (
        <TrackerActiveCard
            tracker={tracker}
            trackRecord={trackRecord!}
            onClick={() => {
                setSearchMode(tracker.id);
            }}
        />
    );
};
