/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect } from 'react';
import Stack from '@mui/material/Stack';
import { Trans, useTranslation } from 'react-i18next';
import { useRecordHotkeys } from 'react-hotkeys-hook';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Hotkey } from '@/features/reader/hotkeys/settings/components/Hotkey.tsx';

export const RecordHotkey = ({
    onClose,
    onCreate,
    existingKeys,
    disablePortal,
    container,
}: {
    onClose: () => void;
    onCreate: (keys: string[]) => void;
    existingKeys: string[];
    disablePortal?: boolean;
    container?: Element | null;
}) => {
    const { t } = useTranslation();

    const [recordedKeys, { start, stop, resetKeys }] = useRecordHotkeys();
    const keys = [[...recordedKeys].join('+')];
    const isExistingKey = keys.some((key) =>
        existingKeys.map((existingKey) => existingKey.toLowerCase()).includes(key.toLowerCase()),
    );

    useEffect(() => {
        start();

        return () => {
            stop();
        };
    }, []);

    return (
        <Dialog
            open
            onClose={onClose}
            fullWidth
            disablePortal={disablePortal}
            container={container ?? undefined}
        >
            <DialogTitle>{t('hotkeys.create.dialog.title')}</DialogTitle>
            <DialogContent>
                <Stack sx={{ flexDirection: 'row', gap: 1 }}>
                    <Trans
                        i18nKey="hotkeys.create.dialog.label"
                        components={{
                            Keys: recordedKeys.size ? (
                                <Hotkey keys={keys} />
                            ) : (
                                <Typography>{t('hotkeys.create.dialog.placeholder')}</Typography>
                            ),
                        }}
                    >
                        Recorded keys:
                    </Trans>
                </Stack>
                {isExistingKey && <Typography color="error">{t('hotkeys.create.error.exists')}</Typography>}
            </DialogContent>
            <DialogActions>
                <Stack
                    direction="row"
                    sx={{
                        justifyContent: 'space-between',
                        width: '100%',
                    }}
                >
                    <Button onClick={resetKeys}>{t('global.button.reset')}</Button>
                    <Stack direction="row">
                        <Button onClick={onClose}>{t('global.button.cancel')}</Button>
                        <Button
                            disabled={isExistingKey}
                            onClick={() => {
                                onClose();
                                onCreate(keys);
                            }}
                        >
                            {t('global.button.create')}
                        </Button>
                    </Stack>
                </Stack>
            </DialogActions>
        </Dialog>
    );
};
