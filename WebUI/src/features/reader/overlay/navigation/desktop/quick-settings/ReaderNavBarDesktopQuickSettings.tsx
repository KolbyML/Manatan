/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import SettingsIcon from '@mui/icons-material/Settings';
import { memo } from 'react';
import { ReaderNavBarDesktopPageScale } from '@/features/reader/overlay/navigation/desktop/quick-settings/components/ReaderNavBarDesktopPageScale.tsx';
import { ReaderNavBarDesktopReadingMode } from '@/features/reader/overlay/navigation/desktop/quick-settings/components/ReaderNavBarDesktopReadingMode.tsx';
import { ReaderNavBarDesktopOffsetDoubleSpread } from '@/features/reader/overlay/navigation/desktop/quick-settings/components/ReaderNavBarDesktopOffsetDoubleSpread.tsx';
import { ReaderNavBarDesktopReadingDirection } from '@/features/reader/overlay/navigation/desktop/quick-settings/components/ReaderNavBarDesktopReadingDirection.tsx';
import { ReaderNavBarDesktopProps } from '@/features/reader/overlay/ReaderOverlay.types.ts';
import { ReaderService } from '@/features/reader/services/ReaderService.ts';
import { ReaderNavBarDesktopAutoScroll } from '@/features/reader/auto-scroll/settings/quick-setting/ReaderNavBarDesktopAutoScroll.tsx';
import { useReaderSettingsStore } from '@/features/reader/stores/ReaderStore.ts';

const BaseReaderNavBarDesktopQuickSettings = ({ openSettings }: Pick<ReaderNavBarDesktopProps, 'openSettings'>) => {
    const { t } = useTranslation();
    const { readingMode, shouldOffsetDoubleSpreads, pageScaleMode, shouldStretchPage, readingDirection, autoScroll } =
        useReaderSettingsStore((state) => ({
            readingMode: state.settings.readingMode,
            shouldOffsetDoubleSpreads: state.settings.shouldOffsetDoubleSpreads,
            pageScaleMode: state.settings.pageScaleMode,
            shouldStretchPage: state.settings.shouldStretchPage,
            readingDirection: state.settings.readingDirection,
            autoScroll: state.settings.autoScroll,
        }));

    return (
        <Stack sx={{ gap: 1 }}>
            <ReaderNavBarDesktopReadingMode
                readingMode={readingMode}
                setReadingMode={(value) => ReaderService.updateSetting('readingMode', value)}
                isDefaultable
                onDefault={() => ReaderService.deleteSetting('readingMode')}
            />
            <ReaderNavBarDesktopOffsetDoubleSpread
                readingMode={readingMode.value}
                shouldOffsetDoubleSpreads={shouldOffsetDoubleSpreads.value}
                setShouldOffsetDoubleSpreads={(value) =>
                    ReaderService.updateSetting('shouldOffsetDoubleSpreads', value)
                }
            />
            <ReaderNavBarDesktopPageScale
                pageScaleMode={pageScaleMode}
                shouldStretchPage={shouldStretchPage}
                updateSetting={ReaderService.updateSetting}
                isDefaultable
                onDefault={() => ReaderService.deleteSetting('pageScaleMode')}
            />
            <ReaderNavBarDesktopReadingDirection
                readingDirection={readingDirection}
                setReadingDirection={(value) => ReaderService.updateSetting('readingDirection', value)}
                isDefaultable
                onDefault={() => ReaderService.deleteSetting('readingDirection')}
            />
            <ReaderNavBarDesktopAutoScroll
                autoScroll={autoScroll}
                setAutoScroll={(...args) => ReaderService.updateSetting('autoScroll', ...args)}
            />
            <Button
                onClick={() => openSettings()}
                size="large"
                sx={{ justifyContent: 'start', textTransform: 'none' }}
                variant="contained"
                startIcon={<SettingsIcon />}
            >
                {t('settings.title')}
            </Button>
        </Stack>
    );
};

export const ReaderNavBarDesktopQuickSettings = memo(BaseReaderNavBarDesktopQuickSettings);
