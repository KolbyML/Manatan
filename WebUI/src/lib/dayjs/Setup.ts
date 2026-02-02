/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import calendar from 'dayjs/plugin/calendar';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import duration from 'dayjs/plugin/duration';
import { importDayJsLocale } from '@/lib/dayjs/LocaleImporter.ts';
// import localizedFormat from 'dayjs/plugin/localizedFormat';
// import updateLocale from 'dayjs/plugin/updateLocale';
// import { t } from 'i18next';

dayjs.extend(customParseFormat);
dayjs.extend(calendar);
dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isYesterday);
dayjs.extend(duration);
// dayjs.extend(localizedFormat);
// dayjs.extend(updateLocale);

importDayJsLocale(navigator.language).then((dayjsLocale) => {
    dayjs.locale(dayjsLocale);
    // dayjs.updateLocale(navigator.language, {
    //     calendar: {
    //         lastDay: `[${t('global.date.label.yesterday_at')}] LT`,
    //         sameDay: `[${t('global.date.label.today_at')}] LT`,
    //     },
    // });
});
