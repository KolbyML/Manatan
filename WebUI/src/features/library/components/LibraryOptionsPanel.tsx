/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import { useTranslation } from 'react-i18next';
import { CheckboxInput } from '@/base/components/inputs/CheckboxInput.tsx';
import { RadioInput } from '@/base/components/inputs/RadioInput.tsx';
import { SortRadioInput } from '@/base/components/inputs/SortRadioInput.tsx';
import { ThreeStateCheckboxInput } from '@/base/components/inputs/ThreeStateCheckboxInput.tsx';
import { OptionsTabs } from '@/base/components/modals/OptionsTabs.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { Trackers } from '@/features/tracker/services/Trackers.ts';
import { GetTrackersSettingsQuery, MangaStatus } from '@/lib/graphql/generated/graphql.ts';
import { GET_TRACKERS_SETTINGS } from '@/lib/graphql/tracker/TrackerQuery.ts';
import { createUpdateCategoryMetadata, useGetCategoryMetadata } from '@/features/category/services/CategoryMetadata.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import {
    createUpdateMetadataServerSettings,
    updateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { LibrarySortMode } from '@/features/library/Library.types.ts';
import { CategoryMetadataInfo } from '@/features/category/Category.types.ts';
import { MANGA_STATUS_TO_TRANSLATION } from '@/features/manga/Manga.constants.ts';
import { GridLayout, TranslationKey } from '@/base/Base.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';

const TITLES: { [key in 'filter' | 'sort' | 'display']: TranslationKey } = {
    filter: 'global.label.filter',
    sort: 'global.label.sort',
    display: 'global.label.display',
};

const SORT_OPTIONS: [LibrarySortMode, TranslationKey][] = [
    ['unreadChapters', 'library.option.sort.label.by_unread_chapters'],
    ['totalChapters', 'library.option.sort.label.by_total_chapters'],
    ['alphabetically', 'library.option.sort.label.alphabetically'],
    ['dateAdded', 'library.option.sort.label.by_date_added'],
    ['lastRead', 'library.option.sort.label.by_last_read'],
    ['latestFetchedChapter', 'library.option.sort.label.by_latest_fetched_chapter'],
    ['latestUploadedChapter', 'library.option.sort.label.by_latest_uploaded_chapter'],
];

export const LibraryOptionsPanel = ({
    category,
    open,
    onClose,
}: {
    category: CategoryMetadataInfo;
    open: boolean;
    onClose: () => void;
}) => {
    const { t } = useTranslation();

    const trackerList = requestManager.useGetTrackerList<GetTrackersSettingsQuery>(GET_TRACKERS_SETTINGS);
    const loggedInTrackers = Trackers.getLoggedIn(trackerList.data?.trackers.nodes ?? []);

    const categoryLibraryOptions = useGetCategoryMetadata(category);
    const updateCategoryLibraryOptions = createUpdateCategoryMetadata(category, (e) =>
        makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
    );

    const {
        settings: { showTabSize, showContinueReadingButton, showDownloadBadge, showUnreadBadge, gridLayout },
    } = useMetadataServerSettings();
    const setSettingValue = createUpdateMetadataServerSettings((e) =>
        makeToast(t('search.error.label.failed_to_save_settings'), 'error', getErrorMessage(e)),
    );

    return (
        <OptionsTabs<'filter' | 'sort' | 'display'>
            open={open}
            onClose={onClose}
            tabs={['filter', 'sort', 'display']}
            tabTitle={(key) => t(TITLES[key])}
            tabContent={(key) => {
                if (key === 'filter') {
                    return (
                        <>
                            <ThreeStateCheckboxInput
                                label={t('global.filter.label.unread')}
                                checked={categoryLibraryOptions.hasUnreadChapters}
                                onChange={(c) => updateCategoryLibraryOptions('hasUnreadChapters', c)}
                            />
                            <ThreeStateCheckboxInput
                                label={t('global.filter.label.started')}
                                checked={categoryLibraryOptions.hasReadChapters}
                                onChange={(c) => updateCategoryLibraryOptions('hasReadChapters', c)}
                            />
                            <ThreeStateCheckboxInput
                                label={t('global.filter.label.downloaded')}
                                checked={categoryLibraryOptions.hasDownloadedChapters}
                                onChange={(c) => updateCategoryLibraryOptions('hasDownloadedChapters', c)}
                            />
                            <ThreeStateCheckboxInput
                                label={t('global.filter.label.bookmarked')}
                                checked={categoryLibraryOptions.hasBookmarkedChapters}
                                onChange={(c) => updateCategoryLibraryOptions('hasBookmarkedChapters', c)}
                            />
                            <ThreeStateCheckboxInput
                                label={t('global.filter.label.duplicate_chapters')}
                                checked={categoryLibraryOptions.hasDuplicateChapters}
                                onChange={(c) => updateCategoryLibraryOptions('hasDuplicateChapters', c)}
                            />
                            <FormLabel sx={{ mt: 2 }}>{t('manga.label.status')}</FormLabel>
                            {Object.values(MangaStatus).map((status) => (
                                <ThreeStateCheckboxInput
                                    key={status}
                                    label={t(MANGA_STATUS_TO_TRANSLATION[status])}
                                    checked={categoryLibraryOptions.hasStatus[status]}
                                    onChange={(checked) =>
                                        updateCategoryLibraryOptions('hasStatus', {
                                            ...categoryLibraryOptions.hasStatus,
                                            [status]: checked,
                                        })
                                    }
                                />
                            ))}
                            <FormLabel sx={{ mt: 2 }}>{t('global.filter.label.tracked')}</FormLabel>
                            {loggedInTrackers.map((tracker) => (
                                <ThreeStateCheckboxInput
                                    key={tracker.id}
                                    label={tracker.name}
                                    checked={categoryLibraryOptions.hasTrackerBinding[tracker.id]}
                                    onChange={(checked) =>
                                        updateCategoryLibraryOptions('hasTrackerBinding', {
                                            ...categoryLibraryOptions.hasTrackerBinding,
                                            [tracker.id]: checked,
                                        })
                                    }
                                />
                            ))}
                        </>
                    );
                }
                if (key === 'sort') {
                    return SORT_OPTIONS.map(([mode, label]) => (
                        <SortRadioInput
                            key={mode}
                            label={t(label)}
                            checked={categoryLibraryOptions.sortBy === mode}
                            sortDescending={categoryLibraryOptions.sortDesc}
                            onClick={() =>
                                mode !== categoryLibraryOptions.sortBy
                                    ? updateCategoryLibraryOptions('sortBy', mode)
                                    : updateCategoryLibraryOptions('sortDesc', !categoryLibraryOptions.sortDesc)
                            }
                        />
                    ));
                }
                if (key === 'display') {
                    return (
                        <>
                            <FormLabel>{t('global.grid_layout.title')}</FormLabel>
                            <RadioGroup
                                onChange={(e) => updateMetadataServerSettings('gridLayout', Number(e.target.value))}
                                value={gridLayout}
                            >
                                <RadioInput
                                    label={t('global.grid_layout.label.compact_grid')}
                                    value={GridLayout.Compact}
                                    checked={gridLayout == null || gridLayout === GridLayout.Compact}
                                />
                                <RadioInput
                                    label={t('global.grid_layout.label.comfortable_grid')}
                                    value={GridLayout.Comfortable}
                                    checked={gridLayout === GridLayout.Comfortable}
                                />
                                <RadioInput
                                    label={t('global.grid_layout.label.list')}
                                    value={GridLayout.List}
                                    checked={gridLayout === GridLayout.List}
                                />
                            </RadioGroup>

                            <FormLabel sx={{ mt: 2 }}>{t('library.option.display.badge.title')}</FormLabel>
                            <CheckboxInput
                                label={t('library.option.display.badge.label.unread_badges')}
                                checked={showUnreadBadge}
                                onChange={() => updateMetadataServerSettings('showUnreadBadge', !showUnreadBadge)}
                            />
                            <CheckboxInput
                                label={t('library.option.display.badge.label.download_badges')}
                                checked={showDownloadBadge}
                                onChange={() => updateMetadataServerSettings('showDownloadBadge', !showDownloadBadge)}
                            />

                            <FormLabel sx={{ mt: 2 }}>{t('library.option.display.tab.title')}</FormLabel>
                            <CheckboxInput
                                label={t('library.option.display.tab.label.show_number_of_items')}
                                checked={showTabSize}
                                onChange={() => setSettingValue('showTabSize', !showTabSize)}
                            />

                            <FormLabel sx={{ mt: 2 }}>{t('global.label.other')}</FormLabel>
                            <CheckboxInput
                                label={t('library.option.display.other.label.show_continue_reading_button')}
                                checked={showContinueReadingButton}
                                onChange={() =>
                                    updateMetadataServerSettings(
                                        'showContinueReadingButton',
                                        !showContinueReadingButton,
                                    )
                                }
                            />
                        </>
                    );
                }
                return null;
            }}
        />
    );
};
