/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import {
    SelectSetting,
    SelectSettingValue,
    SelectSettingValueDisplayInfo,
} from '@/base/components/settings/SelectSetting.tsx';

const CHAPTERS_TO_DELETE = [0, 1, 2, 3, 4, 5] as const;
const CHAPTERS_TO_DELETE_TO_TRANSLATION_KEY: {
    [flavor in (typeof CHAPTERS_TO_DELETE)[number]]: SelectSettingValueDisplayInfo;
} = {
    0: {
        text: 'global.label.disabled',
    },
    1: {
        text: 'download.settings.delete_chapters.while_reading.option.label.first',
    },
    2: {
        text: 'download.settings.delete_chapters.while_reading.option.label.second',
    },
    3: {
        text: 'download.settings.delete_chapters.while_reading.option.label.third',
    },
    4: {
        text: 'download.settings.delete_chapters.while_reading.option.label.fourth',
    },
    5: {
        text: 'download.settings.delete_chapters.while_reading.option.label.fifth',
    },
};
const CHAPTERS_TO_DELETE_SELECT_VALUES: SelectSettingValue<(typeof CHAPTERS_TO_DELETE)[number]>[] =
    CHAPTERS_TO_DELETE.map((chapterToDelete) => [
        chapterToDelete,
        CHAPTERS_TO_DELETE_TO_TRANSLATION_KEY[chapterToDelete],
    ]);

const getNormalizedChapterToDelete = (chapterToDelete: number | boolean) => {
    const isMigrationVersion0 = typeof chapterToDelete === 'boolean';
    if (isMigrationVersion0) {
        return Number(chapterToDelete);
    }

    return chapterToDelete;
};

export const DeleteChaptersWhileReadingSetting = ({
    chapterToDelete,
    handleChange,
}: {
    chapterToDelete: number;
    handleChange: (chapterToDelete: number) => void;
}) => {
    const { t } = useTranslation();

    const normalizedChapterToDelete = getNormalizedChapterToDelete(chapterToDelete);

    return (
        <SelectSetting
            settingName={t('download.settings.delete_chapters.while_reading.label.title')}
            value={normalizedChapterToDelete}
            values={CHAPTERS_TO_DELETE_SELECT_VALUES}
            handleChange={handleChange}
        />
    );
};
