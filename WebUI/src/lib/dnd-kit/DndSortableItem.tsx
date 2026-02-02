/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import { useSortable } from '@dnd-kit/sortable';
import { ReactNode } from 'react';
import { UniqueIdentifier } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';

export const DndSortableItem = ({
    id,
    isDragging = false,
    children,
}: {
    id: UniqueIdentifier;
    isDragging?: boolean;
    children: ReactNode;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    return (
        <Box
            ref={setNodeRef}
            sx={{
                transform: CSS.Translate.toString(transform),
                transition,
                ...applyStyles(isDragging, {
                    opacity: 0.25,
                }),
            }}
            {...attributes}
            {...listeners}
        >
            {children}
        </Box>
    );
};
