/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import WebFont from 'webfontloader';
import { CssVarsThemeOptions } from '@mui/material/styles';
import { ControlledPromise } from '@/lib/ControlledPromise.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';

export class ThemeFontLoader {
    // https://developer.mozilla.org/en-US/docs/Web/CSS/generic-family
    private static readonly GENERIC_FONT_FAMILIES: readonly string[] = [
        'serif',
        'sans-serif',
        'monospace',
        'cursive',
        'fantasy',
        'system-ui',
        'ui-serif',
        'ui-sans-serif',
        'ui-monospace',
        'ui-rounded',
        'math',
        'emoji',
        'fangsong',
    ];

    private static readonly usableFonts: Record<string, Set<number>> = {};

    private static async isInstalled(fontName: string, weight: number | string): Promise<boolean> {
        return document.fonts.check(`${weight} 12px "${fontName}"`);
    }

    private static parseWeight(value: any): number | null {
        if (typeof value === 'number') return value;

        if (typeof value === 'string') {
            const parsed = Number(value);
            if (!Number.isNaN(parsed)) return parsed;

            // Handle CSS keywords
            switch (value.toLowerCase()) {
                case 'light':
                    return 300;
                case 'regular':
                    return 400;
                case 'medium':
                    return 500;
                case 'bold':
                    return 700;
                default: // Fall through
            }
        }

        return null;
    }

    private static extractWeights(obj: Record<string, any>): number[] {
        return Object.entries(obj)
            .filter(([key]) => key.startsWith('fontWeight'))
            .map(([, value]) => this.parseWeight(value))
            .filter((weight) => weight !== null);
    }

    private static extract(
        obj: Record<string, any>,
        fonts: Record<string, Set<number>> = {},
    ): Record<string, Set<number>> {
        const result = { ...fonts };

        for (const propertyName of Object.keys(obj)) {
            const propertyValue = obj[propertyName];
            const propertyType = typeof obj[propertyName];

            const isValidFontProperty = propertyName === 'fontFamily' && propertyType === 'string';
            if (isValidFontProperty) {
                const detectedFonts = propertyValue.split(',') as string[];
                const normalizedFonts = detectedFonts.map((detectedFont) => detectedFont.replace(/"/g, '').trim());

                const weights = this.extractWeights(obj);

                normalizedFonts.forEach((font) => {
                    result[font] = new Set([...(result[font] ?? []), ...weights].toSorted((a, b) => a - b));
                });

                // eslint-disable-next-line no-continue
                continue;
            }

            if (propertyType === 'object') {
                const nestedFonts = this.extract(propertyValue, result);
                Object.entries(nestedFonts).forEach(([font, weights]) => {
                    result[font] = new Set([...(result[font] ?? []), ...weights].toSorted((a, b) => a - b));
                });
            }
        }

        return result;
    }

    static hasMissing(theme: CssVarsThemeOptions): boolean {
        const fontWeightsMap = this.extract(theme.typography ?? {});
        const fontNames = Object.keys(fontWeightsMap);

        return fontNames.some((fontName) => {
            if (this.GENERIC_FONT_FAMILIES.includes(fontName.toLowerCase())) {
                return false;
            }

            const requiredWeights = fontWeightsMap[fontName];
            const usableWeights = this.usableFonts[fontName];

            if (!usableWeights) {
                return true;
            }

            return Array.from(requiredWeights).some((weight) => !usableWeights.has(weight));
        });
    }

    private static async detectMissing(fonts: Record<string, Set<number>>): Promise<Record<string, Set<number>>> {
        const pendingMissingFontWeightsEntries = Object.entries(fonts).map(async ([fontName, requiredWeights]) => {
            if (this.GENERIC_FONT_FAMILIES.includes(fontName.toLowerCase())) {
                return null;
            }

            const usableWeights = this.usableFonts[fontName] ?? new Set<number>();

            const weightChecks = await Promise.all(
                Array.from(requiredWeights).map(async (weight) => {
                    if (usableWeights.has(weight)) {
                        return null;
                    }

                    if (!(await this.isInstalled(fontName, weight))) {
                        return null;
                    }

                    return weight;
                }),
            );

            const missingWeights = new Set(weightChecks.filter((weight) => weight !== null));
            if (!missingWeights.size) {
                return null;
            }

            return [fontName, missingWeights];
        });
        const missingFontWeightsEntries = await Promise.all(pendingMissingFontWeightsEntries);

        return Object.fromEntries(missingFontWeightsEntries.filter(Boolean) as [string, Set<number>][]);
    }

    static async load(theme: CssVarsThemeOptions): Promise<void> {
        const fontWeightsMap = this.extract(theme.typography ?? {});

        const missingFontWeights = await this.detectMissing(fontWeightsMap);

        if (!Object.keys(missingFontWeights).length) {
            return;
        }

        // Transform to WebFont format: "Roboto:400,700"
        const webFontFamilies = Object.entries(missingFontWeights).map(([font, weights]) => {
            const weightsArray = Array.from(weights);

            if (!weightsArray.length) {
                return font;
            }

            return `${font}:${weightsArray.join(',')}`;
        });

        const loadFontsPromise = new ControlledPromise();
        try {
            WebFont.load({
                google: {
                    families: webFontFamilies,
                },
                active: () => {
                    Object.entries(missingFontWeights).forEach(([fontName, weights]) => {
                        this.usableFonts[fontName] ??= new Set();
                        weights.forEach((weight) => this.usableFonts[fontName].add(weight));
                    });
                    loadFontsPromise.resolve();
                },
                inactive: () => {
                    loadFontsPromise.reject();
                },
            });
        } catch (e) {
            defaultPromiseErrorHandler('ThemeFontLoader::load')(e);
            loadFontsPromise.reject(e);
        }

        await loadFontsPromise.promise;
    }
}
