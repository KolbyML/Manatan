/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { CssVarsThemeOptions } from '@mui/material/styles';
import { t as translate } from 'i18next';

export type TBaseTheme = {
    isCustom: boolean;
    getName: () => string;
    muiTheme: Omit<CssVarsThemeOptions, 'activeMode'>;
};

export const themes = {
    default: {
        isCustom: false,
        getName: () => translate('global.label.default'),
        muiTheme: {
            colorSchemes: {
                light: {
                    palette: {
                        primary: {
                            main: '#5b74ef',
                        },
                        secondary: {
                            main: '#efd65b',
                        },
                    },
                },
                dark: {
                    palette: {
                        primary: {
                            main: '#5b74ef',
                        },
                        secondary: {
                            main: '#efd65b',
                        },
                    },
                },
            },
        },
    },
    lavender: {
        isCustom: false,
        getName: () => translate('settings.appearance.theme.themes.lavender'),
        muiTheme: {
            colorSchemes: {
                light: {
                    palette: {
                        primary: {
                            main: '#6D41C8',
                        },
                        secondary: {
                            main: '#9bc841',
                        },
                        background: {
                            paper: '#E4D5F8',
                            default: '#EDE2FF',
                        },
                    },
                },
                dark: {
                    palette: {
                        primary: {
                            main: '#a076fd',
                        },
                        secondary: {
                            main: '#d2fd76',
                        },
                        background: {
                            paper: '#1d193b',
                            default: '#111129',
                        },
                    },
                },
            },
        },
    },
    dune: {
        isCustom: false,
        getName: () => translate('settings.appearance.theme.themes.dune'),
        muiTheme: {
            colorSchemes: {
                light: {
                    palette: {
                        primary: {
                            main: '#897869',
                        },
                        secondary: {
                            main: '#697a89',
                        },
                    },
                },
                dark: {
                    palette: {
                        primary: {
                            main: '#897869',
                        },
                        secondary: {
                            main: '#697a89',
                        },
                    },
                },
            },
        },
    },
    rosegold: {
        isCustom: false,
        getName: () => translate('settings.appearance.theme.themes.rosegold'),
        muiTheme: {
            colorSchemes: {
                light: {
                    palette: {
                        primary: {
                            main: '#C07F7A',
                        },
                        secondary: {
                            main: '#7ABBC0',
                        },
                        background: {
                            paper: '#EAE1E0',
                            default: '#F3EFEE',
                        },
                    },
                },
                dark: {
                    palette: {
                        primary: {
                            main: '#E9A7A1',
                        },
                        secondary: {
                            main: '#A1E3E9',
                        },
                    },
                },
            },
        },
    },
    'forest dew': {
        isCustom: false,
        getName: () => translate('settings.appearance.theme.themes.forest_dew'),
        muiTheme: {
            colorSchemes: {
                light: {
                    palette: {
                        primary: {
                            main: '#53a584',
                        },
                        secondary: {
                            main: '#a55374',
                        },
                    },
                },
                dark: {
                    palette: {
                        primary: {
                            main: '#53a584',
                        },
                        secondary: {
                            main: '#a55374',
                        },
                    },
                },
            },
        },
    },
    'montain sunset': {
        isCustom: false,
        getName: () => translate('settings.appearance.theme.themes.mountain_sunset'),
        muiTheme: {
            colorSchemes: {
                light: {
                    palette: {
                        primary: {
                            main: '#974258',
                        },
                        secondary: {
                            main: '#429780',
                        },
                        background: {
                            paper: '#e5d6da',
                            default: '#f7f3f4',
                        },
                    },
                },
                dark: {
                    palette: {
                        primary: {
                            main: '#c55a77',
                        },
                        secondary: {
                            main: '#5ac5a8',
                        },
                    },
                },
            },
        },
    },
    crimson: {
        isCustom: false,
        getName: () => translate('settings.appearance.theme.themes.crimson'),
        muiTheme: {
            colorSchemes: {
                light: {
                    palette: {
                        primary: {
                            main: '#DC143C',
                        },
                        secondary: {
                            main: '#14DCB4',
                        },
                    },
                },
                dark: {
                    palette: {
                        primary: {
                            main: '#DC143C',
                        },
                        secondary: {
                            main: '#14DCB4',
                        },
                    },
                },
            },
        },
    },
    'minty miracles': {
        isCustom: false,
        getName: () => translate('settings.appearance.theme.themes.minty_miracles'),
        muiTheme: {
            colorSchemes: {
                light: {
                    palette: {
                        primary: {
                            main: '#00c56a',
                        },
                        secondary: {
                            main: '#c5005c',
                        },
                        background: {
                            paper: '#d6eae0',
                            default: '#e9f3ee',
                        },
                    },
                },
                dark: {
                    palette: {
                        primary: {
                            main: '#5CE6A1',
                        },
                        secondary: {
                            main: '#E65CA1',
                        },
                    },
                },
            },
        },
    },
    'orange juice': {
        isCustom: false,
        getName: () => translate('settings.appearance.theme.themes.orange_juice'),
        muiTheme: {
            colorSchemes: {
                light: {
                    palette: {
                        primary: {
                            main: '#e74c00',
                        },
                        secondary: {
                            main: '#009ae7',
                        },
                        background: {
                            paper: '#ede3d3',
                            default: '#f5f0e8',
                        },
                    },
                },
                dark: {
                    palette: {
                        primary: {
                            main: '#ffb546',
                        },
                        secondary: {
                            main: '#4690ff',
                        },
                    },
                },
            },
        },
    },
    'bright pink': {
        isCustom: false,
        getName: () => translate('settings.appearance.theme.themes.bright_pink'),
        muiTheme: {
            colorSchemes: {
                light: {
                    palette: {
                        primary: {
                            main: '#FF007F',
                        },
                        secondary: {
                            main: '#00FF80',
                        },
                    },
                },
                dark: {
                    palette: {
                        primary: {
                            main: '#FF007F',
                        },
                        secondary: {
                            main: '#00FF80',
                        },
                    },
                },
            },
        },
    },
    veronica: {
        isCustom: false,
        getName: () => translate('settings.appearance.theme.themes.veronica'),
        muiTheme: {
            colorSchemes: {
                light: {
                    palette: {
                        primary: {
                            main: '#A020F0',
                        },
                        secondary: {
                            main: '#70F020',
                        },
                    },
                },
                dark: {
                    palette: {
                        primary: {
                            main: '#A020F0',
                        },
                        secondary: {
                            main: '#70F020',
                        },
                    },
                },
            },
        },
    },
    'tree frog green': {
        isCustom: false,
        getName: () => translate('settings.appearance.theme.themes.tree_frog_green'),
        muiTheme: {
            colorSchemes: {
                light: {
                    palette: {
                        primary: {
                            main: '#4f9513',
                        },
                        secondary: {
                            main: '#581395',
                        },
                        background: {
                            paper: '#dde6d0',
                            default: '#edf1e6',
                        },
                    },
                },
                dark: {
                    palette: {
                        primary: {
                            main: '#8ace31',
                        },
                        secondary: {
                            main: '#7531CE',
                        },
                    },
                },
            },
        },
    },
    'ying and yang': {
        isCustom: false,
        getName: () => translate('settings.appearance.theme.themes.ying_and_yang'),
        muiTheme: {
            colorSchemes: {
                light: {
                    palette: {
                        primary: {
                            main: '#000',
                        },
                        secondary: {
                            main: '#fff',
                        },
                        background: {
                            paper: '#efefef',
                            default: '#fff',
                        },
                    },
                },
                dark: {
                    palette: {
                        primary: {
                            main: '#fff',
                        },
                        secondary: {
                            main: '#000',
                        },
                    },
                },
            },
        },
    },
} as const satisfies Record<string, TBaseTheme>;
