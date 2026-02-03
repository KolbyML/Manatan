/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { SplashScreen } from '@/features/authentication/components/SplashScreen.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { AuthManager } from '@/features/authentication/AuthManager.ts';

export const AuthGuard = ({ children }: { children: ReactNode }) => {
    const { isAuthRequired } = AuthManager.useSession();
    const [baseUrl, setBaseUrl] = requestManager.useBaseUrl();
    const fallbackAttemptedRef = useRef(false);
    const fallbackBaseUrl = useMemo(() => import.meta.env.VITE_SERVER_URL_DEFAULT, []);

    useEffect(() => {
        console.info('[auth] AuthGuard state', { isAuthRequired });
    }, [isAuthRequired]);

    requestManager.useGetAbout({
        skip: isAuthRequired !== null,
        onCompleted: () => {
            console.info('[auth] /api/v1/about completed');
            if (AuthManager.isAuthInitialized()) {
                return;
            }

            AuthManager.setAuthRequired(false);
            AuthManager.setAuthInitialized(true);
            requestManager.processQueues();
        },
        onError: (error) => {
            console.warn('[auth] /api/v1/about failed', { message: error?.message });
            if (
                !fallbackAttemptedRef.current &&
                fallbackBaseUrl &&
                baseUrl !== fallbackBaseUrl &&
                /status\s+(502|404)|Failed to fetch|Response is not json/i.test(error?.message ?? '')
            ) {
                fallbackAttemptedRef.current = true;
                console.warn('[auth] resetting server base url', { from: baseUrl, to: fallbackBaseUrl });
                setBaseUrl(fallbackBaseUrl);
                requestManager.reset();
            }
        },
    });

    if (isAuthRequired === null) {
        console.info('[auth] AuthGuard showing splash screen');
        return <SplashScreen />;
    }

    return children;
};
