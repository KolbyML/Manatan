/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    MouseSensor,
    PointerSensorOptions,
    Sensor,
    SensorDescriptor,
    TouchSensor,
    useSensor,
    SensorOptions,
    useSensors,
} from '@dnd-kit/core';
import { AbstractPointerSensorOptions, PointerActivationConstraint } from '@dnd-kit/core/dist/sensors';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';

export class DndKitUtil {
    static getSensorForDevice(): Sensor<PointerSensorOptions> {
        if (MediaQuery.isTouchDevice()) {
            return TouchSensor;
        }

        return MouseSensor;
    }

    static useGetSensorForDevice(): Sensor<PointerSensorOptions> {
        MediaQuery.useIsTouchDevice();

        return DndKitUtil.getSensorForDevice();
    }

    static useGetActivationConstraintForDevice(): PointerActivationConstraint {
        const isTouchDevice = MediaQuery.useIsTouchDevice();

        if (isTouchDevice) {
            return {
                delay: 300,
                tolerance: 8,
            };
        }

        return {
            distance: 8,
        };
    }

    static useSensorsForDevice(options?: AbstractPointerSensorOptions): SensorDescriptor<SensorOptions>[] {
        const sensor = DndKitUtil.useGetSensorForDevice();
        const activationConstraint = DndKitUtil.useGetActivationConstraintForDevice();

        return useSensors(
            useSensor(sensor, {
                ...options,
                activationConstraint: {
                    ...activationConstraint,
                    ...options?.activationConstraint,
                },
            }),
        );
    }
}
