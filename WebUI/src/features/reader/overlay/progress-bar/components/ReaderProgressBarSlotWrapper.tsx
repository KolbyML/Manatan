/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box, { BoxProps } from '@mui/material/Box';
import { memo, ReactNode, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import { shouldForwardProp } from '@/base/utils/ShouldForwardProp.ts';
import { ReaderStatePages } from '@/features/reader/Reader.types.ts';

type StyledWrapperProps = {
    isFirstPage: boolean;
    isLastPage: boolean;
};
const StyledWrapper = memo(
    styled(Box, {
        shouldForwardProp: shouldForwardProp<StyledWrapperProps>(['isFirstPage', 'isLastPage']),
    })<BoxProps & StyledWrapperProps>(({ isFirstPage, isLastPage }) => ({
        flexGrow: 1,
        height: '100%',
        cursor: 'pointer',
        borderLeftWidth: isFirstPage ? 0 : undefined,
        borderRightWidth: isLastPage ? 0 : undefined,
    })),
);

export const ReaderProgressBarSlotWrapper = memo(
    ({
        page,
        pagesIndex,
        isCurrentPage,
        isLeadingPage,
        isTrailingPage,
        totalPages,
        showDraggingStyle,
        primaryPageLoadState,
        secondaryPageLoadState,
        createProgressBarSlot,
        ...boxProps
    }: {
        page: ReaderStatePages['pages'][number];
        pagesIndex: number;
        isCurrentPage: boolean;
        isLeadingPage: boolean;
        isTrailingPage: boolean;
        totalPages: number;
        showDraggingStyle: boolean;
        primaryPageLoadState: ReaderStatePages['pageLoadStates'][number]['loaded'];
        secondaryPageLoadState: ReaderStatePages['pageLoadStates'][number]['loaded'] | undefined;
        createProgressBarSlot: (
            page: ReaderStatePages['pages'][number],
            pagesIndex: number,
            primaryPageLoadState: ReaderStatePages['pageLoadStates'][number]['loaded'],
            secondaryPageLoadState: ReaderStatePages['pageLoadStates'][number]['loaded'] | undefined,
            isCurrentPage: boolean,
            isLeadingPage: boolean,
            isTrailingPage: boolean,
            totalPages: number,
            handleDragging: boolean,
        ) => ReactNode;
    } & BoxProps) => {
        const slot = useMemo(
            () =>
                createProgressBarSlot(
                    page,
                    pagesIndex,
                    primaryPageLoadState,
                    secondaryPageLoadState,
                    isCurrentPage,
                    isLeadingPage,
                    isTrailingPage,
                    totalPages,
                    showDraggingStyle,
                ),
            [
                createProgressBarSlot,
                page,
                pagesIndex,
                primaryPageLoadState,
                secondaryPageLoadState,
                isCurrentPage,
                isLeadingPage,
                isTrailingPage,
                totalPages,
                showDraggingStyle,
            ],
        );

        return (
            <StyledWrapper {...boxProps} isFirstPage={pagesIndex === 0} isLastPage={pagesIndex === totalPages - 1}>
                {slot}
            </StyledWrapper>
        );
    },
);
