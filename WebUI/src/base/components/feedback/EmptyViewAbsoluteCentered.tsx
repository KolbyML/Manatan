/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { EmptyView, EmptyViewProps } from '@/base/components/feedback/EmptyView.tsx';

export function EmptyViewAbsoluteCentered({ sx, ...emptyViewProps }: EmptyViewProps) {
    return (
        <EmptyView
            {...emptyViewProps}
            sx={{
                position: 'absolute',
                minHeight: 'fill-available',
                ...sx,
            }}
        />
    );
}
