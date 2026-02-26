type KeyboardEventLike = {
    key: string;
    shiftKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
};

type ParsedHotkey = {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
    key: string | null;
};

export type TextBoxContextMenuMouseHotkey = 'right-click' | 'middle-click';

export const TEXTBOX_CONTEXT_MENU_MOUSE_HOTKEY_OPTIONS: Array<{
    value: TextBoxContextMenuMouseHotkey;
    label: string;
}> = [
    { value: 'right-click', label: 'Right Click' },
    { value: 'middle-click', label: 'Middle Click' },
];

export const DEFAULT_TEXTBOX_CONTEXT_MENU_HOTKEY = '';
export const DEFAULT_TEXTBOX_CONTEXT_MENU_HOTKEYS: string[] = ['right-click'];

const TEXTBOX_CONTEXT_MENU_MOUSE_HOTKEY_SET = new Set<TextBoxContextMenuMouseHotkey>(
    TEXTBOX_CONTEXT_MENU_MOUSE_HOTKEY_OPTIONS.map((option) => option.value),
);

export const normalizeLegacyTextBoxContextMenuTrigger = (value: unknown): TextBoxContextMenuMouseHotkey => {
    if (typeof value !== 'string') {
        return 'right-click';
    }
    if (TEXTBOX_CONTEXT_MENU_MOUSE_HOTKEY_SET.has(value as TextBoxContextMenuMouseHotkey)) {
        return value as TextBoxContextMenuMouseHotkey;
    }
    return 'right-click';
};

const normalizeMouseHotkeyToken = (value: string): TextBoxContextMenuMouseHotkey | null => {
    const normalized = value.trim().toLowerCase();
    if (TEXTBOX_CONTEXT_MENU_MOUSE_HOTKEY_SET.has(normalized as TextBoxContextMenuMouseHotkey)) {
        return normalized as TextBoxContextMenuMouseHotkey;
    }
    return null;
};

const normalizeModifierToken = (value: string): 'Ctrl' | 'Alt' | 'Shift' | 'Meta' | null => {
    switch (value.trim().toLowerCase()) {
        case 'ctrl':
        case 'control':
            return 'Ctrl';
        case 'alt':
            return 'Alt';
        case 'shift':
            return 'Shift';
        case 'meta':
        case 'super':
        case 'cmd':
        case 'command':
        case 'os':
            return 'Meta';
        default:
            return null;
    }
};

const normalizeKeyToken = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const modifierToken = normalizeModifierToken(trimmed);
    if (modifierToken) {
        return null;
    }

    if (trimmed.length === 1) {
        return trimmed.toUpperCase();
    }

    switch (trimmed.toLowerCase()) {
        case 'contextmenu':
        case 'menu':
        case 'apps':
            return 'ContextMenu';
        case 'spacebar':
        case 'space':
            return 'Space';
        case 'esc':
        case 'escape':
            return 'Escape';
        case 'del':
        case 'delete':
            return 'Delete';
        case 'ins':
        case 'insert':
            return 'Insert';
        case 'arrowup':
        case 'up':
            return 'ArrowUp';
        case 'arrowdown':
        case 'down':
            return 'ArrowDown';
        case 'arrowleft':
        case 'left':
            return 'ArrowLeft';
        case 'arrowright':
        case 'right':
            return 'ArrowRight';
        case 'pagedown':
            return 'PageDown';
        case 'pageup':
            return 'PageUp';
        default:
            return `${trimmed[0]?.toUpperCase() ?? ''}${trimmed.slice(1)}`;
    }
};

const parseTextBoxContextMenuHotkey = (value: unknown): ParsedHotkey | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const mouseHotkey = normalizeMouseHotkeyToken(value);
    if (mouseHotkey) {
        return null;
    }

    const tokens = value
        .split('+')
        .map((token) => token.trim())
        .filter(Boolean);

    if (!tokens.length) {
        return null;
    }

    const parsed: ParsedHotkey = {
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
        key: null,
    };

    for (const token of tokens) {
        const modifierToken = normalizeModifierToken(token);
        if (modifierToken === 'Ctrl') {
            parsed.ctrl = true;
        } else if (modifierToken === 'Alt') {
            parsed.alt = true;
        } else if (modifierToken === 'Shift') {
            parsed.shift = true;
        } else if (modifierToken === 'Meta') {
            parsed.meta = true;
        } else {
            const keyToken = normalizeKeyToken(token);
            if (!keyToken || parsed.key) {
                return null;
            }
            parsed.key = keyToken;
        }
    }

    if (!parsed.ctrl && !parsed.alt && !parsed.shift && !parsed.meta && !parsed.key) {
        return null;
    }

    return parsed;
};

const formatParsedHotkey = (hotkey: ParsedHotkey): string => {
    const tokens: string[] = [];
    if (hotkey.ctrl) {
        tokens.push('Ctrl');
    }
    if (hotkey.alt) {
        tokens.push('Alt');
    }
    if (hotkey.shift) {
        tokens.push('Shift');
    }
    if (hotkey.meta) {
        tokens.push('Meta');
    }
    if (hotkey.key) {
        tokens.push(hotkey.key);
    }
    return tokens.join('+');
};

export const normalizeTextBoxContextMenuHotkey = (value: unknown): string => {
    if (typeof value !== 'string') {
        return DEFAULT_TEXTBOX_CONTEXT_MENU_HOTKEY;
    }

    const mouseHotkey = normalizeMouseHotkeyToken(value);
    if (mouseHotkey) {
        return mouseHotkey;
    }

    const parsed = parseTextBoxContextMenuHotkey(value);
    return parsed ? formatParsedHotkey(parsed) : DEFAULT_TEXTBOX_CONTEXT_MENU_HOTKEY;
};

export const normalizeTextBoxContextMenuHotkeys = (value: unknown): string[] => {
    const rawHotkeys = Array.isArray(value) ? value : [value];
    const normalized = rawHotkeys.map((hotkey) => normalizeTextBoxContextMenuHotkey(hotkey)).filter(Boolean);

    const unique: string[] = [];
    const seen = new Set<string>();
    normalized.forEach((hotkey) => {
        const key = hotkey.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(hotkey);
        }
    });

    return unique;
};

export const hasTextBoxContextMenuMouseHotkey = (hotkeys: string[], hotkey: TextBoxContextMenuMouseHotkey): boolean =>
    hotkeys.some((value) => normalizeMouseHotkeyToken(value) === hotkey);

export const isTextBoxContextMenuHotkeyEvent = (event: KeyboardEventLike, hotkey: string): boolean => {
    const parsedHotkey = parseTextBoxContextMenuHotkey(hotkey);
    if (!parsedHotkey) {
        return false;
    }

    if (
        event.ctrlKey !== parsedHotkey.ctrl ||
        event.altKey !== parsedHotkey.alt ||
        event.shiftKey !== parsedHotkey.shift ||
        event.metaKey !== parsedHotkey.meta
    ) {
        return false;
    }

    if (!parsedHotkey.key) {
        const modifierToken = normalizeModifierToken(event.key);
        return (
            (modifierToken === 'Ctrl' && parsedHotkey.ctrl) ||
            (modifierToken === 'Alt' && parsedHotkey.alt) ||
            (modifierToken === 'Shift' && parsedHotkey.shift) ||
            (modifierToken === 'Meta' && parsedHotkey.meta)
        );
    }

    return normalizeKeyToken(event.key) === parsedHotkey.key;
};
