/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import React, { useState } from 'react';
import { TabPanel } from '@/base/components/tabs/TabPanel.tsx';
import { OptionsPanel } from '@/base/components/modals/OptionsPanel.tsx';

interface IProps<T = string> {
    open: boolean;
    onClose: () => void;
    tabs: T[];
    tabTitle: (key: T) => React.ReactNode;
    tabContent: (key: T) => React.ReactNode;
    minHeight?: number;
}

export const OptionsTabs = <T extends string = string>({
    open,
    onClose,
    tabs,
    tabTitle,
    tabContent,
    minHeight,
}: IProps<T>) => {
    const [tabNum, setTabNum] = useState(0);

    return (
        <OptionsPanel open={open} onClose={onClose} minHeight={minHeight}>
            <Tabs
                value={tabNum}
                variant="fullWidth"
                onChange={(e, newTab) => setTabNum(newTab)}
                indicatorColor="primary"
                textColor="primary"
            >
                {tabs.map((tab, tabIndex) => (
                    <Tab key={tab} value={tabIndex} label={tabTitle(tab)} />
                ))}
            </Tabs>
            {tabs.map((tab, tabIndex) => (
                <TabPanel key={tab} index={tabIndex} currentIndex={tabNum}>
                    <Stack sx={{ px: 3, py: 1, minHeight }}>{tabContent(tab)}</Stack>
                </TabPanel>
            ))}
        </OptionsPanel>
    );
};
