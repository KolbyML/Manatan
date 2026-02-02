/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ReactNode } from 'react';
import { SplashScreen } from '@/features/authentication/components/SplashScreen.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { AuthManager } from '@/features/authentication/AuthManager.ts';

export const AuthGuard = ({ children }: { children: ReactNode }) => {
    const { isAuthRequired } = AuthManager.useSession();

    requestManager.useGetAbout({
        skip: isAuthRequired !== null,
        onCompleted: () => {
            if (AuthManager.isAuthInitialized()) {
                return;
            }

            AuthManager.setAuthRequired(false);
            AuthManager.setAuthInitialized(true);
            requestManager.processQueues();
        },
    });

    if (isAuthRequired === null) {
        return <SplashScreen />;
    }

    return children;
};
