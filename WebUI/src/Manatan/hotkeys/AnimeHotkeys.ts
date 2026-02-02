export enum AnimeHotkey {
    TOGGLE_PLAY = 'toggle_play',
    PREVIOUS_SUBTITLE = 'previous_subtitle',
    NEXT_SUBTITLE = 'next_subtitle',
    REPEAT_SUBTITLE = 'repeat_subtitle',
    TOGGLE_SUBTITLES = 'toggle_subtitles',
    ALIGN_PREVIOUS_SUBTITLE = 'align_previous_subtitle',
    ALIGN_NEXT_SUBTITLE = 'align_next_subtitle',
    OFFSET_SUBTITLE_BACK_100 = 'offset_subtitle_back_100',
    OFFSET_SUBTITLE_FORWARD_100 = 'offset_subtitle_forward_100',
}

export const ANIME_HOTKEYS = [
    AnimeHotkey.TOGGLE_PLAY,
    AnimeHotkey.PREVIOUS_SUBTITLE,
    AnimeHotkey.NEXT_SUBTITLE,
    AnimeHotkey.REPEAT_SUBTITLE,
    AnimeHotkey.TOGGLE_SUBTITLES,
    AnimeHotkey.ALIGN_PREVIOUS_SUBTITLE,
    AnimeHotkey.ALIGN_NEXT_SUBTITLE,
    AnimeHotkey.OFFSET_SUBTITLE_BACK_100,
    AnimeHotkey.OFFSET_SUBTITLE_FORWARD_100,
] as const;

export const DEFAULT_ANIME_HOTKEYS: Record<AnimeHotkey, string[]> = {
    [AnimeHotkey.TOGGLE_PLAY]: ['space'],
    [AnimeHotkey.PREVIOUS_SUBTITLE]: ['arrowleft'],
    [AnimeHotkey.NEXT_SUBTITLE]: ['arrowright'],
    [AnimeHotkey.REPEAT_SUBTITLE]: ['arrowup'],
    [AnimeHotkey.TOGGLE_SUBTITLES]: ['arrowdown'],
    [AnimeHotkey.ALIGN_PREVIOUS_SUBTITLE]: ['ctrl+arrowleft'],
    [AnimeHotkey.ALIGN_NEXT_SUBTITLE]: ['ctrl+arrowright'],
    [AnimeHotkey.OFFSET_SUBTITLE_BACK_100]: ['ctrl+shift+arrowleft'],
    [AnimeHotkey.OFFSET_SUBTITLE_FORWARD_100]: ['ctrl+shift+arrowright'],
};

export const ANIME_HOTKEY_LABELS: Record<AnimeHotkey, string> = {
    [AnimeHotkey.TOGGLE_PLAY]: 'Play/Pause',
    [AnimeHotkey.PREVIOUS_SUBTITLE]: 'Previous subtitle',
    [AnimeHotkey.NEXT_SUBTITLE]: 'Next subtitle',
    [AnimeHotkey.REPEAT_SUBTITLE]: 'Repeat current subtitle',
    [AnimeHotkey.TOGGLE_SUBTITLES]: 'Toggle subtitles',
    [AnimeHotkey.ALIGN_PREVIOUS_SUBTITLE]: 'Align previous subtitle start',
    [AnimeHotkey.ALIGN_NEXT_SUBTITLE]: 'Align next subtitle start',
    [AnimeHotkey.OFFSET_SUBTITLE_BACK_100]: 'Offset -100ms',
    [AnimeHotkey.OFFSET_SUBTITLE_FORWARD_100]: 'Offset +100ms',
};

export const ANIME_HOTKEY_DESCRIPTIONS: Record<AnimeHotkey, string> = {
    [AnimeHotkey.TOGGLE_PLAY]: 'Play or pause the video',
    [AnimeHotkey.PREVIOUS_SUBTITLE]: 'Jump to the previous subtitle start',
    [AnimeHotkey.NEXT_SUBTITLE]: 'Jump to the next subtitle start',
    [AnimeHotkey.REPEAT_SUBTITLE]: 'Replay the current subtitle',
    [AnimeHotkey.TOGGLE_SUBTITLES]: 'Hide or show subtitles',
    [AnimeHotkey.ALIGN_PREVIOUS_SUBTITLE]: 'Align the previous subtitle start to the current time',
    [AnimeHotkey.ALIGN_NEXT_SUBTITLE]: 'Align the next subtitle start to the current time',
    [AnimeHotkey.OFFSET_SUBTITLE_BACK_100]: 'Nudge subtitle offset back by 100ms',
    [AnimeHotkey.OFFSET_SUBTITLE_FORWARD_100]: 'Nudge subtitle offset forward by 100ms',
};
