/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ComponentProps, useMemo, useState } from 'react';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import { closestCenter, DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { DEFAULT_FULL_FAB_HEIGHT } from '@/base/components/buttons/StyledFab.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { GetCategoriesSettingsQuery, GetCategoriesSettingsQueryVariables } from '@/lib/graphql/generated/graphql.ts';
import { GET_CATEGORIES_SETTINGS } from '@/lib/graphql/category/CategoryQuery.ts';
import { CategorySettingsCard } from '@/features/category/components/CategorySettingsCard.tsx';
import { CategoryIdInfo } from '@/features/category/Category.types.ts';
import { getErrorMessage, noOp } from '@/lib/HelperFunctions.ts';
import { DndSortableItem } from '@/lib/dnd-kit/DndSortableItem.tsx';
import { DndKitUtil } from '@/lib/dnd-kit/DndKitUtil.ts';
import { DndOverlayItem } from '@/lib/dnd-kit/DndOverlayItem.tsx';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { CREATE_NEW_CATEGORY_ID } from '@/features/category/Category.constants.ts';
import { CreateOrEditCategoryDialog } from '@/features/category/components/CreateOrEditCategoryDialog.tsx';

export function CategorySettings() {
    const { t } = useTranslation();
    const dndSensors = DndKitUtil.useSensorsForDevice();

    useAppTitle(t('category.dialog.title.edit_category_other'));

    const { data, loading, error, refetch } = requestManager.useGetCategories<
        GetCategoriesSettingsQuery,
        GetCategoriesSettingsQueryVariables
    >(GET_CATEGORIES_SETTINGS, { notifyOnNetworkStatusChange: true });
    const [reorderCategory, { reset: revertReorder }] = requestManager.useReorderCategory();

    const [categoryToEdit, setCategoryToEdit] = useState<number>(CREATE_NEW_CATEGORY_ID);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dndActiveCategory, setDndActiveCategory] = useState<
        ComponentProps<typeof CategorySettingsCard>['category'] | null
    >(null);

    const categories = useMemo(() => {
        const res = [...(data?.categories.nodes ?? [])];
        if (res.length > 0 && res[0].name === 'Default') {
            res.shift();
        }
        return res;
    }, [data]);

    const categoryReorder = (list: CategoryIdInfo[], from: number, to: number) => {
        const reorderedCategory = list[from];

        reorderCategory({ variables: { input: { id: reorderedCategory.id, position: to + 1 } } }).catch(() =>
            revertReorder(),
        );
    };

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        setDndActiveCategory(null);

        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = categories.findIndex((category) => category.id === active.id);
        const newIndex = categories.findIndex((category) => category.id === over.id);

        categoryReorder(categories, oldIndex, newIndex);
    };

    const handleDialogOpen = (categoryId?: CategoryIdInfo['id']) => {
        setCategoryToEdit(categoryId ?? CREATE_NEW_CATEGORY_ID);
        setDialogOpen(true);
    };

    const handleDialogCancel = () => {
        setCategoryToEdit(CREATE_NEW_CATEGORY_ID);
        setDialogOpen(false);
    };

    if (loading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('category.error.label.request_failure')}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('CategorySettings::refetch'))}
            />
        );
    }

    return (
        <>
            <DndContext
                sensors={dndSensors}
                collisionDetection={closestCenter}
                onDragStart={(event) =>
                    setDndActiveCategory(categories.find((category) => category.id === event.active.id) ?? null)
                }
                onDragEnd={onDragEnd}
                onDragCancel={() => setDndActiveCategory(null)}
                onDragAbort={() => setDndActiveCategory(null)}
            >
                <Box sx={{ paddingBottom: DEFAULT_FULL_FAB_HEIGHT }}>
                    <SortableContext items={categories} strategy={verticalListSortingStrategy}>
                        {categories.map((category, index) => (
                            <DndSortableItem
                                key={category.id}
                                id={category.id}
                                isDragging={category.id === dndActiveCategory?.id}
                            >
                                <CategorySettingsCard category={category} onEdit={() => handleDialogOpen(index)} />
                            </DndSortableItem>
                        ))}
                    </SortableContext>
                    <DndOverlayItem isActive={!!dndActiveCategory}>
                        <CategorySettingsCard category={dndActiveCategory!} onEdit={noOp} />
                    </DndOverlayItem>
                </Box>
            </DndContext>
            <Fab
                color="primary"
                aria-label="add"
                sx={{
                    position: 'fixed',
                    bottom: (theme) => theme.spacing(2),
                    right: (theme) => theme.spacing(2),
                }}
                onClick={() => handleDialogOpen()}
            >
                <AddIcon />
            </Fab>

            {dialogOpen && (
                <CreateOrEditCategoryDialog category={categories[categoryToEdit]} onClose={handleDialogCancel} />
            )}
        </>
    );
}
