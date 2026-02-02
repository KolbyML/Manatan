/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { languageSortComparator } from '@/base/utils/Languages.ts';
import { assertIsDefined } from '@/base/Asserts.ts';
import { Sources } from '@/features/source/services/Sources.ts';
import { Header } from '@/features/extension/info/components/Header.tsx';
import { Meta } from '@/features/extension/info/components/Meta.tsx';
import { ActionButton } from '@/features/extension/info/components/ActionButton.tsx';
import { SourceCard } from '@/features/extension/info/components/SourceCard.tsx';

export const ExtensionInfo = () => {
    const { t } = useTranslation();
    const { pkgName } = useParams<{ pkgName: string }>();

    useAppTitle(t('source.extension_info.title'));

    const extensionResponse = requestManager.useGetExtension(pkgName);
    const sourcesResponse = requestManager.useGetSourceList();

    const { extension } = extensionResponse.data ?? {};
    const sources = useMemo(() => {
        if (!sourcesResponse.data?.sources) {
            return [];
        }

        return sourcesResponse.data.sources.nodes
            .filter((source) => source.extension.pkgName === extension?.pkgName)
            .sort((a, b) => languageSortComparator(Sources.getLanguage(a), Sources.getLanguage(b)));
    }, [extension?.pkgName, sourcesResponse.data]);

    const isLoading = extensionResponse.loading || sourcesResponse.loading;
    const error = extensionResponse.error || sourcesResponse.error;

    if (isLoading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(extensionResponse.error)}
                retry={() => {
                    if (extensionResponse.error) {
                        extensionResponse
                            .refetch()
                            .catch(defaultPromiseErrorHandler('ExtensionInfo::extension::refetch'));
                    }

                    if (sourcesResponse.error) {
                        sourcesResponse.refetch().catch(defaultPromiseErrorHandler('ExtensionInfo::sources::refetch'));
                    }
                }}
            />
        );
    }

    assertIsDefined(extension);

    return (
        <Stack sx={{ gap: 2 }}>
            <Header {...extension} />
            <Meta {...extension} />
            <Stack sx={{ flexDirection: 'row' }}>
                <ActionButton {...{ ...extension, isInstalled: true, hasUpdate: false }} />
                {extension.hasUpdate && <ActionButton {...extension} />}
            </Stack>
            <Box sx={{ px: 1 }}>
                {sources.map((source) => (
                    <SourceCard key={source.id} {...source} />
                ))}
            </Box>
        </Stack>
    );
};
