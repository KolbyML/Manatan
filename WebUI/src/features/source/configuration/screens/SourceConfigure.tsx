/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { createElement } from 'react';
import { useParams } from 'react-router-dom';
import List from '@mui/material/List';
import { useTranslation } from 'react-i18next';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { cloneObject } from '@/base/utils/cloneObject.tsx';
import {
    SwitchPreferenceCompat,
    CheckBoxPreference,
} from '@/features/source/configuration/components/TwoStatePreference.tsx';
import { ListPreference } from '@/features/source/configuration/components/ListPreference.tsx';
import { EditTextPreference } from '@/features/source/configuration/components/EditTextPreference.tsx';
import { MultiSelectListPreference } from '@/features/source/configuration/components/MultiSelectListPreference.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { GetCategoriesSettingsQueryVariables, GetSourceSettingsQuery } from '@/lib/graphql/generated/graphql.ts';
import { GET_SOURCE_SETTINGS } from '@/lib/graphql/source/SourceQuery.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { PreferenceProps } from '@/features/source/Source.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';

function getPrefComponent(type: string) {
    switch (type) {
        case 'CheckBoxPreference':
            return CheckBoxPreference;
        case 'SwitchPreference':
            return SwitchPreferenceCompat;
        case 'ListPreference':
            return ListPreference;
        case 'EditTextPreference':
            return EditTextPreference;
        case 'MultiSelectListPreference':
            return MultiSelectListPreference;
        default:
            throw new Error(`Unexpected preference type "${type}"`);
    }
}

export function SourceConfigure() {
    const { t } = useTranslation();

    useAppTitle(t('source.configuration.title'));

    const { sourceId } = useParams<{ sourceId: string }>();
    const { data, loading, error, refetch } = requestManager.useGetSource<
        GetSourceSettingsQuery,
        GetCategoriesSettingsQueryVariables
    >(GET_SOURCE_SETTINGS, sourceId, {
        notifyOnNetworkStatusChange: true,
    });
    const sourcePreferences = data?.source.preferences ?? [];

    const updateValue =
        (position: number): PreferenceProps['updateValue'] =>
        (type, value) => {
            requestManager
                .setSourcePreferences(sourceId, { position, [type]: value })
                .response.catch((e) =>
                    makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
                );
        };

    if (loading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('SourceConfigure::refetch'))}
            />
        );
    }

    return (
        <List sx={{ padding: 0 }}>
            {sourcePreferences.map((it, index) => {
                const props = cloneObject(it);

                // TypeScript is dumb in detecting extra props
                // @ts-ignore
                return createElement(getPrefComponent(it.type), {
                    ...props,
                    updateValue: updateValue(index),
                });
            })}
        </List>
    );
}
