/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useState, useEffect, useMemo } from 'react';
import Button from '@mui/material/Button';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Dialog from '@mui/material/Dialog';
import FormGroup from '@mui/material/FormGroup';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Stack from '@mui/material/Stack';
import { AwaitableComponentProps } from 'awaitable-component';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { Mangas } from '@/features/manga/services/Mangas.ts';
import { useSelectableCollection } from '@/base/collection/hooks/useSelectableCollection.ts';
import { ThreeStateCheckboxInput } from '@/base/components/inputs/ThreeStateCheckboxInput.tsx';
import { Categories } from '@/features/category/services/Categories.ts';
import { CheckboxInput } from '@/base/components/inputs/CheckboxInput.tsx';
import { makeToast } from '@/base/utils/Toast.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { updateMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import {
    GetCategoriesBaseQuery,
    GetCategoriesBaseQueryVariables,
    GetMangaCategoriesQuery,
    GetMangaCategoriesQueryVariables,
} from '@/lib/graphql/generated/graphql.ts';
import { GET_CATEGORIES_BASE } from '@/lib/graphql/category/CategoryQuery.ts';
import { GET_MANGA_CATEGORIES } from '@/lib/graphql/manga/MangaQuery.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';

type BaseProps = AwaitableComponentProps<{ addToCategories?: number[]; removeFromCategories?: number[] }>;

type SingleMangaModeProps = {
    mangaId: number;
    addToLibrary?: boolean;
};

type MultiMangaModeProps = {
    mangaIds: number[];
};

export type CategorySelectProps =
    | (BaseProps & SingleMangaModeProps & PropertiesNever<MultiMangaModeProps>)
    | (BaseProps & PropertiesNever<SingleMangaModeProps> & MultiMangaModeProps);

const useGetMangaCategoryIds = (mangaId: number | undefined): number[] => {
    const { data: mangaResult } = requestManager.useGetManga<GetMangaCategoriesQuery, GetMangaCategoriesQueryVariables>(
        GET_MANGA_CATEGORIES,
        mangaId ?? -1,
        { skip: mangaId === undefined },
    );

    return useMemo(() => {
        if (mangaId === undefined || !mangaResult) {
            return [];
        }

        return Categories.getIds(mangaResult.manga.categories.nodes);
    }, [mangaResult?.manga.categories.nodes, mangaId]);
};

const getCategoryCheckedState = (
    categoryId: number,
    categoriesToAdd: number[],
    categoriesToRemove: number[],
    isSingleSelectionMode: boolean,
): boolean | undefined => {
    if (categoriesToAdd.includes(categoryId)) {
        return true;
    }

    if (isSingleSelectionMode) {
        return undefined;
    }

    if (categoriesToRemove.includes(categoryId)) {
        return false;
    }

    return undefined;
};

export function CategorySelect(props: CategorySelectProps) {
    const { t } = useTranslation();

    const {
        onDismiss,
        onSubmit,
        isVisible,
        onExitComplete,
        mangaId,
        mangaIds: passedMangaIds,
        addToLibrary = false,
    } = props;

    const isSingleSelectionMode = mangaId !== undefined;
    const mangaIds = passedMangaIds ?? [mangaId];

    const [doNotShowAddToLibraryDialogAgain, setDoNotShowAddToLibraryDialogAgain] = useState(false);

    const mangaCategoryIds = useGetMangaCategoryIds(mangaId);

    const { data } = requestManager.useGetCategories<GetCategoriesBaseQuery, GetCategoriesBaseQueryVariables>(
        GET_CATEGORIES_BASE,
    );
    const categoriesData = data?.categories.nodes;

    const allCategories = useMemo(() => Categories.getUserCreated(categoriesData ?? []), [categoriesData]);

    const defaultCategoryIds = useMemo(
        () => (addToLibrary ? Categories.getIds(Categories.getDefaults(allCategories)) : []),
        [allCategories],
    );

    const { handleSelection, setSelectionForKey, getSelectionForKey } = useSelectableCollection<
        number,
        'categoriesToAdd' | 'categoriesToRemove'
    >(allCategories.length, {
        currentKey: 'categoriesToAdd',
        initialState: {
            categoriesToAdd: [...mangaCategoryIds, ...defaultCategoryIds],
            categoriesToRemove: [],
        },
    });

    useEffect(() => {
        setSelectionForKey('categoriesToAdd', [...mangaCategoryIds, ...defaultCategoryIds]);
        setSelectionForKey('categoriesToRemove', []);
    }, [mangaCategoryIds]);

    const categoriesToAdd = getSelectionForKey('categoriesToAdd');
    const categoriesToRemove = getSelectionForKey('categoriesToRemove');

    const handleCancel = () => {
        setSelectionForKey('categoriesToAdd', mangaCategoryIds);
        setSelectionForKey('categoriesToRemove', []);
        onDismiss();
    };

    const handleOk = () => {
        const addToCategories = isSingleSelectionMode
            ? categoriesToAdd.filter((categoryId) => !mangaCategoryIds.includes(categoryId))
            : categoriesToAdd;
        const removeFromCategories = isSingleSelectionMode
            ? mangaCategoryIds.filter((categoryId) => !categoriesToAdd.includes(categoryId))
            : categoriesToRemove;

        onSubmit({
            addToCategories,
            removeFromCategories,
        });

        if (doNotShowAddToLibraryDialogAgain) {
            updateMetadataServerSettings('showAddToLibraryCategorySelectDialog', false).catch((e) =>
                makeToast(t('search.error.label.failed_to_save_settings'), 'error', getErrorMessage(e)),
            );
        }

        const isUpdateRequired = !!addToCategories.length || !!removeFromCategories.length;
        if (!isUpdateRequired) {
            return;
        }

        if (addToLibrary) {
            // categories get updated in MangaDetails
            return;
        }

        Mangas.performAction('change_categories', mangaIds, {
            changeCategoriesPatch: {
                addToCategories,
                removeFromCategories,
            },
        }).catch(defaultPromiseErrorHandler('CategorySelect::handleOk'));
    };

    return (
        <Dialog
            sx={{
                '.MuiDialog-paper': {
                    maxHeight: 435,
                    width: '80%',
                },
            }}
            maxWidth="xs"
            open={isVisible}
            onTransitionExited={onExitComplete}
            onClose={handleCancel}
        >
            <DialogTitle>{t('category.title.set_categories')}</DialogTitle>
            <DialogContent dividers>
                <FormGroup>
                    {allCategories.length === 0 && <span>{t('category.error.no_categories_found.label.info')}</span>}
                    {allCategories.map((category) => (
                        <ThreeStateCheckboxInput
                            checked={getCategoryCheckedState(
                                category.id,
                                categoriesToAdd,
                                categoriesToRemove,
                                isSingleSelectionMode,
                            )}
                            onChange={(checked) => {
                                handleSelection(category.id, false, { key: 'categoriesToAdd' });
                                handleSelection(category.id, false, { key: 'categoriesToRemove' });

                                if (checked) {
                                    handleSelection(category.id, true, { key: 'categoriesToAdd' });
                                }

                                if (checked === false) {
                                    handleSelection(category.id, true, { key: 'categoriesToRemove' });
                                }
                            }}
                            label={category.name}
                            key={category.id}
                        />
                    ))}
                </FormGroup>
            </DialogContent>
            <DialogActions>
                <Stack sx={{ width: '100%' }}>
                    {addToLibrary && (
                        <CheckboxInput
                            sx={{ margin: 0 }}
                            size="small"
                            label={t('global.button.dont_show_dialog_again')}
                            onChange={(e) => setDoNotShowAddToLibraryDialogAgain(e.target.checked)}
                        />
                    )}
                    <Stack
                        direction="row"
                        sx={{
                            justifyContent: 'space-between',
                            alignItems: 'end',
                            width: '100%',
                        }}
                    >
                        <Button
                            component={Link}
                            to={AppRoutes.settings.childRoutes.categories.path}
                            onClick={onDismiss}
                        >
                            {t(allCategories.length ? 'global.button.edit' : 'global.button.create')}
                        </Button>
                        <Stack direction="row">
                            <Button autoFocus onClick={handleCancel} color="primary">
                                {t('global.button.cancel')}
                            </Button>
                            {!!allCategories.length && (
                                <Button onClick={handleOk} color="primary">
                                    {t('global.button.ok')}
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                </Stack>
            </DialogActions>
        </Dialog>
    );
}
