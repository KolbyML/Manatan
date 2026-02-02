/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import MenuItem from '@mui/material/MenuItem';
import { memo, useMemo } from 'react';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { Select } from '@/base/components/inputs/Select.tsx';
import { getNextIndexFromPage, getPage } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.utils.tsx';
import { useGetOptionForDirection } from '@/features/theme/services/ThemeCreator.ts';
import { ReaderNavBarDesktopNextPreviousButton } from '@/features/reader/overlay/navigation/desktop/components/ReaderNavBarDesktopNextPreviousButton.tsx';
import { READING_DIRECTION_TO_THEME_DIRECTION } from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { useReaderPagesStore, useReaderSettingsStore } from '@/features/reader/stores/ReaderStore.ts';
import { ReaderControls } from '@/features/reader/services/ReaderControls.ts';

const BaseReaderNavBarDesktopPageNavigation = () => {
    const { t } = useTranslation();
    const getOptionForDirection = useGetOptionForDirection();
    const { currentPageIndex, pages } = useReaderPagesStore((state) => ({
        currentPageIndex: state.pages.currentPageIndex,
        pages: state.pages.pages,
    }));
    const readingDirection = useReaderSettingsStore((state) => state.settings.readingDirection.value);

    const currentPage = useMemo(() => getPage(currentPageIndex, pages), [currentPageIndex, pages]);
    const direction = READING_DIRECTION_TO_THEME_DIRECTION[readingDirection];

    // Helper to generate the Label with Ghost Text
    const pageLabelGhost = (
        <span className="yomitan-ghost-text" data-text={t('reader.page_info.label.page')} />
    );

    return (
        <Stack sx={{ flexDirection: 'row', gap: 1 }} dir="ltr">
            <ReaderNavBarDesktopNextPreviousButton
                type="previous"
                title={t(getOptionForDirection('reader.button.previous_page', 'reader.button.next_page', direction))}
                disabled={getOptionForDirection(
                    !currentPage.primary.index,
                    getNextIndexFromPage(currentPage) === getNextIndexFromPage(pages.slice(-1)[0]),
                    direction,
                )}
                onClick={() => ReaderControls.openPage('previous', undefined, false)}
            />
            <FormControl sx={{ flexBasis: '70%', flexGrow: 0, flexShrink: 0 }}>
                {/* Fix 1: InputLabel text */}
                <InputLabel id="reader-nav-bar-desktop-page-select">
                    {pageLabelGhost}
                </InputLabel>
                
                <Select
                    labelId="reader-nav-bar-desktop-page-select"
                    // Fix 2: Select 'label' prop (used for the outline cutout)
                    label={pageLabelGhost}
                    value={getNextIndexFromPage(currentPage)}
                    onChange={(e) => ReaderControls.openPage(e.target.value as number, undefined, false)}
                >
                    {pages.map((page) => (
                        <MenuItem key={getNextIndexFromPage(page)} value={getNextIndexFromPage(page)}>
                            {/* Fix 3: The actual page numbers in the dropdown (and selected value) */}
                            <span className="yomitan-ghost-text" data-text={page.name} />
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <ReaderNavBarDesktopNextPreviousButton
                type="next"
                title={t(getOptionForDirection('reader.button.next_page', 'reader.button.previous_page', direction))}
                disabled={getOptionForDirection(
                    getNextIndexFromPage(currentPage) === getNextIndexFromPage(pages.slice(-1)[0]),
                    !currentPage.primary.index,
                    direction,
                )}
                onClick={() => ReaderControls.openPage('next', undefined, false)}
            />
        </Stack>
    );
};

export const ReaderNavBarDesktopPageNavigation = memo(BaseReaderNavBarDesktopPageNavigation);
