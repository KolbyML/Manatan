/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import List from '@mui/material/List';
import ListSubheader from '@mui/material/ListSubheader';
import ListItemText from '@mui/material/ListItemText';

import ListItemButton from '@mui/material/ListItemButton';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { SelectSetting } from '@/base/components/settings/SelectSetting.tsx';
import { NumberSetting } from '@/base/components/settings/NumberSetting.tsx';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage, noOp } from '@/lib/HelperFunctions.ts';
import {
    KoreaderSyncChecksumMethod,
    KoreaderSyncConflictStrategy,
    KoSyncStatusPayload,
} from '@/lib/graphql/generated/graphql.ts';
import {
    KOREADER_SYNC_CHECKSUM_METHOD_SELECT_VALUES,
    KOREADER_SYNC_CONFLICT_STRATEGY_SELECT_VALUES,
    KOREADER_SYNC_PERCENTAGE_TOLERANCE,
} from '@/features/settings/Settings.constants.ts';
import { CredentialsLogin } from '@/base/components/modals/LoginDialog.tsx';
import { ServerSettings as ServerSettingsType, ServerSettings } from '@/features/settings/Settings.types.ts';
import { assertIsDefined } from '@/base/Asserts.ts';

export const KoreaderSyncSettings = ({
    settings: {
        koreaderSyncPercentageTolerance,
        koreaderSyncStrategyBackward,
        koreaderSyncStrategyForward,
        koreaderSyncChecksumMethod,
    },
    serverAddress: currentServerAddress,
    username: currentUsername,
    isLoggedIn,
    updateSetting,
}: {
    settings: ServerSettings;

    updateSetting: <Setting extends keyof ServerSettingsType>(
        setting: Setting,
        value: ServerSettingsType[Setting],
        onCompletion?: (success: boolean) => void,
    ) => Promise<void>;
} & Omit<KoSyncStatusPayload, '__typename'>) => {
    const { t } = useTranslation();

    const handleLogout = async () => {
        const { data } = await requestManager.koSyncLogout().response;

        if (data?.logoutKoSyncAccount.status.isLoggedIn) {
            throw new Error(
                t('tracking.action.logout.label.failure', { name: t('settings.server.koreader.sync.title') }),
            );
        }
    };

    const handleLogin = async (serverAddress: string, username: string, password: string) => {
        const { data } = await requestManager.koSyncLogin(serverAddress, username, password).response;

        if (!data?.connectKoSyncAccount.status.isLoggedIn) {
            throw new Error(data?.connectKoSyncAccount.message ?? t('global.label.unknown'));
        }
    };

    const handleLoginLogout = async (
        initialServerAddress: string = 'https://sync.koreader.rocks/',
        initialUsername?: string,
        initialPassword?: string,
    ) => {
        const controlled = CredentialsLogin.showControlled(
            {
                title: t(
                    isLoggedIn
                        ? 'settings.server.koreader.sync.connection.disconnect'
                        : 'settings.server.koreader.sync.connection.connect',
                    {
                        name: t('settings.server.koreader.sync.title'),
                    },
                ),
                description: isLoggedIn
                    ? t('settings.server.koreader.sync.connection.connected', {
                          username: initialUsername,
                          serverAddress: initialServerAddress,
                      })
                    : undefined,
                isLoading: false,
                isLoggedIn,
                withServerAddress: true,
                username: initialUsername,
                password: initialPassword,
                serverAddress: initialServerAddress,
                loginLogout: async (username, password, serverAddress) => {
                    controlled.update({ isLoading: true, loginLogout: noOp });

                    if (isLoggedIn) {
                        try {
                            await handleLogout();

                            controlled.submit();
                        } catch (e) {
                            makeToast(
                                t('settings.server.koreader.sync.connection.message.disconnect_error'),
                                'error',
                                getErrorMessage(e),
                            );
                        }

                        return;
                    }

                    try {
                        assertIsDefined(serverAddress);
                        await handleLogin(serverAddress, username, password);

                        controlled.submit();
                    } catch (e) {
                        makeToast(
                            t('settings.server.koreader.sync.connection.message.connect_error'),
                            'error',
                            getErrorMessage(e),
                        );

                        const RETRY_KEY = '__retry__';
                        const retry = await Promise.race([controlled.promise, Promise.resolve(RETRY_KEY)]);
                        if (retry === RETRY_KEY) {
                            handleLoginLogout(serverAddress, username, password);
                        }
                    }
                },
            },
            { id: 'koreader-sync-login-logout' },
        );
    };

    return (
        <List
            subheader={
                <ListSubheader component="div" id="koreader-sync-settings">
                    {t('settings.server.koreader.sync.title')}
                </ListSubheader>
            }
        >
            <ListItemButton
                onClick={() => handleLoginLogout(currentServerAddress ?? undefined, currentUsername ?? undefined)}
            >
                <ListItemText
                    primary={t('settings.server.koreader.sync.connection.status')}
                    secondary={
                        isLoggedIn
                            ? t('settings.server.koreader.sync.connection.connected', {
                                  username: currentUsername,
                                  serverAddress: currentServerAddress,
                              })
                            : t('settings.server.koreader.sync.connection.disconnected')
                    }
                />
            </ListItemButton>

            <SelectSetting<KoreaderSyncConflictStrategy>
                settingName={t('settings.server.koreader.sync.strategy.forward_title')}
                value={koreaderSyncStrategyForward}
                values={KOREADER_SYNC_CONFLICT_STRATEGY_SELECT_VALUES}
                handleChange={(value) => updateSetting('koreaderSyncStrategyForward', value)}
            />

            <SelectSetting<KoreaderSyncConflictStrategy>
                settingName={t('settings.server.koreader.sync.strategy.backward_title')}
                value={koreaderSyncStrategyBackward}
                values={KOREADER_SYNC_CONFLICT_STRATEGY_SELECT_VALUES}
                handleChange={(value) => updateSetting('koreaderSyncStrategyBackward', value)}
            />

            <SelectSetting<KoreaderSyncChecksumMethod>
                settingName={t('settings.server.koreader.sync.check_sum_method.title')}
                value={koreaderSyncChecksumMethod}
                values={KOREADER_SYNC_CHECKSUM_METHOD_SELECT_VALUES}
                handleChange={(value) => updateSetting('koreaderSyncChecksumMethod', value)}
            />

            <NumberSetting
                settingTitle={t('settings.server.koreader.sync.tolerance.title')}
                dialogDescription={t('settings.server.koreader.sync.tolerance.description')}
                settingValue={koreaderSyncPercentageTolerance.toString()}
                value={koreaderSyncPercentageTolerance}
                defaultValue={KOREADER_SYNC_PERCENTAGE_TOLERANCE.default}
                minValue={KOREADER_SYNC_PERCENTAGE_TOLERANCE.min}
                maxValue={KOREADER_SYNC_PERCENTAGE_TOLERANCE.max}
                stepSize={KOREADER_SYNC_PERCENTAGE_TOLERANCE.step}
                valueUnit=""
                handleUpdate={(value) => updateSetting('koreaderSyncPercentageTolerance', value)}
            />
        </List>
    );
};
