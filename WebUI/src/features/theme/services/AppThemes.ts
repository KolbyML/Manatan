/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { TBaseTheme, themes } from '@/features/theme/Themes.ts';

export type AppThemes = keyof typeof themes | string;

export type AppTheme = TBaseTheme & { id: AppThemes; isCustom: boolean };

export const appThemes = (Object.entries(themes) as [AppThemes, TBaseTheme][]).map(([id, theme]) => ({
    id,
    ...theme,
})) satisfies AppTheme[];

export const getTheme = (id: AppThemes | undefined, customThemes: Record<string, AppTheme> = {}): AppTheme => {
    // TODO - This is a workaround to fix a type error which causes a white screen.
    //        It should be removed and replaced with a proper migration logic, which would then e.g., add a migration to
    //        remove deprecated/outdated settings from the local storage
    const actualId = id === undefined ? 'default' : id;

    const allThemes = { ...themes, ...customThemes };
    const theme = (allThemes[actualId as keyof typeof themes] as AppTheme) ?? themes.default;

    return {
        // @ts-ignore - custom themes do not have a "getName" function
        getName: () => id,
        // @ts-ignore - app themes do not have the "id" prop by default
        id,
        ...theme,
    };
};

export const isThemeNameUnique = (id: string, customThemes: Record<string, AppTheme>): boolean =>
    Object.keys({ ...themes, ...customThemes }).every((themeId) => themeId.toLowerCase() !== id.toLowerCase());
