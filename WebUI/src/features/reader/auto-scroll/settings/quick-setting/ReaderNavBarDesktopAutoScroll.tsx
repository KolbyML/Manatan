/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import PauseCircleFilledIcon from '@mui/icons-material/PauseCircleFilled';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { useRef } from 'react';
import { d } from 'koration';
import { IReaderSettings } from '@/features/reader/Reader.types.ts';
import { AUTO_SCROLL_SPEED } from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { coerceIn } from '@/lib/HelperFunctions.ts';
import { useReaderAutoScrollStore } from '@/features/reader/stores/ReaderStore.ts';

export const ReaderNavBarDesktopAutoScroll = ({
    autoScroll,
    setAutoScroll,
}: Pick<IReaderSettings, 'autoScroll'> & {
    setAutoScroll: (newAutoScroll: IReaderSettings['autoScroll'], commit: boolean) => void;
}) => {
    const { t } = useTranslation();
    const { isActive, toggleActive } = useReaderAutoScrollStore((state) => ({
        isActive: state.autoScroll.isActive,
        toggleActive: state.autoScroll.toggleActive,
    }));

    const updateTimeout = useRef<NodeJS.Timeout>(undefined);

    return (
        <Stack sx={{ flexDirection: 'row', gap: 1 }}>
            <Button
                sx={{ justifyContent: 'start', textTransform: 'unset', flexGrow: 1 }}
                size="large"
                onClick={toggleActive}
                color={isActive ? 'secondary' : 'primary'}
                variant="contained"
                startIcon={isActive ? <PauseCircleFilledIcon /> : <PlayCircleFilledIcon />}
            >
                {/* FIX 1: Auto Scroll Button Title */}
                <span className="yomitan-ghost-text" data-text={t('reader.settings.auto_scroll.title')} />
            </Button>
            <TextField
                value={autoScroll.value}
                type="number"
                size="small"
                onBlur={(e) => {
                    const value = coerceIn(+e.target.value, AUTO_SCROLL_SPEED.min, AUTO_SCROLL_SPEED.max);

                    if (value !== autoScroll.value) {
                        clearTimeout(updateTimeout.current);
                        setAutoScroll({ ...autoScroll, value }, true);
                    }
                }}
                onChange={(e) => {
                    const value = coerceIn(+e.target.value, AUTO_SCROLL_SPEED.min, AUTO_SCROLL_SPEED.max);
                    setAutoScroll({ ...autoScroll, value }, false);

                    clearTimeout(updateTimeout.current);
                    updateTimeout.current = setTimeout(
                        () => setAutoScroll({ ...autoScroll, value }, true),
                        d(1).seconds.inWholeMilliseconds,
                    );
                }}
                slotProps={{
                    input: {
                        inputProps: AUTO_SCROLL_SPEED,
                        endAdornment: (
                            <InputAdornment position="end">
                                {/* FIX 2: "Seconds" Label */}
                                <span 
                                    className="yomitan-ghost-text" 
                                    data-text={t('global.time.seconds.second', { count: autoScroll.value })} 
                                />
                            </InputAdornment>
                        ),
                    },
                }}
            />
        </Stack>
    );
};
