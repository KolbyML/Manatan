/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { TapZoneLayouts, TapZoneRegion, TapZoneRegionType } from '@/features/reader/tap-zones/TapZoneLayout.types.ts';

import { TranslationKey } from '@/base/Base.types.ts';

export const READER_TAP_ZONE_LAYOUTS: Record<TapZoneLayouts, TapZoneRegion[]> = {
    /**
     * +---+---+---+
     * | N | N | N | P: Previous
     * +---+---+---+
     * | N | M | N | M: Menu
     * +---+---+---+
     * | N | P | N | N: Next
     * +---+---+---+
     */
    [TapZoneLayouts.EDGE]: [
        {
            rect: [0, 0, 100, 33.33],
            type: TapZoneRegionType.NEXT,
        },
        {
            rect: [0, 33.33, 33.33, 66.66],
            type: TapZoneRegionType.NEXT,
        },
        {
            rect: [66.66, 33.33, 33.33, 66.66],
            type: TapZoneRegionType.NEXT,
        },
        {
            rect: [33.33, 33.33, 33.33, 33.33],
            type: TapZoneRegionType.MENU,
        },
        {
            rect: [33.33, 66.66, 33.33, 33.33],
            type: TapZoneRegionType.PREVIOUS,
        },
    ],
    /**
     * +---+---+---+
     * | M | M | M | P: Previous
     * +---+---+---+
     * | P | N | N | M: Menu
     * +---+---+---+
     * | P | N | N | N: Next
     * +---+---+---+
     */
    [TapZoneLayouts.KINDLE]: [
        {
            rect: [0, 0, 100, 33.33],
            type: TapZoneRegionType.MENU,
        },
        {
            rect: [0, 33.33, 33.33, 66.66],
            type: TapZoneRegionType.PREVIOUS,
        },
        {
            rect: [33.33, 33.33, 66.66, 66.66],
            type: TapZoneRegionType.NEXT,
        },
    ],
    /**
     * +---+---+---+
     * | P | P | P | P: Previous
     * +---+---+---+
     * | P | M | N | M: Menu
     * +---+---+---+
     * | N | N | N | N: Next
     * +---+---+---+
     */
    [TapZoneLayouts.L_SHAPE]: [
        {
            rect: [0, 0, 100, 33.33],
            type: TapZoneRegionType.PREVIOUS,
        },
        {
            rect: [0, 33.33, 33.33, 33.33],
            type: TapZoneRegionType.PREVIOUS,
        },
        {
            rect: [33.33, 33.33, 33.33, 33.33],
            type: TapZoneRegionType.MENU,
        },
        {
            rect: [66.66, 33.33, 33.33, 33.33],
            type: TapZoneRegionType.NEXT,
        },
        {
            rect: [0, 66.66, 100, 33.33],
            type: TapZoneRegionType.NEXT,
        },
    ],
    /**
     * +---+---+---+
     * | P | M | N | P: Previous
     * +---+---+---+
     * | P | M | N | M: Menu
     * +---+---+---+
     * | P | M | N | N: Next
     * +---+---+---+
     */
    [TapZoneLayouts.RIGHT_LEFT]: [
        {
            rect: [0, 0, 33.33, 100],
            type: TapZoneRegionType.PREVIOUS,
        },
        {
            rect: [33.33, 0, 33.33, 100],
            type: TapZoneRegionType.MENU,
        },
        {
            rect: [66.66, 0, 33.33, 100],
            type: TapZoneRegionType.NEXT,
        },
    ],
    /**
     * +---+---+---+
     * | M | M | M | P: Previous
     * +---+---+---+
     * | M | M | M | M: Menu
     * +---+---+---+
     * | M | M | M | N: Next
     * +---+---+---+
     */
    [TapZoneLayouts.DISABLED]: [
        {
            rect: [0, 0, 100, 100],
            type: TapZoneRegionType.MENU,
        },
    ],
};

export const TAP_ZONE_REGION_TYPE_DATA: Record<TapZoneRegionType, { text: TranslationKey; color: string }> = {
    [TapZoneRegionType.PREVIOUS]: {
        text: 'global.label.previous',
        color: 'rgba(255, 114, 118, .5)',
    },
    [TapZoneRegionType.NEXT]: {
        text: 'global.label.next',
        color: 'rgba(144, 238, 144, .5)',
    },
    [TapZoneRegionType.MENU]: {
        text: 'global.label.menu',
        color: 'rgba(0, 0, 0, .5)',
    },
};
