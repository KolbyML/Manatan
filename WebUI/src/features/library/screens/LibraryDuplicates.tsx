/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import SettingsIcon from '@mui/icons-material/Settings';
import PopupState, { bindMenu, bindTrigger } from 'material-ui-popup-state';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { GridLayouts } from '@/base/components/GridLayouts.tsx';
import { CheckboxInput } from '@/base/components/inputs/CheckboxInput.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { MangaCard } from '@/features/manga/components/cards/MangaCard.tsx';
import { StyledGroupedVirtuoso } from '@/base/components/virtuoso/StyledGroupedVirtuoso.tsx';
import { StyledGroupHeader } from '@/base/components/virtuoso/StyledGroupHeader.tsx';
import { GetMangasDuplicatesQuery, GetMangasDuplicatesQueryVariables } from '@/lib/graphql/generated/graphql.ts';
import { GET_MANGAS_DUPLICATES } from '@/lib/graphql/manga/MangaQuery.ts';
import { BaseMangaGrid } from '@/features/manga/components/BaseMangaGrid.tsx';
import { IMangaGridProps } from '@/features/manga/components/MangaGrid.tsx';
import { StyledGroupItemWrapper } from '@/base/components/virtuoso/StyledGroupItemWrapper.tsx';
import { VirtuosoUtil } from '@/lib/virtuoso/Virtuoso.util.tsx';
import { LibraryDuplicatesWorkerInput, TMangaDuplicate, TMangaDuplicates } from '@/features/library/Library.types.ts';
import { GridLayout } from '@/base/Base.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { useAppTitleAndAction } from '@/features/navigation-bar/hooks/useAppTitleAndAction.ts';

export const LibraryDuplicates = () => {
    const { t } = useTranslation();

    const [gridLayout, setGridLayout] = useLocalStorage('libraryDuplicatesGridLayout', GridLayout.List);
    const [checkAlternativeTitles, setCheckAlternativeTitles] = useLocalStorage(
        'libraryDuplicatesCheckAlternativeTitles',
        false,
    );

    useAppTitleAndAction(
        t('library.settings.advanced.duplicates.label.title'),
        <>
            <GridLayouts gridLayout={gridLayout} onChange={setGridLayout} />
            <PopupState variant="popover" popupId="library-dupliactes-settings">
                {(popupState) => (
                    <>
                        <IconButton {...bindTrigger(popupState)} color="inherit">
                            <SettingsIcon />
                        </IconButton>
                        <Menu {...bindMenu(popupState)}>
                            <MenuItem>
                                <CheckboxInput
                                    label={t('library.settings.advanced.duplicates.settings.label.check_description')}
                                    checked={checkAlternativeTitles}
                                    onChange={(_, checked) => setCheckAlternativeTitles(checked)}
                                />
                            </MenuItem>
                        </Menu>
                    </>
                )}
            </PopupState>
        </>,
        [t, gridLayout, checkAlternativeTitles],
    );

    const { data, loading, error, refetch } = requestManager.useGetMangas<
        GetMangasDuplicatesQuery,
        GetMangasDuplicatesQueryVariables
    >(GET_MANGAS_DUPLICATES, { condition: { inLibrary: true } });

    const [isCheckingForDuplicates, setIsCheckingForDuplicates] = useState(true);

    const [mangasByTitle, setMangasByTitle] = useState<Record<string, TMangaDuplicate[]>>({});
    useEffect(() => {
        setIsCheckingForDuplicates(true);
        const libraryMangas: TMangaDuplicate[] = data?.mangas.nodes ?? [];

        if (!libraryMangas.length) {
            setMangasByTitle({});
            return () => {};
        }

        const worker = new Worker(new URL('../workers/LibraryDuplicatesWorker.ts', import.meta.url), {
            type: 'module',
        });

        worker.onmessage = (event: MessageEvent<TMangaDuplicates<(typeof libraryMangas)[number]>>) => {
            setMangasByTitle(event.data);
            setIsCheckingForDuplicates(false);
        };
        worker.postMessage({ mangas: libraryMangas, checkAlternativeTitles } satisfies LibraryDuplicatesWorkerInput);

        return () => worker.terminate();
    }, [data?.mangas.nodes, checkAlternativeTitles]);

    const duplicatedTitles = useMemo(
        () => Object.keys(mangasByTitle).toSorted((titleA, titleB) => titleA.localeCompare(titleB)),
        [mangasByTitle],
    );
    const duplicatedMangas = useMemo(
        () => duplicatedTitles.map((title) => mangasByTitle[title]).flat(),
        [mangasByTitle],
    );
    const mangasCountByTitle = useMemo(
        () => duplicatedTitles.map((title) => mangasByTitle[title]).map((mangas) => mangas.length),
        [mangasByTitle],
    );

    const computeItemKey = VirtuosoUtil.useCreateGroupedComputeItemKey(
        mangasCountByTitle,
        useCallback((index) => duplicatedTitles[index], [duplicatedTitles]),
        useCallback(
            (index, groupIndex) => `${duplicatedTitles[groupIndex]}-${duplicatedMangas[index].id}}`,
            [duplicatedTitles, duplicatedMangas],
        ),
    );

    if (loading || isCheckingForDuplicates) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('LibraryDuplicates::refetch'))}
            />
        );
    }

    if (gridLayout === GridLayout.List) {
        return (
            <StyledGroupedVirtuoso
                persistKey="library-duplicates"
                groupCounts={mangasCountByTitle}
                groupContent={(index) => (
                    <StyledGroupHeader isFirstItem={index === 0}>
                        <Typography variant="h5" component="h2">
                            {duplicatedTitles[index]}
                        </Typography>
                    </StyledGroupHeader>
                )}
                computeItemKey={computeItemKey}
                itemContent={(index) => (
                    <StyledGroupItemWrapper>
                        <MangaCard
                            manga={duplicatedMangas[index] as IMangaGridProps['mangas'][number]}
                            gridLayout={gridLayout}
                            selected={null}
                            mode="duplicate"
                        />
                    </StyledGroupItemWrapper>
                )}
            />
        );
    }

    return duplicatedTitles.map((title, index) => (
        <Box key={title}>
            <StyledGroupHeader sx={{ pt: index === 0 ? undefined : 0, pb: 0 }} isFirstItem={false}>
                <Typography variant="h5" component="h2">
                    {title}
                </Typography>
            </StyledGroupHeader>
            <BaseMangaGrid
                // the key needs to include filters and query to force a re-render of the virtuoso grid to prevent https://github.com/petyosi/react-virtuoso/issues/1242
                key={checkAlternativeTitles.toString()}
                mangas={mangasByTitle[title] as IMangaGridProps['mangas']}
                hasNextPage={false}
                loadMore={() => {}}
                isLoading={false}
                gridLayout={gridLayout}
                inLibraryIndicator={false}
                horizontal
                mode="duplicate"
            />
        </Box>
    ));
};
