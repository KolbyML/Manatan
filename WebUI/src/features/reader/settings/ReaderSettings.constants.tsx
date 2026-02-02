/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import ArrowCircleLeftIcon from '@mui/icons-material/ArrowCircleLeft';
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import ExpandIcon from '@mui/icons-material/Expand';
import CropOriginalIcon from '@mui/icons-material/CropOriginal';
import { TooltipProps } from '@mui/material/Tooltip';
import { Direction } from '@mui/material/styles';
import { ScrollDirection, TranslationKey, ValueToDisplayData } from '@/base/Base.types.ts';
import {
    IReaderSettings,
    IReaderSettingsGlobal,
    ProgressBarPosition,
    ProgressBarType,
    ReaderBackgroundColor,
    ReaderBlendMode,
    ReaderExitMode,
    ReaderHotkey,
    ReaderOverlayMode,
    ReaderPageScaleMode,
    ReaderScrollAmount,
    ReadingDirection,
    ReadingMode,
} from '@/features/reader/Reader.types.ts';
import { SinglePageIcon } from '@/assets/icons/svg/SinglePageIcon.tsx';
import { DoublePageIcon } from '@/assets/icons/svg/DoublePageIcon.tsx';
import { ContinuousVerticalPageIcon } from '@/assets/icons/svg/ContinuousVerticalPageIcon.tsx';
import { ContinuousHorizontalPageIcon } from '@/assets/icons/svg/ContinuousHorizontalPageIcon.tsx';
import { TapZoneLayouts } from '@/features/reader/tap-zones/TapZoneLayout.types.ts';
import { WebtoonPageIcon } from '@/assets/icons/svg/WebtoonPageIcon.tsx';

export const AUTO_SCROLL_SPEED = {
    min: 0.5,
    max: 60,
    step: 0.5,
    default: 5,
};

export const SCROLL_AMOUNT = {
    min: 5,
    max: 100,
    default: ReaderScrollAmount.LARGE,
    step: 5,
};

export const PROGRESS_BAR_SIZE = {
    min: 2,
    max: 20,
    step: 1,
    default: 4,
};

export const IMAGE_PRE_LOAD_AMOUNT = {
    min: 1,
    max: 20,
    default: 5,
    step: 1,
};

export const PAGE_GAP = {
    min: 0,
    max: 20,
    default: 5,
    step: 1,
};

export const CUSTOM_FILTER = {
    brightness: {
        min: 5,
        max: 200,
        step: 1,
        default: 100,
    },
    contrast: {
        min: 5,
        max: 200,
        step: 1,
        default: 100,
    },
    saturate: {
        min: 0,
        max: 200,
        step: 1,
        default: 100,
    },
    hue: {
        min: 0,
        max: 200,
        step: 1,
        default: 0,
    },
    rgba: {
        red: {
            min: 0,
            max: 255,
            step: 1,
            default: 0,
        },
        green: {
            min: 0,
            max: 255,
            step: 1,
            default: 0,
        },
        blue: {
            min: 0,
            max: 255,
            step: 1,
            default: 0,
        },
        alpha: {
            min: 0,
            max: 100,
            step: 1,
            default: 0,
        },
    },
} as const;

export const READING_DIRECTION_TO_THEME_DIRECTION: Record<ReadingDirection, Direction> = {
    [ReadingDirection.LTR]: 'ltr',
    [ReadingDirection.RTL]: 'rtl',
};

const GLOBAL_READER_SETTING_OBJECT: Record<keyof IReaderSettingsGlobal, undefined> = {
    overlayMode: undefined,
    exitMode: undefined,
    customFilter: undefined,
    shouldSkipDupChapters: undefined,
    shouldSkipFilteredChapters: undefined,
    progressBarType: undefined,
    progressBarSize: undefined,
    progressBarPosition: undefined,
    progressBarPositionAutoVertical: undefined,
    shouldShowPageNumber: undefined,
    isStaticNav: undefined,
    backgroundColor: undefined,
    hotkeys: undefined,
    imagePreLoadAmount: undefined,
    shouldUseAutoWebtoonMode: undefined,
    autoScroll: undefined,
    shouldShowReadingModePreview: undefined,
    shouldShowTapZoneLayoutPreview: undefined,
    shouldInformAboutMissingChapter: undefined,
    shouldInformAboutScanlatorChange: undefined,
    scrollAmount: undefined,
    shouldUseInfiniteScroll: undefined,
    shouldShowTransitionPage: undefined,
};

export const GLOBAL_READER_SETTING_KEYS = Object.keys(GLOBAL_READER_SETTING_OBJECT);

const IS_MOBILE = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export const DEFAULT_READER_SETTINGS: IReaderSettings = {
    readerWidth: { value: 50, enabled: false },
    overlayMode: ReaderOverlayMode.AUTO,
    tapZoneLayout: TapZoneLayouts.RIGHT_LEFT,
    tapZoneInvertMode: { vertical: false, horizontal: false },
    progressBarType: ProgressBarType.STANDARD,
    progressBarSize: PROGRESS_BAR_SIZE.default,
    progressBarPosition: ProgressBarPosition.AUTO,
    progressBarPositionAutoVertical: ProgressBarPosition.RIGHT,
    pageScaleMode: IS_MOBILE ? ReaderPageScaleMode.SCREEN : ReaderPageScaleMode.ORIGINAL,
    shouldStretchPage: false,
    shouldOffsetDoubleSpreads: false,
    shouldSkipDupChapters: true,
    shouldSkipFilteredChapters: false,
    shouldShowPageNumber: true,
    isStaticNav: false,
    readingDirection: ReadingDirection.LTR,
    readingMode: IS_MOBILE ? ReadingMode.CONTINUOUS_VERTICAL : ReadingMode.SINGLE_PAGE,
    exitMode: ReaderExitMode.PREVIOUS,
    backgroundColor: ReaderBackgroundColor.THEME,
    customFilter: {
        brightness: {
            value: CUSTOM_FILTER.brightness.default,
            enabled: false,
        },
        contrast: {
            value: CUSTOM_FILTER.contrast.default,
            enabled: false,
        },
        saturate: {
            value: CUSTOM_FILTER.saturate.default,
            enabled: false,
        },
        hue: {
            value: CUSTOM_FILTER.hue.default,
            enabled: false,
        },
        rgba: {
            value: {
                red: CUSTOM_FILTER.rgba.red.default,
                green: CUSTOM_FILTER.rgba.green.default,
                blue: CUSTOM_FILTER.rgba.blue.default,
                alpha: CUSTOM_FILTER.rgba.alpha.default,
                blendMode: ReaderBlendMode.DEFAULT,
            },
            enabled: false,
        },
        sepia: false,
        grayscale: false,
        invert: false,
    },
    pageGap: PAGE_GAP.default,
    hotkeys: {
        [ReaderHotkey.PREVIOUS_PAGE]: ['arrowleft', 'a'],
        [ReaderHotkey.NEXT_PAGE]: ['arrowright', 'd'],
        [ReaderHotkey.SCROLL_BACKWARD]: ['arrowup', 'w'],
        [ReaderHotkey.SCROLL_FORWARD]: ['arrowdown', 's'],
        [ReaderHotkey.PREVIOUS_CHAPTER]: ['comma'],
        [ReaderHotkey.NEXT_CHAPTER]: ['period'],
        [ReaderHotkey.TOGGLE_MENU]: ['m'],
        [ReaderHotkey.CYCLE_SCALE_TYPE]: ['i'],
        [ReaderHotkey.STRETCH_IMAGE]: ['f'],
        [ReaderHotkey.OFFSET_SPREAD_PAGES]: ['o'],
        [ReaderHotkey.CYCLE_READING_MODE]: ['r'],
        [ReaderHotkey.CYCLE_READING_DIRECTION]: ['t'],
        [ReaderHotkey.TOGGLE_AUTO_SCROLL]: ['space'],
        [ReaderHotkey.AUTO_SCROLL_SPEED_INCREASE]: ['b'],
        [ReaderHotkey.AUTO_SCROLL_SPEED_DECREASE]: ['v'],
        [ReaderHotkey.EXIT_READER]: ['c'],
    },
    imagePreLoadAmount: IMAGE_PRE_LOAD_AMOUNT.default,
    shouldUseAutoWebtoonMode: true,
    autoScroll: {
        value: AUTO_SCROLL_SPEED.default,
        smooth: true,
    },
    shouldShowReadingModePreview: true,
    shouldShowTapZoneLayoutPreview: true,
    shouldInformAboutMissingChapter: true,
    shouldInformAboutScanlatorChange: true,
    scrollAmount: ReaderScrollAmount.LARGE,
    shouldUseInfiniteScroll: true,
    shouldShowTransitionPage: true,
};

export const READER_PROGRESS_BAR_POSITION_TO_PLACEMENT: Record<ProgressBarPosition, TooltipProps['placement']> = {
    [ProgressBarPosition.BOTTOM]: 'top',
    [ProgressBarPosition.LEFT]: 'right',
    [ProgressBarPosition.RIGHT]: 'left',
    // should never get accessed
    [ProgressBarPosition.AUTO]: 'left',
};

export const READING_DIRECTION_VALUE_TO_DISPLAY_DATA: ValueToDisplayData<ReadingDirection> = {
    [ReadingDirection.LTR]: {
        title: 'reader.settings.reading_direction.ltr',
        icon: <ArrowCircleRightIcon />,
    },
    [ReadingDirection.RTL]: {
        title: 'reader.settings.reading_direction.rtl',
        icon: <ArrowCircleLeftIcon />,
    },
};

export const READING_DIRECTION_VALUES = Object.values(ReadingDirection).filter((value) => typeof value === 'number');

export const PAGE_SCALE_VALUE_TO_DISPLAY_DATA: ValueToDisplayData<ReaderPageScaleMode> = {
    [ReaderPageScaleMode.WIDTH]: {
        title: 'reader.settings.page_scale.width',
        icon: <ExpandIcon sx={{ transform: 'rotate(90deg)' }} />,
    },
    [ReaderPageScaleMode.HEIGHT]: {
        title: 'reader.settings.page_scale.height',
        icon: <ExpandIcon />,
    },
    [ReaderPageScaleMode.SCREEN]: {
        title: 'reader.settings.page_scale.screen',
        icon: <ZoomOutMapIcon />,
    },
    [ReaderPageScaleMode.ORIGINAL]: {
        title: 'reader.settings.page_scale.original',
        icon: <CropOriginalIcon />,
    },
};

export const READER_PAGE_SCALE_MODE_VALUES = Object.values(ReaderPageScaleMode).filter(
    (value) => typeof value === 'number',
);

export const READER_PAGE_SCALE_MODE_TO_SCALING_ALLOWED: Record<ReaderPageScaleMode, boolean> = {
    [ReaderPageScaleMode.WIDTH]: true,
    [ReaderPageScaleMode.HEIGHT]: true,
    [ReaderPageScaleMode.SCREEN]: true,
    [ReaderPageScaleMode.ORIGINAL]: false,
};

export const READING_MODE_VALUE_TO_DISPLAY_DATA = {
    [ReadingMode.SINGLE_PAGE]: {
        title: 'reader.settings.reader_type.label.single_page',
        icon: <SinglePageIcon />,
    },
    [ReadingMode.DOUBLE_PAGE]: {
        title: 'reader.settings.reader_type.label.double_page',
        icon: <DoublePageIcon />,
    },
    [ReadingMode.CONTINUOUS_VERTICAL]: {
        title: 'reader.settings.reader_type.label.continuous_vertical',
        icon: <ContinuousVerticalPageIcon />,
    },
    [ReadingMode.CONTINUOUS_HORIZONTAL]: {
        title: 'reader.settings.reader_type.label.continuous_horizontal',
        icon: <ContinuousHorizontalPageIcon />,
    },
    [ReadingMode.WEBTOON]: {
        title: 'reader.settings.reader_type.label.webtoon',
        icon: <WebtoonPageIcon />,
    },
} satisfies ValueToDisplayData<ReadingMode>;

export const READING_MODE_VALUES = Object.values(ReadingMode).filter((value) => typeof value === 'number');

export enum ReaderSettingTab {
    LAYOUT,
    GENERAL,
    FILTER,
    BEHAVIOUR,
    HOTKEYS,
}

export const READER_SETTING_TABS: Record<
    ReaderSettingTab,
    {
        id: ReaderSettingTab;
        label: TranslationKey;
        supportsTouchDevices: boolean;
    }
> = {
    [ReaderSettingTab.LAYOUT]: {
        id: ReaderSettingTab.LAYOUT,
        label: 'reader.settings.label.layout',
        supportsTouchDevices: true,
    },
    [ReaderSettingTab.GENERAL]: {
        id: ReaderSettingTab.GENERAL,
        label: 'global.label.general',
        supportsTouchDevices: true,
    },
    [ReaderSettingTab.FILTER]: {
        id: ReaderSettingTab.FILTER,
        label: 'reader.settings.custom_filter.title',
        supportsTouchDevices: true,
    },
    [ReaderSettingTab.BEHAVIOUR]: {
        id: ReaderSettingTab.BEHAVIOUR,
        label: 'reader.settings.label.behaviour',
        supportsTouchDevices: true,
    },
    [ReaderSettingTab.HOTKEYS]: {
        id: ReaderSettingTab.HOTKEYS,
        label: 'hotkeys.title_other',
        supportsTouchDevices: false,
    },
};

export const READER_HOTKEYS = Object.values(ReaderHotkey).filter(
    (hotkey) => typeof hotkey === 'number',
) as ReaderHotkey[];

export const READER_BACKGROUND_TO_COLOR = {
    [ReaderBackgroundColor.THEME]: 'background.default',
    [ReaderBackgroundColor.BLACK]: 'common.black',
    [ReaderBackgroundColor.GRAY]: 'grey.200',
    [ReaderBackgroundColor.WHITE]: 'common.white',
} as const satisfies Record<ReaderBackgroundColor, string>;

export const CONTINUOUS_READING_MODE_TO_SCROLL_DIRECTION: Record<
    ReadingMode,
    Exclude<ScrollDirection, ScrollDirection.XY>
> = {
    [ReadingMode.SINGLE_PAGE]: ScrollDirection.Y,
    [ReadingMode.DOUBLE_PAGE]: ScrollDirection.Y,
    [ReadingMode.CONTINUOUS_VERTICAL]: ScrollDirection.Y,
    [ReadingMode.CONTINUOUS_HORIZONTAL]: ScrollDirection.X,
    [ReadingMode.WEBTOON]: ScrollDirection.Y,
};

export const READER_BLEND_MODE_VALUE_TO_DISPLAY_DATA = {
    [ReaderBlendMode.DEFAULT]: {
        title: 'reader.settings.custom_filter.rgba.blend_mode.default',
        icon: null,
    },
    [ReaderBlendMode.MULTIPLY]: {
        title: 'reader.settings.custom_filter.rgba.blend_mode.multiply',
        icon: null,
    },
    [ReaderBlendMode.SCREEN]: {
        title: 'reader.settings.custom_filter.rgba.blend_mode.screen',
        icon: null,
    },
    [ReaderBlendMode.OVERLAY]: {
        title: 'reader.settings.custom_filter.rgba.blend_mode.overlay',
        icon: null,
    },
    [ReaderBlendMode.DARKEN]: {
        title: 'reader.settings.custom_filter.rgba.blend_mode.darken',
        icon: null,
    },
    [ReaderBlendMode.LIGHTEN]: {
        title: 'reader.settings.custom_filter.rgba.blend_mode.lighten',
        icon: null,
    },
} satisfies ValueToDisplayData<ReaderBlendMode>;

export const READER_BLEND_MODE_VALUES = Object.values(ReaderBlendMode);
