/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ContextProp, TopItemListProps } from 'react-virtuoso';
import { ComponentProps, useMemo } from 'react';
import Box from '@mui/material/Box';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { GroupedVirtuosoPersisted } from '@/lib/virtuoso/Component/GroupedVirtuosoPersisted.tsx';

const StickyVirtuosoHeaderWithOffset =
    (topOffset: number) =>
    ({ children, ...args }: TopItemListProps & ContextProp<unknown>) => (
        <Box {...args} style={{ ...args.style, top: topOffset }}>
            {children}
        </Box>
    );

export const StyledGroupedVirtuoso = ({
    heightToSubtract = 0,
    style,
    ...props
}: ComponentProps<typeof GroupedVirtuosoPersisted> & { heightToSubtract?: number }) => {
    const { appBarHeight, bottomBarHeight } = useNavBarContext();

    const TopItemList = useMemo(
        () => StickyVirtuosoHeaderWithOffset(appBarHeight + heightToSubtract),
        [appBarHeight, heightToSubtract],
    );

    return (
        <GroupedVirtuosoPersisted
            useWindowScroll
            {...props}
            components={{
                TopItemList,
                ...props.components,
            }}
            style={{
                ...style,
                height: `calc(100vh - ${heightToSubtract}px - ${appBarHeight}px - ${bottomBarHeight}px - ${!bottomBarHeight ? 'env(safe-area-inset-bottom)' : '0px'})`,
            }}
        />
    );
};
