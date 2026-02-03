/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export const jsonSaveParse = <T = any>(...args: Parameters<typeof JSON.parse>): T | null => {
    try {
        return JSON.parse(...args);
    } catch (e) {
        return null;
    }
};

export const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    if (error == null) {
        return '';
    }

    return `${error}`;
};

export const getValueFromObject = <T>(obj: Record<string, any>, key: string): T => {
    const keys = key.split('.');

    return keys.reduce((acc, curr) => acc?.[curr], obj) as T;
};

export const coerceIn = (value: number, min: number, max: number): number => Math.max(Math.min(value, max), min);

export const noOp = () => {};
