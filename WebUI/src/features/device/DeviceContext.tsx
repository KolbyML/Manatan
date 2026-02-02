/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { ReactNode, useContext, useMemo } from 'react';
import { DEFAULT_DEVICE, setActiveDevice } from '@/features/device/services/Device.ts';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';

export const DeviceContext = React.createContext<{
    activeDevice: string;
    setActiveDevice: (device: string) => void;
}>({
    activeDevice: DEFAULT_DEVICE,
    setActiveDevice: () => {},
});

export const ActiveDeviceContextProvider = ({ children }: { children?: ReactNode }) => {
    const [activeDevice, setActiveDeviceContext] = useLocalStorage('activeDevice', DEFAULT_DEVICE);
    const activeDeviceContext = useMemo(
        () => ({ activeDevice, setActiveDevice: setActiveDeviceContext }),
        [activeDevice],
    );

    setActiveDevice(activeDevice);

    return <DeviceContext.Provider value={activeDeviceContext}>{children}</DeviceContext.Provider>;
};

export const useDeviceContext = () => useContext(DeviceContext);
