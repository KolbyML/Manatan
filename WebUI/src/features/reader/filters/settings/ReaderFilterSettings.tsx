/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import { ReaderSettingBrightness } from '@/features/reader/filters/settings/components/ReaderSettingBrightness.tsx';
import { ReaderSettingContrast } from '@/features/reader/filters/settings/components/ReaderSettingContrast.tsx';
import { ReaderSettingSaturate } from '@/features/reader/filters/settings/components/ReaderSettingSaturate.tsx';
import { ReaderSettingHue } from '@/features/reader/filters/settings/components/ReaderSettingHue.tsx';
import { ReaderSettingRGBA } from '@/features/reader/filters/settings/components/ReaderSettingRGBA.tsx';
import { ReaderSettingSepia } from '@/features/reader/filters/settings/components/ReaderSettingSepia.tsx';
import { ReaderSettingGrayscale } from '@/features/reader/filters/settings/components/ReaderSettingGrayscale.tsx';
import { ReaderSettingInvert } from '@/features/reader/filters/settings/components/ReaderSettingInvert.tsx';
import { ReaderSettingsTypeProps } from '@/features/reader/Reader.types.ts';
import { ResetButton } from '@/base/components/buttons/ResetButton.tsx';

export const ReaderFilterSettings = ({
    settings: { customFilter },
    updateSetting,
    onDefault,
    setTransparent,
}: ReaderSettingsTypeProps) => {
    const update = (value: any, commit?: boolean) => {
        updateSetting('customFilter', value, commit);
        setTransparent?.(commit === undefined ? false : !commit);
    };

    return (
        <Stack sx={{ gap: 2 }}>
            <ReaderSettingBrightness
                brightness={customFilter.brightness}
                updateSetting={(key, value, commit) =>
                    update(
                        {
                            ...customFilter,
                            [key]: value,
                        },
                        commit,
                    )
                }
            />
            <ReaderSettingContrast
                contrast={customFilter.contrast}
                updateSetting={(key, value, commit) =>
                    update(
                        {
                            ...customFilter,
                            [key]: value,
                        },
                        commit,
                    )
                }
            />
            <ReaderSettingSaturate
                saturate={customFilter.saturate}
                updateSetting={(key, value, commit) =>
                    update(
                        {
                            ...customFilter,
                            [key]: value,
                        },
                        commit,
                    )
                }
            />
            <ReaderSettingHue
                hue={customFilter.hue}
                updateSetting={(key, value, commit) =>
                    update(
                        {
                            ...customFilter,
                            [key]: value,
                        },
                        commit,
                    )
                }
            />
            <ReaderSettingRGBA
                rgba={customFilter.rgba}
                updateSetting={(key, value, commit) =>
                    update(
                        {
                            ...customFilter,
                            [key]: value,
                        },
                        commit,
                    )
                }
            />
            <ReaderSettingSepia
                sepia={customFilter.sepia}
                updateSetting={(value) =>
                    update({
                        ...customFilter,
                        sepia: value,
                    })
                }
            />
            <ReaderSettingGrayscale
                grayscale={customFilter.grayscale}
                updateSetting={(value) =>
                    update({
                        ...customFilter,
                        grayscale: value,
                    })
                }
            />
            <ReaderSettingInvert
                invert={customFilter.invert}
                updateSetting={(value) =>
                    update({
                        ...customFilter,
                        invert: value,
                    })
                }
            />
            <Stack sx={{ alignItems: 'end' }}>
                <ResetButton onClick={() => onDefault?.('customFilter')} variant="outlined" />
            </Stack>
        </Stack>
    );
};
