import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { ICategoryMetadata } from '@/features/category/Category.types.ts';

type CategoryId = number;

type CategoryMetadataOverrideState = {
    overridesById: Record<string, Partial<ICategoryMetadata> | undefined>;
    setOverrides: (categoryId: CategoryId, patch: Partial<ICategoryMetadata>) => void;
    clearOverrides: (categoryId: CategoryId) => void;
};

const keyFor = (categoryId: CategoryId) => categoryId.toString();

const cloneIfObject = <T>(value: T): T => {
    if (value == null) return value;
    if (typeof value !== 'object') return value;
    try {
        return structuredClone(value);
    } catch {
        return JSON.parse(JSON.stringify(value)) as T;
    }
};

export const useCategoryMetadataOverrideStore = create<CategoryMetadataOverrideState>((set) => ({
    overridesById: {},
    setOverrides: (categoryId, patch) =>
        set((state) => {
            const key = keyFor(categoryId);
            const prev = state.overridesById[key] ?? {};
            const next = { ...prev, ...cloneIfObject(patch) };
            return {
                overridesById: {
                    ...state.overridesById,
                    [key]: next,
                },
            };
        }),
    clearOverrides: (categoryId) =>
        set((state) => {
            const key = keyFor(categoryId);
            if (state.overridesById[key] == null) return state;
            const next = { ...state.overridesById };
            delete next[key];
            return { overridesById: next };
        }),
}));

export const getCategoryMetadataOverrides = (categoryId: CategoryId): Partial<ICategoryMetadata> | undefined =>
    useCategoryMetadataOverrideStore.getState().overridesById[keyFor(categoryId)];

export const useCategoryMetadataOverrides = (categoryId: CategoryId): Partial<ICategoryMetadata> | undefined =>
    useCategoryMetadataOverrideStore(
        useShallow((state) => state.overridesById[keyFor(categoryId)]),
    );

export const setCategoryMetadataOverrides = (categoryId: CategoryId, patch: Partial<ICategoryMetadata>): void => {
    useCategoryMetadataOverrideStore.getState().setOverrides(categoryId, patch);
};
