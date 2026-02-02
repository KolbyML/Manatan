/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Dialog from '@mui/material/Dialog';
import { AwaitableComponent, AwaitableComponentProps } from 'awaitable-component';
import DialogTitle from '@mui/material/DialogTitle';
import { useTranslation } from 'react-i18next';
import DialogContent from '@mui/material/DialogContent';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { PasswordTextField } from '@/base/components/inputs/PasswordTextField.tsx';

export const LoginDialog = ({
    isVisible,
    onExitComplete,
    onSubmit,
    title,
    description,
    isLoggedIn,
    isLoading,
    loginLogout,
    username: initialUsername = '',
    password: initialPassword = '',
    serverAddress: initialServerAddress = '',
    withServerAddress = false,
}: AwaitableComponentProps<void> & {
    title: string;
    description?: string;
    isLoggedIn: boolean;
    isLoading: boolean;
    loginLogout: (username: string, password: string, serverAddress?: string) => void;
    username?: string;
    password?: string;
    serverAddress?: string;
    withServerAddress?: boolean;
}) => {
    const { t } = useTranslation();

    const [serverAddress, setServerAddress] = useState(initialServerAddress);
    const [username, setUsername] = useState(initialUsername);
    const [password, setPassword] = useState(initialPassword);

    return (
        <Dialog open={isVisible} onTransitionExited={onExitComplete} onClose={() => onSubmit()} disableRestoreFocus>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent hidden={!description && isLoggedIn}>
                {description && <Typography>{description}</Typography>}
                {!isLoggedIn && (
                    <>
                        {withServerAddress && (
                            <TextField
                                margin="dense"
                                id="serverAddress"
                                name="serverAddress"
                                label={t('settings.about.server.label.address')}
                                type="text"
                                fullWidth
                                variant="standard"
                                value={serverAddress}
                                onChange={(e) => setServerAddress(e.target.value)}
                            />
                        )}
                        <TextField
                            autoFocus
                            margin="dense"
                            id="username"
                            name="username"
                            label={t('global.label.username')}
                            type="text"
                            fullWidth
                            variant="standard"
                            onChange={(e) => setUsername(e.target.value)}
                        />
                        <PasswordTextField
                            margin="dense"
                            fullWidth
                            variant="standard"
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onSubmit()}>{t('global.button.cancel')}</Button>
                <Button
                    variant="contained"
                    disabled={
                        !isLoggedIn &&
                        (isLoading ||
                            !username.length ||
                            !password.length ||
                            (withServerAddress && !serverAddress?.length))
                    }
                    onClick={() => loginLogout(username, password, serverAddress)}
                >
                    {t(isLoggedIn ? 'global.button.log_out' : 'global.button.log_in')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export const CredentialsLogin = AwaitableComponent.create(LoginDialog);
