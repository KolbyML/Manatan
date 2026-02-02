/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ComponentType, memo, Ref } from 'react';

type PropsSourceCreator<T, Props extends Record<string, any>> = (props: Props) => T;

export const withPropsFrom = <
    ComponentProps extends Record<string, any>,
    SourceProps extends Record<string, any>[],
    SourcePropKeys extends keyof (ComponentProps | MergeObjectsArray<SourceProps>),
>(
    Component: ComponentType<ComponentProps>,
    propsSources: {
        [K in keyof SourceProps]: PropsSourceCreator<SourceProps[K], Omit<ComponentProps, SourcePropKeys>>;
    },
    sourcePropKeys: SourcePropKeys[],
) =>
    memo(({ ref, ...props }: Omit<ComponentProps, SourcePropKeys> & { ref?: Ref<HTMLElement> }) => {
        const sourceProps = propsSources.reduce(
            (acc, propsSource) => ({
                ...acc,
                ...propsSource(props as unknown as Omit<ComponentProps, SourcePropKeys>),
            }),
            {},
        );

        const selectedProps = Object.fromEntries(
            Object.entries(sourceProps).filter(([key]) => sourcePropKeys.includes(key as SourcePropKeys)),
        ) as Pick<MergeObjectsArray<SourceProps>, SourcePropKeys>;

        const combinedProps = { ...props, ...selectedProps } as unknown as ComponentProps;

        return <Component {...combinedProps} ref={ref} />;
    });
