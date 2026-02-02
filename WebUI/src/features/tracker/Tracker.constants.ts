/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { SxProps, Theme } from '@mui/material/styles';
import { PublishingStatus, PublishingType } from '@/features/tracker/Tracker.types.ts';

import { TranslationKey } from '@/base/Base.types.ts';

export const DIALOG_PADDING: number = 2;

export const CARD_BACKGROUND: SxProps<Theme> = {
    backgroundColor: 'transparent',
    boxShadow: 'unset',
    backgroundImage: 'unset',
};

export const CARD_STYLING: SxProps<Theme> = {
    padding: DIALOG_PADDING,
    ...CARD_BACKGROUND,
};

export const PUBLISHING_TYPE_TO_TRANSLATION: Record<PublishingType, TranslationKey> = {
    [PublishingType.UNKNOWN]: 'tracking.publishing.type.unknown',
    [PublishingType.MANGA]: 'tracking.publishing.type.manga',
    [PublishingType.NOVEL]: 'tracking.publishing.type.novel',
    [PublishingType.ONE_SHOT]: 'tracking.publishing.type.one_shot',
    [PublishingType.DOUJINSHI]: 'tracking.publishing.type.doujinshi',
    [PublishingType.MANHWA]: 'tracking.publishing.type.manhwa',
    [PublishingType.MANHUA]: 'tracking.publishing.type.manhua',
    [PublishingType.OEL]: 'tracking.publishing.type.oel',
};

export const PUBLISHING_STATUS_TO_TRANSLATION: Record<PublishingStatus, TranslationKey> = {
    [PublishingStatus.FINISHED]: 'tracking.publishing.status.finished',
    [PublishingStatus.RELEASING]: 'tracking.publishing.status.releasing',
    [PublishingStatus.NOT_YET_RELEASED]: 'tracking.publishing.status.not_yet_released',
    [PublishingStatus.CANCELLED]: 'tracking.publishing.status.cancelled',
    [PublishingStatus.HIATUS]: 'tracking.publishing.status.hiatus',
    [PublishingStatus.CURRENTLY_PUBLISHING]: 'tracking.publishing.status.currently_publishing',
    [PublishingStatus.NOT_YET_PUBLISHED]: 'tracking.publishing.status.not_yet_published',
};

export const UNSET_DATE = '0';
