/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ListItemLink } from '@/base/components/lists/ListItemLink.tsx';
import { AuthManager } from '@/features/authentication/AuthManager.ts';
import { KOFI_URL, MEMBERSHIP_PERKS } from '@/features/membership/Membership.constants.ts';

const STORAGE_KEYS = {
    firstOpenAt: 'manatan:membership-perks:first-open-at:v1',
    remindLaterUntil: 'manatan:membership-perks:remind-later-until:v1',
    dismissed: 'manatan:membership-perks:dismissed:v1',
} as const;

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const readStoredNumber = (key: string): number | null => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return null;
        }

        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const writeStoredNumber = (key: string, value: number): void => {
    try {
        localStorage.setItem(key, String(value));
    } catch {
        // ignore
    }
};

const readStoredBool = (key: string): boolean => {
    try {
        return localStorage.getItem(key) === '1';
    } catch {
        return false;
    }
};

const writeStoredBool = (key: string, value: boolean): void => {
    try {
        localStorage.setItem(key, value ? '1' : '0');
    } catch {
        // ignore
    }
};

export const MembershipPerksPopup = () => {
    const isAuthenticated = AuthManager.useIsAuthenticated();

    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const now = Date.now();

        const firstOpenAt = readStoredNumber(STORAGE_KEYS.firstOpenAt);
        if (!firstOpenAt) {
            writeStoredNumber(STORAGE_KEYS.firstOpenAt, now);
            return;
        }

        if (!isAuthenticated) {
            return;
        }

        if (readStoredBool(STORAGE_KEYS.dismissed)) {
            return;
        }

        const remindLaterUntil = readStoredNumber(STORAGE_KEYS.remindLaterUntil);
        if (remindLaterUntil && now < remindLaterUntil) {
            return;
        }

        const shouldShow = now - firstOpenAt >= THREE_DAYS_MS;
        if (shouldShow) {
            setOpen(true);
        }
    }, [isAuthenticated]);

    const handleRemindLater = () => {
        setOpen(false);
        writeStoredNumber(STORAGE_KEYS.remindLaterUntil, Date.now() + THREE_DAYS_MS);
    };

    const handleDontShowAgain = () => {
        setOpen(false);
        writeStoredBool(STORAGE_KEYS.dismissed, true);
    };

    if (!open) {
        return null;
    }

    return (
        <Dialog
            open={open}
            onClose={handleRemindLater}
            fullWidth
            maxWidth="sm"
            scroll="paper"
            PaperProps={{
                sx: {
                    borderRadius: 2,
                },
            }}
        >
            <DialogTitle
                sx={{
                    pb: 1.5,
                    background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.14), rgba(52, 152, 219, 0.10))',
                }}
            >
                <Stack spacing={0.5}>
                    <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: -0.4 }}>
                        Membership perks
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Support Manatan's development and unlock member-only perks.
                    </Typography>
                </Stack>
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                        Manatan is built to stay fast and free. Membership helps fund development, hosting, and testing —
                        and lets me ship bigger features sooner.
                    </Typography>

                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Perks included
                        </Typography>
                        <List dense disablePadding sx={{ '& .MuiListItem-root': { px: 0 } }}>
                            {MEMBERSHIP_PERKS.map((perk) => (
                                <ListItem key={perk} disableGutters>
                                    <ListItemText
                                        primary={perk}
                                        primaryTypographyProps={{ variant: 'body2' }}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </Paper>

                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                        <Box
                            sx={{
                                p: 2,
                                background:
                                    'linear-gradient(135deg, rgba(46, 204, 113, 0.10), rgba(52, 152, 219, 0.06))',
                            }}
                        >
                            <Typography variant="subtitle2">Join on Ko-fi</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Become a member at the link below.
                            </Typography>
                        </Box>
                        <Divider />
                        <List dense disablePadding>
                            <ListItemLink
                                to={KOFI_URL}
                                target="_blank"
                                rel="noreferrer"
                                sx={{ px: 2, py: 1.25 }}
                            >
                                <ListItemText primary="Ko-fi" secondary={KOFI_URL} />
                            </ListItemLink>
                        </List>
                    </Paper>
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={handleRemindLater} color="primary">
                    Remind me later
                </Button>
                <Button onClick={handleDontShowAgain} color="primary" variant="contained">
                    Don&apos;t show it again
                </Button>
            </DialogActions>
        </Dialog>
    );
};
