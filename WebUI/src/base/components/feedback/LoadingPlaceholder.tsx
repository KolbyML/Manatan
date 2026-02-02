/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { type JSX } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

interface IProps {
    shouldRender?: boolean | (() => boolean);
    children?: React.ReactNode;
    component?: string | React.FunctionComponent<any> | React.ComponentClass<any, any>;
    componentProps?: any;
    usePadding?: boolean;
}

export function LoadingPlaceholder(props: IProps) {
    const { children, shouldRender, component, componentProps, usePadding } = props;

    let condition = true;
    if (shouldRender !== undefined) {
        condition = shouldRender instanceof Function ? shouldRender() : shouldRender;
    }

    if (condition) {
        if (component) {
            return React.createElement(component, componentProps);
        }

        if (children) {
            return children as JSX.Element;
        }
    }

    return (
        <Box
            sx={{
                margin: '0px auto',
                marginTop: usePadding ? 'unset' : '10px',
                marginBottom: usePadding ? 'unset' : '10px',
                padding: usePadding ? '10px 0' : 'unset',
                display: 'flex',
                justifyContent: 'center',
            }}
        >
            <CircularProgress thickness={5} />
        </Box>
    );
}
