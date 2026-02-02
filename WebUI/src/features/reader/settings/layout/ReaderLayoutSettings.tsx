/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { useTranslation } from 'react-i18next';
import { ReaderSettingReadingMode } from '@/features/reader/settings/layout/components/ReaderSettingReadingMode.tsx';
import { ReaderSettingReadingDirection } from '@/features/reader/settings/layout/components/ReaderSettingReadingDirection.tsx';
import { ReaderSettingTapZoneLayout } from '@/features/reader/settings/layout/components/ReaderSettingTapZoneLayout.tsx';
import { ReaderSettingTapZoneInvertMode } from '@/features/reader/settings/layout/components/ReaderSettingTapZoneInvertMode.tsx';
import { ReaderSettingPageScaleMode } from '@/features/reader/settings/layout/components/ReaderSettingPageScaleMode.tsx';
import { ReaderSettingStretchPage } from '@/features/reader/settings/layout/components/ReaderSettingStretchPage.tsx';
import { ReaderSettingsTypeProps } from '@/features/reader/Reader.types.ts';
import { ReaderSettingPageGap } from '@/features/reader/settings/layout/components/ReaderSettingPageGap.tsx';
import { ReaderSettingWidth } from '@/features/reader/settings/layout/components/ReaderSettingWidth.tsx';
import { DefaultSettingFootnote } from '@/features/reader/settings/components/DefaultSettingFootnote.tsx';
import { TReaderTapZoneContext } from '@/features/reader/tap-zones/TapZoneLayout.types.ts';
import { ReaderDefaultLayoutSettings } from '@/features/reader/settings/layout/ReaderDefaultLayoutSettings.tsx';

export const ReaderLayoutSettings = ({
    setShowPreview,
    settings,
    updateSetting,
    isDefaultable,
    onDefault,
    isSeriesMode,
    setTransparent,
}: ReaderSettingsTypeProps & {
    setShowPreview: TReaderTapZoneContext['setShowPreview'];
    isSeriesMode?: boolean;
}) => {
    const { t } = useTranslation();

    return (
        <Stack sx={{ gap: 2 }}>
            <DefaultSettingFootnote areDefaultSettings={!isDefaultable} />
            {isSeriesMode && (
                <>
                    <Typography>{t('reader.settings.source_series')}</Typography>
                    <ReaderSettingReadingMode
                        readingMode={settings.readingMode}
                        setReadingMode={(value) => updateSetting('readingMode', value)}
                        isDefaultable={isDefaultable}
                        onDefault={() => onDefault?.('readingMode')}
                    />
                </>
            )}
            <ReaderSettingPageGap
                pageGap={settings.pageGap}
                readingMode={settings.readingMode}
                isDefaultable={isDefaultable}
                onDefault={() => onDefault?.('pageGap')}
                updateSetting={(...args) => updateSetting('pageGap', ...args)}
            />
            <ReaderSettingReadingDirection
                readingDirection={settings.readingDirection}
                setReadingDirection={(value) => updateSetting('readingDirection', value)}
                isDefaultable={isDefaultable}
                onDefault={() => onDefault?.('readingDirection')}
            />
            <ReaderSettingTapZoneLayout
                tapZoneLayout={settings.tapZoneLayout}
                setTapZoneLayout={(value) => {
                    setShowPreview(true);
                    updateSetting('tapZoneLayout', value);
                }}
                isDefaultable={isDefaultable}
                onDefault={() => {
                    setShowPreview(true);
                    onDefault?.('tapZoneLayout');
                }}
            />
            <ReaderSettingTapZoneInvertMode
                tapZoneInvertMode={settings.tapZoneInvertMode}
                setTapZoneInvertMode={(value) => {
                    setShowPreview(true);
                    updateSetting('tapZoneInvertMode', value);
                }}
                isDefaultable={isDefaultable}
                onDefault={() => {
                    setShowPreview(true);
                    onDefault?.('tapZoneInvertMode');
                }}
            />
            <ReaderSettingPageScaleMode
                pageScaleMode={settings.pageScaleMode}
                setPageScaleMode={(value) => updateSetting('pageScaleMode', value)}
                isDefaultable={isDefaultable}
                onDefault={() => onDefault?.('pageScaleMode')}
            />
            <ReaderSettingStretchPage
                pageScaleMode={settings.pageScaleMode.value}
                shouldStretchPage={settings.shouldStretchPage.value}
                setShouldStretchPage={(value) => updateSetting('shouldStretchPage', value)}
            />
            <ReaderSettingWidth
                readerWidth={settings.readerWidth.value}
                pageScaleMode={settings.pageScaleMode.value}
                isDefaultable={isDefaultable}
                onDefault={() => onDefault?.('readerWidth')}
                updateSetting={(...args) => updateSetting(...args)}
                setTransparent={setTransparent}
            />
            {isSeriesMode && (
                <>
                    <Divider />
                    <ReaderDefaultLayoutSettings
                        profiles={[settings.readingMode.value]}
                        updateSetting={updateSetting}
                        isSeriesMode={isSeriesMode}
                        setTransparent={setTransparent}
                    />
                </>
            )}
        </Stack>
    );
};
