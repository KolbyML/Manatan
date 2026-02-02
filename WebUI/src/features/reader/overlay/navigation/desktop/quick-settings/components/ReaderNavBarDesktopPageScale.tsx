/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { ValueRotationButton } from '@/base/components/buttons/ValueRotationButton.tsx';
import {
    IReaderSettings,
    IReaderSettingsWithDefaultFlag,
    ReaderPageScaleMode,
} from '@/features/reader/Reader.types.ts';
import {
    PAGE_SCALE_VALUE_TO_DISPLAY_DATA,
    READER_PAGE_SCALE_MODE_TO_SCALING_ALLOWED,
    READER_PAGE_SCALE_MODE_VALUES,
} from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { MultiValueButtonDefaultableProps } from '@/base/Base.types.ts';
import { CustomButtonIcon } from '@/base/components/buttons/CustomButtonIcon.tsx';

export const ReaderNavBarDesktopPageScale = ({
    pageScaleMode,
    shouldStretchPage,
    updateSetting,
    ...buttonSelectInputProps
}: Pick<IReaderSettingsWithDefaultFlag, 'pageScaleMode' | 'shouldStretchPage'> &
    Pick<MultiValueButtonDefaultableProps<ReaderPageScaleMode>, 'isDefaultable' | 'onDefault'> & {
        updateSetting: <Setting extends keyof Pick<IReaderSettings, 'pageScaleMode' | 'shouldStretchPage'>>(
            setting: Setting,
            value: IReaderSettings[Setting],
        ) => void;
    }) => {
    const { t } = useTranslation();

    return (
        <Stack sx={{ flexDirection: 'row', gap: 1 }}>
            <ValueRotationButton
                {...buttonSelectInputProps}
                tooltip={t('reader.settings.page_scale.title')}
                value={pageScaleMode.isDefault ? undefined : pageScaleMode.value}
                defaultValue={pageScaleMode.isDefault ? pageScaleMode.value : undefined}
                values={READER_PAGE_SCALE_MODE_VALUES}
                setValue={(value) => updateSetting('pageScaleMode', value)}
                valueToDisplayData={PAGE_SCALE_VALUE_TO_DISPLAY_DATA}
                defaultIcon={PAGE_SCALE_VALUE_TO_DISPLAY_DATA[pageScaleMode.value].icon}
            />
            {READER_PAGE_SCALE_MODE_TO_SCALING_ALLOWED[pageScaleMode.value] && (
                <CustomTooltip title={t('reader.settings.page_scale.stretch')}>
                    <CustomButtonIcon
                        onClick={() => updateSetting('shouldStretchPage', !shouldStretchPage.value)}
                        sx={{ px: undefined }}
                        variant="contained"
                        color={shouldStretchPage.value ? 'secondary' : 'primary'}
                    >
                        <FitScreenIcon />
                    </CustomButtonIcon>
                </CustomTooltip>
            )}
        </Stack>
    );
};
