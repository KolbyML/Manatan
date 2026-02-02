/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect } from 'react';
import {
    APP_METADATA_KEY_PREFIX,
    METADATA_MIGRATIONS,
    VALID_APP_METADATA_KEYS,
} from '@/features/metadata/Metadata.constants.ts';
import {
    AppMetadataKeys,
    IMetadataMigration,
    Metadata,
    MetadataHolder,
    MetadataHolderType,
    MetadataKeyValuePair,
} from '@/features/metadata/Metadata.types.ts';
import { extractOriginalKey, getMetadataKey } from '@/features/metadata/Metadata.utils.ts';
import { MangaIdInfo } from '@/features/manga/Manga.types.ts';
import { CategoryIdInfo } from '@/features/category/Category.types.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { getMetadataDeleteFunction, getMetadataUpdateFunction } from '@/features/metadata/services/MetadataUpdater.ts';
import { SourceIdInfo } from '@/features/source/Source.types.ts';
import { ChapterIdInfo } from '@/features/chapter/Chapter.types.ts';

const getAppKeyPrefixForMigration = (migrationId: number): string => {
    const appKeyPrefix = METADATA_MIGRATIONS.slice(0, migrationId)
        .reverse()
        .find((migration) => !!migration.appKeyPrefix);

    return appKeyPrefix?.appKeyPrefix?.newPrefix ?? APP_METADATA_KEY_PREFIX;
};

const getAppMetadataFrom = (
    meta: Metadata,
    prefixes: string[] = [],
    appPrefix: string = APP_METADATA_KEY_PREFIX,
): Metadata => {
    const appMetadata: Metadata = {};

    Object.entries(meta).forEach(([key, value]) => {
        if (key.startsWith([appPrefix, ...prefixes].join('_'))) {
            appMetadata[key] = value;
        }
    });

    return appMetadata;
};

const applyAppKeyPrefixMigration = (meta: Metadata, migration: IMetadataMigration): Metadata => {
    const migratedMetadata: Metadata = { ...meta };

    if (!migration.appKeyPrefix) {
        return migratedMetadata;
    }

    const { oldPrefix, newPrefix } = migration.appKeyPrefix;

    const oldAppMetadata = getAppMetadataFrom(meta, undefined, oldPrefix);

    Object.keys(oldAppMetadata).forEach((oldKey) => {
        const keyWithNewPrefix = oldKey.replace(oldPrefix, newPrefix);
        migratedMetadata[keyWithNewPrefix] = oldAppMetadata[oldKey];
    });

    return migratedMetadata;
};

const applyMetadataValueMigration = (meta: Metadata, migration: IMetadataMigration, appKeyPrefix: string): Metadata => {
    const migratedMetadata: Metadata = { ...meta };

    if (!migration.values) {
        return migratedMetadata;
    }

    const appMetadata = getAppMetadataFrom(meta, undefined, appKeyPrefix);
    const metadataValueChanges = migration.values;

    metadataValueChanges.forEach(({ key, oldValue, newValue }) => {
        const migrateValue = (metaKey: string) => {
            if (
                (oldValue === undefined && meta[metaKey] === oldValue) ||
                (oldValue !== undefined && meta[metaKey].match(oldValue))
            ) {
                migratedMetadata[metaKey] = typeof newValue === 'function' ? newValue(meta[metaKey]) : newValue;
            }
        };

        const migrateValueOfAllAppKeys = key === undefined;
        Object.keys(appMetadata).forEach((metaKey) => {
            if (migrateValueOfAllAppKeys || metaKey.endsWith(key)) {
                migrateValue(metaKey);
            }
        });
    });

    return migratedMetadata;
};

const applyMetadataKeyMigration = (meta: Metadata, migration: IMetadataMigration, appKeyPrefix: string): Metadata => {
    const migratedMetadata: Metadata = { ...meta };

    if (!migration.keys) {
        return migratedMetadata;
    }

    const appMetadata = getAppMetadataFrom(meta, undefined, appKeyPrefix);

    migration.keys.forEach(({ oldKey, newKey }) => {
        Object.keys(appMetadata).forEach((key) => {
            if (!key.endsWith(oldKey)) {
                return;
            }

            const prefixes = key.split('_');
            const prefix = prefixes.slice(0, prefixes.length - 1).join('_');

            const newKeyWithOldKeysPrefix = `${prefix}_${newKey}`;

            migratedMetadata[newKeyWithOldKeysPrefix] = appMetadata[key];
        });
    });

    return migratedMetadata;
};

const applyMetadataDeleteKeysMigration = (
    meta: Metadata,
    migration: IMetadataMigration,
    appKeyPrefix: string,
): Metadata => {
    const migratedMetadata: Metadata = {};

    if (!migration.deleteKeys) {
        return { ...meta };
    }

    const appMetadata = getAppMetadataFrom(meta, undefined, appKeyPrefix);

    Object.keys(appMetadata).forEach((key) => {
        if (migration.deleteKeys?.includes(extractOriginalKey(key))) {
            return;
        }

        migratedMetadata[key] = appMetadata[key];
    });

    return migratedMetadata;
};

const getOutdatedMetadataKeys = (metadata: Metadata | undefined, migrationId: number): AppMetadataKeys[] => {
    if (!metadata) {
        return [];
    }

    const oldAppKeyPrefixes = METADATA_MIGRATIONS.slice(migrationId).reduce((acc, migration) => {
        const oldPrefix = migration.appKeyPrefix?.oldPrefix;
        if (!oldPrefix) {
            return acc;
        }

        return [...acc, oldPrefix];
    }, [] as string[]);

    const keyToDeleteInMigrations = METADATA_MIGRATIONS.slice(migrationId).reduce(
        (acc, migration) => [...acc, ...(migration.deleteKeys ?? [])],
        [] as string[],
    );

    return Object.keys(metadata).filter((key) => {
        const appKeyPrefixOfKey = key.split('_')[0];

        const isMetadataKeyOfApp = [...oldAppKeyPrefixes, APP_METADATA_KEY_PREFIX].includes(appKeyPrefixOfKey);
        if (!isMetadataKeyOfApp) {
            return false;
        }

        const isOldKeyPrefix = oldAppKeyPrefixes.includes(appKeyPrefixOfKey);
        if (isOldKeyPrefix) {
            return true;
        }

        const extractedKey = extractOriginalKey(key);

        if (keyToDeleteInMigrations.includes(extractedKey)) {
            return true;
        }

        return !VALID_APP_METADATA_KEYS.includes(extractedKey);
    }) as AppMetadataKeys[];
};

const getNewMetadataKeys = (
    metadata: Metadata | undefined,
    migratedMetadata: Metadata,
    metadataKeyToDelete: string[],
    migrationId: number,
): string[] => {
    if (!metadata) {
        return [];
    }

    const newKeys = METADATA_MIGRATIONS.slice(migrationId).reduce((acc, migration) => {
        if (!migration.keys) {
            return acc;
        }

        const keys = migration.keys.map(({ newKey }) => newKey).filter((key) => key !== undefined);

        return [...acc, ...keys];
    }, [] as string[]);

    return Object.keys(migratedMetadata).filter((metadataKey) => {
        const key = extractOriginalKey(metadataKey);

        const isNewKeyOfAMigration = newKeys.includes(key);
        const isOldKeyOfAMigration = metadataKeyToDelete.includes(key);
        const isAlreadyCommited = Object.hasOwn(metadata, metadataKey);

        return !isAlreadyCommited && isNewKeyOfAMigration && !isOldKeyOfAMigration;
    });
};

const getMetadataKeysWithUpdatedValues = (
    metadata: Metadata | undefined,
    newAndDeletedMetadataKeys: string[],
    migrationId: number,
): string[] => {
    if (!metadata) {
        return [];
    }

    const keysWithUpdatedValues = METADATA_MIGRATIONS.slice(migrationId).reduce((acc, migration) => {
        const keysWithUpdatedValuesOfMigration = Object.keys(metadata).filter((metadataKey) =>
            migration.values?.some(({ key: migrationKey, oldValue }) => {
                const isMigrationForAllKeys = !migrationKey;
                const doesValueMatch = metadata[metadataKey] === oldValue;

                if (isMigrationForAllKeys) {
                    return doesValueMatch;
                }

                return metadataKey.endsWith(migrationKey) && doesValueMatch;
            }),
        );

        return [...acc, ...keysWithUpdatedValuesOfMigration];
    }, [] as string[]);

    return [
        ...new Set([
            ...keysWithUpdatedValues.filter(
                (keyWithUpdatedValue) => !newAndDeletedMetadataKeys.includes(keyWithUpdatedValue),
            ),
        ]),
    ];
};

/**
 * Prevent spamming requests due to frequent metadata reads while the migration hasn't been commited to the server yet
 */
const commitedMigrations = new Set<string>();
const commitMigratedMetadata = (
    type: MetadataHolderType,
    metadataHolder:
        | MetadataHolder
        | (MangaIdInfo & MetadataHolder)
        | (ChapterIdInfo & MetadataHolder)
        | (CategoryIdInfo & MetadataHolder)
        | (SourceIdInfo & MetadataHolder)
        | undefined,
    migratedMetadata: Metadata,
    useEffectFn: typeof useEffect = (fn: () => void) => fn(),
): void => {
    const metadata = metadataHolder?.meta;

    const migrationId = Number(metadata?.[getMetadataKey('migration')] ?? 1);

    const metadataKeysToDelete = getOutdatedMetadataKeys(metadata, migrationId);
    const newMetadataKeys = getNewMetadataKeys(metadata, migratedMetadata, metadataKeysToDelete, migrationId);
    const metadataKeysWithUpdatedValues = getMetadataKeysWithUpdatedValues(
        metadata,
        [...metadataKeysToDelete, ...newMetadataKeys],
        migrationId,
    );
    const metadataToUpdate = [...newMetadataKeys, ...metadataKeysWithUpdatedValues].map((key) => [
        key,
        migratedMetadata[key],
    ]) as MetadataKeyValuePair[];

    const updateMetadata = getMetadataUpdateFunction(type, metadataHolder ?? { id: -1, meta: {} });
    const deleteMetadata = getMetadataDeleteFunction(type, metadataHolder ?? { id: -1, meta: {} });

    useEffectFn(() => {
        (async () => {
            const itemMigrationKey = `${type}_${type === 'global' ? '' : (metadataHolder as { id: any } | undefined)?.id}`;

            const commitMigration = !commitedMigrations.has(itemMigrationKey);
            if (!commitMigration) {
                return;
            }

            const isMetadataAlreadyMigrated = !metadata || migrationId === METADATA_MIGRATIONS.length;

            const isCommitRequired =
                !isMetadataAlreadyMigrated && (!!metadataKeysToDelete.length || !!metadataToUpdate.length);
            if (!isCommitRequired) {
                return;
            }

            commitedMigrations.add(itemMigrationKey);

            try {
                await updateMetadata([...metadataToUpdate], undefined, true);
                await deleteMetadata(metadataKeysToDelete, undefined, true);
                await updateMetadata([['migration', METADATA_MIGRATIONS.length]]);
            } catch (e) {
                commitedMigrations.delete(itemMigrationKey);

                defaultPromiseErrorHandler(
                    `MetadataMigrations#commitMigrateMetadata(${type}, ${(metadataHolder as { id: any })?.id})`,
                )(e);
            }
        })();
    });
};

export const applyMetadataMigrations = (
    type: MetadataHolderType,
    metadataHolder?:
        | MetadataHolder
        | (MangaIdInfo & MetadataHolder)
        | (ChapterIdInfo & MetadataHolder)
        | (CategoryIdInfo & MetadataHolder)
        | (SourceIdInfo & MetadataHolder),
    useEffectFn: typeof useEffect = (fn: () => void) => fn(),
): Metadata | undefined => {
    const meta = { ...(metadataHolder?.meta ?? {}) };

    const migrationIdKey = getMetadataKey('migration');
    const appliedMigrationId = Number.isNaN(Number(meta[migrationIdKey]))
        ? 0
        : Math.max(0, Number(meta[migrationIdKey]));

    const migrationToMetadata: [number, Metadata][] = [[0, meta]];

    METADATA_MIGRATIONS.forEach((migration, index) => {
        const migrationId = index + 1;
        const metadataToMigrate = migrationToMetadata[migrationId - 1][1];

        const isMigrationRequired = appliedMigrationId < migrationId;
        if (!isMigrationRequired) {
            migrationToMetadata.push([migrationId, metadataToMigrate]);
            return;
        }

        const appKeyPrefixForMigration = getAppKeyPrefixForMigration(migrationId);
        const appKeyPrefixMigrated = applyAppKeyPrefixMigration(metadataToMigrate, migration);
        const metadataValuesMigrated = applyMetadataValueMigration(
            appKeyPrefixMigrated,
            migration,
            appKeyPrefixForMigration,
        );
        const metadataKeysMigrated = applyMetadataKeyMigration(
            metadataValuesMigrated,
            migration,
            appKeyPrefixForMigration,
        );
        const metadataKeysDeletedMigrated = applyMetadataDeleteKeysMigration(
            metadataKeysMigrated,
            migration,
            appKeyPrefixForMigration,
        );

        migrationToMetadata.push([migrationId, metadataKeysDeletedMigrated]);
    });

    const migratedMetadata = migrationToMetadata.pop()?.[1] ?? meta;

    commitMigratedMetadata(type, metadataHolder, migratedMetadata, useEffectFn);

    return migratedMetadata;
};
