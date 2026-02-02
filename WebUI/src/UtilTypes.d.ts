/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

type ExtractByKeyValue<T, Key extends keyof T, Value extends T[Key]> = T extends
    | Record<Key, Value>
    | Partial<Record<Key, Value>>
    ? T
    : never;

type RecursivePartial<T> = {
    [P in keyof T]?: T[P] extends (infer U)[]
        ? RecursivePartial<U>[]
        : T[P] extends object | undefined
          ? RecursivePartial<T[P]>
          : T[P];
};

type NullAndUndefined<T> = T | null | undefined;

type NonNullableProperties<T> = { [P in keyof T]-?: NonNullable<T[P]> };

type OptionalProperty<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type PropertiesNever<T> = { [key in keyof T]?: never };

type OmitFirst<T extends any[]> = T extends [any, ...infer R] ? R : never;

type TupleUnion<U extends string | number | symbol, R extends any[] = []> = {
    [S in U]: Exclude<U, S> extends never ? [...R, S] : TupleUnion<Exclude<U, S>, [...R, S]>;
}[U];

type ValueWithDefaultFlag<T> = { value: T; isDefault: boolean };

type TransformRecordToWithDefaultFlag<T extends Record<string, any>> = {
    [K in keyof T]: ValueWithDefaultFlag<T[K]>;
};

type ExtractValueWithDefaultFlag<T extends ValueWithDefaultFlag<any>> = T extends ValueWithDefaultFlag<infer V> ? V : T;

type MergeObjectsArray<T extends object[]> = T extends [infer F, ...infer R]
    ? F & MergeObjectsArray<R extends object[] ? R : []>
    : {};

type OmitNotMatching<T, K extends keyof T> = {
    [P in K]: T[K];
};

type ExtractCommon<T, U> = {
    [K in keyof T & keyof U]: T[K] extends U[K] ? T[K] : never;
};

type HasRequiredKeys<T> =
    Exclude<
        {
            [K in keyof T]: T extends Record<K, T[K]> ? K : never;
        }[keyof T],
        undefined
    > extends never
        ? false
        : true;
