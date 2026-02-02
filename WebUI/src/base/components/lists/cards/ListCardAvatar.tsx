/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ComponentProps } from 'react';
import { AvatarSpinner } from '@/base/components/AvatarSpinner.tsx';

export const ListCardAvatar = (props: ComponentProps<typeof AvatarSpinner>) => {
    const { slots } = props;

    return (
        <AvatarSpinner
            {...props}
            slots={{
                ...slots,
                avatarProps: {
                    ...slots?.avatarProps,
                    sx: {
                        width: 56,
                        height: 56,
                        flex: '0 0 auto',
                        background: 'transparent',
                        ...slots?.avatarProps?.sx,
                    },
                },
            }}
        />
    );
};
