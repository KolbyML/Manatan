import { AppStorage, LnCategory, LnCategoryMetadata } from '@/lib/storage/AppStorage';

const DEFAULT_SORT: LnCategoryMetadata = {
    sortBy: 'dateAdded',
    sortDesc: true,
};

const ALL_CATEGORY_ID = '__all__';

export const LnSortMode = {
    DATE_ADDED: 'dateAdded',
    TITLE: 'title',
    AUTHOR: 'author',
    LENGTH: 'length',
    LANGUAGE: 'language',
    LAST_READ: 'lastRead',
    PROGRESS: 'progress',
} as const;

export type LnSortModeType = typeof LnSortMode[keyof typeof LnSortMode];

export class LNCategoriesService {
    static getAllCategoryId(): string {
        return ALL_CATEGORY_ID;
    }

    static isAllCategory(categoryId: string): boolean {
        return categoryId === ALL_CATEGORY_ID;
    }

    static async getCategories(): Promise<LnCategory[]> {
        return AppStorage.getLnCategories();
    }

    static async getCategory(categoryId: string): Promise<LnCategory | null> {
        if (this.isAllCategory(categoryId)) {
            return null;
        }
        return AppStorage.getLnCategory(categoryId);
    }

    static async createCategory(name: string): Promise<LnCategory> {
        return AppStorage.createLnCategory(name);
    }

    static async updateCategory(categoryId: string, updates: Partial<LnCategory>): Promise<void> {
        if (this.isAllCategory(categoryId)) {
            throw new Error('Cannot update All category');
        }
        return AppStorage.updateLnCategory(categoryId, updates);
    }

    static async deleteCategory(categoryId: string): Promise<void> {
        if (this.isAllCategory(categoryId)) {
            throw new Error('Cannot delete All category');
        }
        return AppStorage.deleteLnCategory(categoryId);
    }

    static async getCategoryMetadata(categoryId: string): Promise<LnCategoryMetadata> {
        if (this.isAllCategory(categoryId)) {
            const stored = await AppStorage.getLnCategoryMetadata(ALL_CATEGORY_ID);
            return stored || DEFAULT_SORT;
        }
        const stored = await AppStorage.getLnCategoryMetadata(categoryId);
        return stored || DEFAULT_SORT;
    }

    static async setCategoryMetadata(categoryId: string, metadata: LnCategoryMetadata): Promise<void> {
        return AppStorage.setLnCategoryMetadata(categoryId, metadata);
    }

    static async getAllCategoryMetadata(): Promise<Record<string, LnCategoryMetadata>> {
        return AppStorage.getAllLnCategoryMetadata();
    }

    static async setSortMode(
        categoryId: string,
        sortBy: LnSortModeType,
        sortDesc: boolean = true
    ): Promise<void> {
        return this.setCategoryMetadata(categoryId, { sortBy, sortDesc });
    }

    static compareFn(
        items: Array<{ metadata: any; progress?: any }>,
        sortBy: LnSortModeType,
        sortDesc: boolean
    ): number {
        const multiplier = sortDesc ? -1 : 1;

        switch (sortBy) {
            case LnSortMode.DATE_ADDED:
                return (a: any, b: any) => multiplier * (b.metadata.addedAt - a.metadata.addedAt);

            case LnSortMode.TITLE:
                return (a: any, b: any) =>
                    multiplier *
                    (a.metadata.title || '').localeCompare(b.metadata.title || '');

            case LnSortMode.AUTHOR:
                return (a: any, b: any) =>
                    multiplier *
                    (a.metadata.author || '').localeCompare(b.metadata.author || '');

            case LnSortMode.LENGTH:
                return (a: any, b: any) =>
                    multiplier *
                    ((b.metadata.stats?.totalLength || 0) - (a.metadata.stats?.totalLength || 0));

            case LnSortMode.LANGUAGE:
                return (a: any, b: any) =>
                    multiplier *
                    ((a.metadata.language || 'unknown') > (b.metadata.language || 'unknown')
                        ? 1
                        : -1);

            case LnSortMode.LAST_READ:
                return (a: any, b: any) =>
                    multiplier *
                    ((b.progress?.lastRead || 0) - (a.progress?.lastRead || 0));

            case LnSortMode.PROGRESS:
                return (a: any, b: any) =>
                    multiplier *
                    ((b.progress?.totalProgress || 0) - (a.progress?.totalProgress || 0));

            default:
                return (a: any, b: any) => multiplier * (b.metadata.addedAt - a.metadata.addedAt);
        }
    }
}
