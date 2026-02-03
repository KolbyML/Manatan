/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { GridLayouts } from '@/base/components/GridLayouts.tsx';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { BaseMangaGrid } from '@/features/manga/components/BaseMangaGrid.tsx';
import { GridLayout } from '@/base/Base.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { useAppTitleAndAction } from '@/features/navigation-bar/hooks/useAppTitleAndAction.ts';

export const Migrate = () => {
    const { t } = useTranslation();

    const { sourceId: paramSourceId } = useParams<{ sourceId: string }>();

    const [gridLayout, setGridLayout] = useLocalStorage('migrateGridLayout', GridLayout.List);

    const sourceId = paramSourceId ?? '-1';
    const {
        data: migratableSourceData,
        loading: isSourceLoading,
        error: sourceError,
        refetch: refetchSource,
    } = requestManager.useGetSourceMigratable(sourceId, {
        notifyOnNetworkStatusChange: true,
    });

    const name =
        migratableSourceData?.source?.displayName ??
        migratableSourceData?.source?.name ??
        paramSourceId ??
        t('migrate.title');

    const {
        data: migratableSourceMangasData,
        loading: areMangasLoading,
        error: mangasError,
        refetch: refetchMangas,
    } = requestManager.useGetMigratableSourceMangas(sourceId, {
        skip: !paramSourceId,
        notifyOnNetworkStatusChange: true,
    });

    useAppTitleAndAction(
        name ?? sourceId ?? t('migrate.title'),
        <GridLayouts gridLayout={gridLayout} onChange={setGridLayout} />,
        [gridLayout],
    );

    const isLoading = isSourceLoading || areMangasLoading;
    if (isLoading) {
        return <LoadingPlaceholder />;
    }

    const hasError = sourceError || mangasError;
    if (hasError) {
        const error = (sourceError ?? mangasError)!;
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => {
                    if (sourceError) {
                        refetchSource().catch(defaultPromiseErrorHandler('Migrate::refetchSource'));
                    }

                    if (mangasError) {
                        refetchMangas().catch(defaultPromiseErrorHandler('Migrate::refetchMangas'));
                    }
                }}
            />
        );
    }

    return (
        <BaseMangaGrid
            hasNextPage={false}
            loadMore={() => {}}
            isLoading={areMangasLoading}
            mangas={migratableSourceMangasData?.mangas.nodes ?? []}
            gridLayout={gridLayout}
            mode="migrate.search"
        />
    );
};
