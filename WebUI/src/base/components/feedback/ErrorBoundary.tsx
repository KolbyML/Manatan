/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Component, ErrorInfo, ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { t } from 'i18next';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { EmptyView } from '@/base/components/feedback/EmptyView.tsx';

interface Props {
    children?: ReactNode;
    setTrackPathChange: (change: boolean) => void;
}

interface State {
    error: any;
}

class RealErrorBoundary extends Component<Props, State> {
    // eslint-disable-next-line react/state-in-constructor
    public state: State = { error: null };

    private prevPath: string = '';

    public static getDerivedStateFromError(error: any): State {
        // Update state so the next render will show the fallback UI.
        return { error };
    }

    componentDidMount() {
        this.prevPath = window.location.pathname;
    }

    public componentDidUpdate() {
        if (window.location.pathname !== this.prevPath) {
            this.setState({ error: null });
        }

        this.prevPath = window.location.pathname;
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // eslint-disable-next-line
        console.error('Uncaught error:', error, errorInfo);
        // eslint-disable-next-line react/destructuring-assignment
        this.props.setTrackPathChange(true);
    }

    public render() {
        const { error } = this.state;

        if (error) {
            return (
                <EmptyView
                    message={t('global.error.label.unrecoverable_error')}
                    messageExtra={getErrorMessage(error)}
                    retry={() => window.location.reload()}
                />
            );
        }

        const { children } = this.props;
        return children;
    }
}

export const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
    const [key, setKey] = useState(0);
    const { pathname } = useLocation();
    const previousPathnameRef = useRef(pathname);
    const [trackPathChange, setTrackPathChange] = useState(false);

    useEffect(() => {
        if (trackPathChange && previousPathnameRef.current !== pathname) {
            previousPathnameRef.current = pathname;
            setKey((currentKey) => (currentKey + 1) % 999999);
            setTrackPathChange(false);
        }
    }, [pathname, previousPathnameRef.current, trackPathChange]);

    return (
        <RealErrorBoundary key={key} setTrackPathChange={setTrackPathChange}>
            {children}
        </RealErrorBoundary>
    );
};
