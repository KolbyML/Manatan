/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    LoggedInInfo,
    PublishingStatus,
    PublishingType,
    TrackerIdInfo,
    TrackRecordTrackerInfo,
    TrackSearchPublishingStatusInfo,
    TrackSearchPublishingTypeInfo,
} from '@/features/tracker/Tracker.types.ts';
import { UNSET_DATE } from '@/features/tracker/Tracker.constants.ts';

export class Trackers {
    static getIds(trackers: TrackerIdInfo[]): number[] {
        return trackers.map((tracker) => tracker.id);
    }

    static isUnsetDate(date: string): boolean {
        return date === UNSET_DATE;
    }

    static getDateString(date: string): string | undefined {
        return this.isUnsetDate(date) ? undefined : date;
    }

    static isLoggedIn<Tracker extends LoggedInInfo>(tracker: Tracker): boolean {
        return tracker.isLoggedIn && !tracker.isTokenExpired;
    }

    static getLoggedIn<Tracker extends LoggedInInfo>(trackers: Tracker[]): Tracker[] {
        return trackers.filter(this.isLoggedIn);
    }

    static getTrackers<TrackRecord extends TrackRecordTrackerInfo, Tracker extends TrackerIdInfo>(
        trackRecords: TrackRecord[],
        trackers: Tracker[],
    ): Tracker[] {
        return trackRecords
            .map((trackRecord) => trackers.find((tracker) => tracker.id === trackRecord.trackerId))
            .filter((tracker) => !!tracker);
    }

    static getTrackRecordFor<TrackRecord extends TrackRecordTrackerInfo>(
        tracker: TrackerIdInfo,
        trackRecords: TrackRecord[],
    ): TrackRecord | undefined {
        return trackRecords.find((trackRecord) => trackRecord.trackerId === tracker.id);
    }

    static getPublishingType<TrackSearch extends TrackSearchPublishingTypeInfo>(
        trackSearch: TrackSearch,
    ): PublishingType {
        const type = trackSearch.publishingType.toLowerCase().replaceAll(/[ |-]/g, '_');

        switch (type) {
            case PublishingType.UNKNOWN:
                return PublishingType.UNKNOWN;
            case PublishingType.MANGA:
                return PublishingType.MANGA;
            case PublishingType.NOVEL:
                return PublishingType.NOVEL;
            case PublishingType.ONE_SHOT:
                return PublishingType.ONE_SHOT;
            case PublishingType.DOUJINSHI:
                return PublishingType.DOUJINSHI;
            case PublishingType.MANHWA:
                return PublishingType.MANHWA;
            case PublishingType.MANHUA:
                return PublishingType.MANHUA;
            case PublishingType.OEL:
                return PublishingType.OEL;
            default:
                return trackSearch.publishingType as PublishingType;
        }
    }

    static getPublishingStatus<TrackSearch extends TrackSearchPublishingStatusInfo>(
        trackSearch: TrackSearch,
    ): PublishingStatus {
        const status = trackSearch.publishingStatus.toLowerCase().replaceAll(' ', '_');

        switch (status) {
            case PublishingStatus.FINISHED:
                return PublishingStatus.FINISHED;
            case PublishingStatus.RELEASING:
                return PublishingStatus.RELEASING;
            case PublishingStatus.NOT_YET_RELEASED:
                return PublishingStatus.NOT_YET_RELEASED;
            case PublishingStatus.CANCELLED:
                return PublishingStatus.CANCELLED;
            case PublishingStatus.HIATUS:
                return PublishingStatus.HIATUS;
            case PublishingStatus.CURRENTLY_PUBLISHING:
                return PublishingStatus.CURRENTLY_PUBLISHING;
            case PublishingStatus.NOT_YET_PUBLISHED:
                return PublishingStatus.NOT_YET_PUBLISHED;
            default:
                return trackSearch.publishingStatus as PublishingStatus;
        }
    }
}
