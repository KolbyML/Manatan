/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import '@/polyfill.manual';
import '@/i18n';
import '@/lib/dayjs/Setup.ts';
import '@/lib/koration/Setup.ts';
import '@/index.css';
import '@/lib/PointerDeviceUtil.ts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';

// --- FORCE NATIVE APP VIEWPORT ---
const enforceViewport = () => {
    // Only apply on mobile devices to avoid breaking desktop zoom behavior
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;

    let meta = document.querySelector("meta[name='viewport']");
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'viewport');
        document.head.appendChild(meta);
    }
    // "user-scalable=no" gives us full control over the touch events
    meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    
    // Prevent iOS Safari bounce/rubber-banding on the document itself
    document.body.style.overscrollBehavior = 'none';
};
enforceViewport();
// ---------------------------------

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <StrictMode>
        <App />
    </StrictMode>,
);