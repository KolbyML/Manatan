/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { CheckboxInput } from '@/base/components/inputs/CheckboxInput.tsx';
import { IReaderSettings } from '@/features/reader/Reader.types.ts';
import { SliderInput } from '@/base/components/inputs/SliderInput.tsx';
import { AUTO_SCROLL_SPEED, DEFAULT_READER_SETTINGS } from '@/features/reader/settings/ReaderSettings.constants.tsx';

export const ReaderSettingAutoScroll = ({
    autoScroll,
    setAutoScroll,
}: Pick<IReaderSettings, 'autoScroll'> & {
    setAutoScroll: (updatedAutoScroll: IReaderSettings['autoScroll'], commit: boolean) => void;
}) => {
    const { t } = useTranslation();

    return (
        <>
            <CheckboxInput
                label={t('reader.settings.auto_scroll.smooth')}
                checked={autoScroll.smooth}
                onChange={(_, checked) => setAutoScroll({ ...autoScroll, smooth: checked }, true)}
            />
            <SliderInput
                label={t('reader.settings.auto_scroll.speed')}
                value={t('global.time.seconds.value', { count: autoScroll.value })}
                onDefault={() =>
                    setAutoScroll({ ...autoScroll, value: DEFAULT_READER_SETTINGS.autoScroll.value }, true)
                }
                slotProps={{
                    label: {
                        className: 'yomitan-ghost-text',
                    },
                    value: {
                        className: 'yomitan-ghost-text',
                    },
                    slider: {
                        defaultValue: DEFAULT_READER_SETTINGS.customFilter.saturate.value,
                        value: autoScroll.value,
                        ...AUTO_SCROLL_SPEED,
                        onChange: (_, value) => {
                            setAutoScroll({ ...autoScroll, value: value as number }, false);
                        },
                        onChangeCommitted: (_, value) => {
                            setAutoScroll({ ...autoScroll, value: value as number }, true);
                        },
                    },
                }}
            />
        </>
    );
};
