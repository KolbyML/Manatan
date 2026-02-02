/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { GridLayouts } from '@/base/components/GridLayouts.tsx';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { GridLayout } from '@/base/Base.types.ts';

export function SourceGridLayout() {
    const [sourceGridLayout, setSourceGridLayout] = useLocalStorage('source-grid-layout', GridLayout.Compact);

    return <GridLayouts gridLayout={sourceGridLayout} onChange={setSourceGridLayout} />;
}
