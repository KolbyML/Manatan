/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import {
    IMAGE_PROCESSING_TYPE_TO_SETTING,
    IMAGE_PROCESSING_TYPE_TO_TRANSLATION,
    TARGET_DISABLED,
} from '@/features/settings/Settings.constants.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { ImageProcessingType, ServerSettings } from '@/features/settings/Settings.types.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { assertIsDefined } from '@/base/Asserts.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import {
    addStableIdToConversions,
    containsInvalidConversion,
    didUpdateConversions,
    isDuplicateConversion,
    maybeAddDefault,
    normalizeConversions,
    toValidServerConversions,
} from '@/features/settings/ImageProcessing.utils.ts';
import { Processing } from '@/features/settings/components/images/Processing.tsx';

export const ImageProcessingSetting = ({ type }: { type: ImageProcessingType }) => {
    const { t } = useTranslation();

    useAppTitle(t(IMAGE_PROCESSING_TYPE_TO_TRANSLATION[type]));

    const { data, loading, error, refetch } = requestManager.useGetServerSettings({
        notifyOnNetworkStatusChange: true,
    });
    const [mutateSettings] = requestManager.useUpdateServerSettings();

    if (loading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('ImageProcessingSetting::refetch'))}
            />
        );
    }

    const settingKey = IMAGE_PROCESSING_TYPE_TO_SETTING[type];

    assertIsDefined(data?.settings?.[settingKey]);

    const conversions = data?.settings?.[settingKey];

    const [tmpConversions, setTmpConversions] = useState(
        normalizeConversions(maybeAddDefault(addStableIdToConversions(conversions))),
    );

    const hasInvalidConversion = containsInvalidConversion(tmpConversions);
    const hasChanged = didUpdateConversions(
        normalizeConversions(maybeAddDefault(addStableIdToConversions(conversions))),
        tmpConversions,
    );

    const updateSetting = (value: ServerSettings[typeof settingKey]): Promise<any> => {
        const mutation = mutateSettings({ variables: { input: { settings: { [settingKey]: value } } } });
        mutation.catch((e) => makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)));

        return mutation;
    };

    const onSubmit = async () => {
        try {
            await updateSetting(toValidServerConversions(tmpConversions));
        } catch (e) {
            // ignore error
        }
    };

    return (
        <Stack sx={{ p: 2, gap: 3 }}>
            <Typography>{t('download.settings.conversion.description', { value: TARGET_DISABLED })}</Typography>
            <Stack sx={{ flexDirection: 'column', gap: 5 }}>
                {tmpConversions.map((conversion, index) => {
                    const { mimeType } = conversion;

                    const isDuplicate = isDuplicateConversion(mimeType, index, tmpConversions);

                    return (
                        <Processing
                            key={conversion.id}
                            conversion={conversion}
                            isDuplicate={isDuplicate}
                            onChange={(newConversion) => {
                                setTmpConversions((prev) =>
                                    maybeAddDefault(
                                        prev.toSpliced(index, 1, ...(newConversion ? [newConversion] : [])),
                                    ),
                                );
                            }}
                        />
                    );
                })}
            </Stack>
            <Stack
                direction="row"
                sx={{
                    gap: 1,
                }}
            >
                <Button
                    variant="outlined"
                    onClick={() => {
                        setTmpConversions((prev) => [
                            ...prev,
                            ...addStableIdToConversions([
                                {
                                    mimeType: '',
                                    target: '',
                                    compressionLevel: null,
                                    headers: null,
                                    callTimeout: null,
                                    connectTimeout: null,
                                },
                            ]),
                        ]);
                    }}
                >
                    {t('global.button.add')}
                </Button>
                <Button variant="contained" disabled={hasInvalidConversion || !hasChanged} onClick={onSubmit}>
                    {t('global.button.save')}
                </Button>
            </Stack>
        </Stack>
    );
};
