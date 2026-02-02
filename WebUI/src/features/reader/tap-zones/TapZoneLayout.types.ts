/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export enum TapZoneLayouts {
    EDGE,
    KINDLE,
    L_SHAPE,
    RIGHT_LEFT,
    DISABLED,
}

export enum TapZoneRegionType {
    MENU,
    PREVIOUS,
    NEXT,
}

/**
 * percentage based values
 */
export type ReaderTapZoneRect = [X: number, Y: number, Width: number, Height: number];

export interface TapZoneRegion {
    rect: ReaderTapZoneRect;
    type: TapZoneRegionType;
}

export interface TapZoneInvertMode {
    vertical: boolean;
    horizontal: boolean;
}

export type TReaderTapZoneContext = {
    showPreview: boolean;
    setShowPreview: (showPreview: boolean) => void;
};
