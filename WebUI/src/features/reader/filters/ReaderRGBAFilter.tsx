/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { NavbarContextType } from '@/features/navigation-bar/NavigationBar.types.ts';
import { withPropsFrom } from '@/base/hoc/withPropsFrom.tsx';
import { useReaderSettingsStore } from '@/features/reader/stores/ReaderStore.ts';

const BaseReaderRGBAFilter = ({ readerNavBarWidth }: Pick<NavbarContextType, 'readerNavBarWidth'>) => {
    const {
        value: { red, green, blue, alpha, blendMode },
        enabled,
    } = useReaderSettingsStore((state) => state.settings.customFilter.rgba);

    if (!enabled) {
        return null;
    }

    return (
        <Box
            sx={{
                position: 'fixed',
                top: 0,
                left: readerNavBarWidth,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
                background: `rgba(${red} ${green} ${blue} / ${alpha}%)`,
                mixBlendMode: `${blendMode}`,
            }}
        />
    );
};

export const ReaderRGBAFilter = withPropsFrom(BaseReaderRGBAFilter, [useNavBarContext], ['readerNavBarWidth']);
