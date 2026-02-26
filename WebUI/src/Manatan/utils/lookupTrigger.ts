import type { LookupTriggerKey } from '@/Manatan/types';

type MouseEventLike = {
    button: number;
    shiftKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
};

type KeyboardEventLike = {
    key: string;
    shiftKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
};

export const LOOKUP_TRIGGER_OPTIONS: Array<{ value: LookupTriggerKey; label: string }> = [
    { value: 'left-click', label: 'Left Click' },
    { value: 'right-click', label: 'Right Click' },
    { value: 'middle-click', label: 'Middle Click' },
    { value: 'shift', label: 'Shift' },
    { value: 'control', label: 'Control' },
    { value: 'alt', label: 'Alt' },
    { value: 'super', label: 'Super' },
];

export const DEFAULT_LOOKUP_TRIGGER: LookupTriggerKey = 'left-click';

const LOOKUP_TRIGGER_SET = new Set<LookupTriggerKey>(
    LOOKUP_TRIGGER_OPTIONS.map((option) => option.value),
);

const hasAnyModifier = (event: MouseEventLike): boolean => {
    return event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;
};

export const normalizeLookupTrigger = (value: unknown): LookupTriggerKey => {
    if (typeof value !== 'string') {
        return DEFAULT_LOOKUP_TRIGGER;
    }
    if (LOOKUP_TRIGGER_SET.has(value as LookupTriggerKey)) {
        return value as LookupTriggerKey;
    }
    return DEFAULT_LOOKUP_TRIGGER;
};

export const isLookupTriggerEvent = (
    event: MouseEventLike,
    trigger: LookupTriggerKey,
): boolean => {
    switch (trigger) {
        case 'left-click':
            return event.button === 0 && !hasAnyModifier(event);
        case 'right-click':
            return event.button === 2 && !hasAnyModifier(event);
        case 'middle-click':
            return event.button === 1 && !hasAnyModifier(event);
        case 'shift':
            return event.shiftKey;
        case 'control':
            return event.ctrlKey;
        case 'alt':
            return event.altKey;
        case 'super':
            return event.metaKey;
        default:
            return false;
    }
};

export const isModifierLookupTrigger = (trigger: LookupTriggerKey): boolean => {
    return trigger === 'shift' || trigger === 'control' || trigger === 'alt' || trigger === 'super';
};

export const isLookupTriggerKeyboardEvent = (
    event: KeyboardEventLike,
    trigger: LookupTriggerKey,
): boolean => {
    switch (trigger) {
        case 'shift':
            return event.key === 'Shift';
        case 'control':
            return event.key === 'Control';
        case 'alt':
            return event.key === 'Alt';
        case 'super':
            return event.key === 'Meta' || event.key === 'OS';
        default:
            return false;
    }
};
