/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { AwaitableComponentProps } from 'awaitable-component';
import { Link as RouterLink } from 'react-router-dom';

type Action = {
    show?: boolean;
    title?: string;
    contain?: boolean;
};

type Actions = {
    extra?: Action & { link?: string };
    cancel?: Action;
    confirm?: Action;
};

export const ConfirmDialog = ({
    title,
    message,
    actions: passedActions,
    onExtra,
    onDismiss,
    onSubmit,
    isVisible,
    onExitComplete,
}: AwaitableComponentProps & {
    title: string;
    message: string;
    actions?: Actions;
    onExtra?: () => void;
}) => {
    const { t } = useTranslation();

    const actions = {
        extra: {
            show: passedActions?.extra?.show ?? false,
            title: passedActions?.extra?.title ?? '',
            contain: passedActions?.extra?.contain ?? false,
            link: passedActions?.extra?.link ?? undefined,
        },
        cancel: {
            show: passedActions?.cancel?.show ?? true,
            title: passedActions?.cancel?.title ?? t('global.button.cancel'),
            contain: passedActions?.cancel?.contain ?? false,
        },
        confirm: {
            show: passedActions?.confirm?.show ?? true,
            title: passedActions?.confirm?.title ?? t('global.button.ok'),
            contain:
                !passedActions?.extra?.contain &&
                !passedActions?.cancel?.contain &&
                !passedActions?.confirm?.contain &&
                true,
        },
    } satisfies Actions;

    return (
        <Dialog open={isVisible} onTransitionExited={onExitComplete} onClose={onDismiss}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent
                sx={{
                    whiteSpace: 'pre-line',
                }}
            >
                {message}
            </DialogContent>
            <DialogActions>
                <Stack
                    sx={{
                        flexDirection: 'row',
                        justifyContent: actions.extra.show ? 'space-between' : 'end',
                        width: '100%',
                        gap: 1,
                    }}
                >
                    {(() => {
                        if (!actions.extra.show) {
                            return null;
                        }

                        if (actions.extra.link) {
                            return (
                                <Button
                                    component={RouterLink}
                                    to={actions.extra.link}
                                    onClick={() => {
                                        onDismiss();
                                        onExtra?.();
                                    }}
                                    variant={actions.extra.contain ? 'contained' : undefined}
                                >
                                    {actions.extra.title}
                                </Button>
                            );
                        }

                        return (
                            <Button
                                onClick={() => {
                                    onDismiss();
                                    onExtra?.();
                                }}
                                variant={actions.extra.contain ? 'contained' : undefined}
                            >
                                {actions.extra.title}
                            </Button>
                        );
                    })()}
                    <Stack
                        sx={{
                            flexDirection: 'row',
                            gap: 1,
                        }}
                    >
                        {actions.cancel.show && (
                            <Button onClick={onDismiss} variant={actions.cancel.contain ? 'contained' : undefined}>
                                {actions.cancel.title}
                            </Button>
                        )}
                        {actions.confirm.show && (
                            <Button onClick={onSubmit} variant={actions.confirm.contain ? 'contained' : undefined}>
                                {actions.confirm.title}
                            </Button>
                        )}
                    </Stack>
                </Stack>
            </DialogActions>
        </Dialog>
    );
};
