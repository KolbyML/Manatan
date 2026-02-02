/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import { ComponentProps, memo } from 'react';
import { ProgressBarPosition } from '@/features/reader/Reader.types.ts';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { ReaderProgressBarSlot } from '@/features/reader/overlay/progress-bar/components/ReaderProgressBarSlot.tsx';

const SLOT_SX_PROP: NonNullable<NonNullable<ComponentProps<typeof ReaderProgressBarSlot>['slotProps']>['box']>['sx'] = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'end',
    position: 'relative',
    backgroundColor: 'background.default',
};

const POINT_SIZE = '3px';
const ProgressBarPagePoint = memo(
    ({
        isTrailingPage,
        pagesIndex,
        totalPages,
        isVertical,
        isHorizontal,
    }: {
        isTrailingPage: boolean;
        pagesIndex: number;
        totalPages: number;
        isVertical: boolean;
        isHorizontal: boolean;
    }) => {
        const position = `${(pagesIndex / (totalPages - 1)) * 100}%`;

        return (
            <Box
                sx={{
                    position: 'absolute',
                    ...applyStyles(isVertical, {
                        top: position,
                        left: '50%',
                    }),
                    ...applyStyles(isHorizontal, {
                        top: '50%',
                        left: position,
                    }),
                    transform: 'translate(-50%, -50%)',
                    width: POINT_SIZE,
                    height: POINT_SIZE,
                    borderRadius: 100,
                    backgroundColor: 'background.paper',
                    ...applyStyles(isTrailingPage, {
                        backgroundColor: 'primary.main',
                    }),
                    zIndex: 1,
                }}
            />
        );
    },
);

export const ReaderProgressBarSlotMobile = memo(
    ({
        pageName,
        isTrailingPage,
        isCurrentPage,
        pagesIndex,
        totalPages,
        isVertical,
        isHorizontal,
    }: {
        pageName: string;
        isTrailingPage: boolean;
        isCurrentPage: boolean;
        pagesIndex: number;
        totalPages: number;
        isVertical: boolean;
        isHorizontal: boolean;
    }) => (
        <ReaderProgressBarSlot
            pageName={pageName}
            progressBarPosition={ProgressBarPosition.BOTTOM}
            slotProps={{ box: { sx: SLOT_SX_PROP } }}
        >
            {!isCurrentPage && (
                <ProgressBarPagePoint
                    isTrailingPage={isTrailingPage}
                    pagesIndex={pagesIndex}
                    totalPages={totalPages}
                    isVertical={isVertical}
                    isHorizontal={isHorizontal}
                />
            )}
        </ReaderProgressBarSlot>
    ),
);
