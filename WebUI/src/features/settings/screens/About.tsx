/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/GridLegacy';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { ListItemLink } from '@/base/components/lists/ListItemLink.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { VersionInfo, WebUIVersionInfo } from '@/features/app-updates/components/VersionInfo.tsx';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { dateFormatter, epochToDate } from '@/base/utils/DateHelper.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { makeToast } from '@/base/utils/Toast.ts';

type Contributor = {
    key: string;
    name: string;
    count: number;
    profileUrl?: string;
};

type ContributorsCache = {
    updatedAt: number;
    contributors: Contributor[];
};

type MembershipTier = {
    key: string;
    label: string;
    backers: string[];
};

const CONTRIBUTORS_CACHE_KEY = 'manatan:contributors:v1';
const CONTRIBUTORS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const WEBUI_SINCE_ISO = '2025-12-26T00:00:00Z';
const MANATAN_REPO_API = 'https://api.github.com/repos/KolbyML/Manatan';
const WEBUI_REPO_API = 'https://api.github.com/repos/KolbyML/Manatan-WebUI';
const MAX_GITHUB_PAGES = 10;
const MEMBERSHIP_PERKS = [
    '🚀 1 month early access to builds',
    '📝 Your name in the Manatan About page',
    '🎖️ Discord role',
];

const MEMBERSHIP_TIERS: MembershipTier[] = [
    { key: 'diamond', label: '💎 Diamond', backers: [] },
    { key: 'ruby', label: '❤️ Ruby', backers: [] },
    { key: 'sapphire', label: '🔷 Sapphire', backers: [] },
    { key: 'emerald', label: '🟢 Emerald', backers: ['Samu'] },
    { key: 'crystal', label: '✨ Crystal', backers: ['Emelia', 'artgor', 'Enviromath', 'Leighton Woods'] },
    { key: 'stone', label: '🪨 Stone', backers: ['Helios', 'Ryohei11'] },
];

const DONATION_ADDRESSES = [
    {
        key: 'bitcoin',
        label: '₿ Bitcoin',
        ariaLabel: 'Bitcoin',
        address: 'bc1pzeyspv22h2uq02dnrnj0sj0yspzp9vqeh86rplr0wf4jscez8eks4m3v9e',
    },
    {
        key: 'ethereum',
        label: 'Ξ Ethereum',
        ariaLabel: 'Ethereum',
        address: '0x752df0f140C6DF6c007873843D5af07fEb825559',
    },
    {
        key: 'monero',
        label: 'ɱ Monero',
        ariaLabel: 'Monero',
        address: '84rcyGS5aXseCrhvRzBHMZg86NzN3n5JJBpmJV42wKpKanHAum9Fb9VjoN9sCLoiCn7K2cVufBoZXJ9w9rNsnu5xCwEEB4V',
    },
    {
        key: 'solana',
        label: '◎ Solana',
        ariaLabel: 'Solana',
        address: 'Dr8rsFw4JGBnnPpah8iq6pR6RaH41QYpZYgmpEsoBcMC',
    },
];

const parseNextLink = (linkHeader: string | null): string | null => {
    if (!linkHeader) {
        return null;
    }
    const entries = linkHeader.split(',');
    for (const entry of entries) {
        const match = entry.match(/<([^>]+)>;\s*rel="([^"]+)"/);
        if (match && match[2] === 'next') {
            return match[1];
        }
    }
    return null;
};

const fetchGithubPages = async (url: string): Promise<any[]> => {
    let nextUrl: string | null = url;
    const results: any[] = [];
    let page = 0;

    while (nextUrl && page < MAX_GITHUB_PAGES) {
        const response = await fetch(nextUrl, {
            headers: { Accept: 'application/vnd.github+json' },
        });
        if (!response.ok) {
            throw new Error(`GitHub request failed (${response.status})`);
        }
        const data = await response.json();
        if (Array.isArray(data)) {
            results.push(...data);
        }
        nextUrl = parseNextLink(response.headers.get('Link'));
        page += 1;
    }

    return results;
};

const readContributorsCache = (): ContributorsCache | null => {
    try {
        const raw = localStorage.getItem(CONTRIBUTORS_CACHE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as ContributorsCache;
        if (!parsed || !Array.isArray(parsed.contributors) || typeof parsed.updatedAt !== 'number') {
            return null;
        }
        if (Date.now() - parsed.updatedAt > CONTRIBUTORS_CACHE_TTL_MS) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
};

const writeContributorsCache = (payload: ContributorsCache) => {
    try {
        localStorage.setItem(CONTRIBUTORS_CACHE_KEY, JSON.stringify(payload));
    } catch {
        // Ignore cache write errors.
    }
};

const fetchManatanContributors = async (): Promise<Contributor[]> => {
    const contributors = await fetchGithubPages(`${MANATAN_REPO_API}/contributors?per_page=100&anon=1`);
    return contributors.map((entry: any) => {
        const login = entry.login as string | undefined;
        const name = login || entry.name || 'Unknown';
        const key = login ? `gh:${login}` : `anon:${entry.name || entry.email || name}`;
        return {
            key,
            name,
            count: typeof entry.contributions === 'number' ? entry.contributions : 0,
            profileUrl: login ? entry.html_url : undefined,
        };
    });
};

const fetchWebUiContributors = async (): Promise<Contributor[]> => {
    const commits = await fetchGithubPages(
        `${WEBUI_REPO_API}/commits?since=${encodeURIComponent(WEBUI_SINCE_ISO)}&per_page=100`,
    );
    const map = new Map<string, Contributor>();

    commits.forEach((entry: any) => {
        const author = entry.author;
        const login = author?.login as string | undefined;
        const name = login || entry.commit?.author?.name || 'Unknown';
        const key = login ? `gh:${login}` : `name:${name}`;
        const existing = map.get(key);
        if (existing) {
            existing.count += 1;
            if (!existing.profileUrl && author?.html_url) {
                existing.profileUrl = author.html_url;
            }
        } else {
            map.set(key, {
                key,
                name,
                count: 1,
                profileUrl: author?.html_url,
            });
        }
    });

    return Array.from(map.values());
};

const fetchCombinedContributors = async (): Promise<ContributorsCache> => {
    const [manatan, webui] = await Promise.all([fetchManatanContributors(), fetchWebUiContributors()]);
    const combined = new Map<string, Contributor>();

    const merge = (entry: Contributor) => {
        const existing = combined.get(entry.key);
        if (existing) {
            existing.count += entry.count;
            if (!existing.profileUrl && entry.profileUrl) {
                existing.profileUrl = entry.profileUrl;
            }
        } else {
            combined.set(entry.key, { ...entry });
        }
    };

    manatan.forEach(merge);
    webui.forEach(merge);

    const contributors = Array.from(combined.values()).sort((a, b) => {
        if (b.count !== a.count) {
            return b.count - a.count;
        }
        return a.name.localeCompare(b.name);
    });

    return { updatedAt: Date.now(), contributors };
};

const renderContributorInline = (contributors: Contributor[]): ReactNode => {
    if (!contributors.length) {
        return 'No contributors found yet.';
    }
    const nodes: ReactNode[] = [];
    contributors.forEach((contributor, index) => {
        if (index > 0) {
            nodes.push(', ');
        }
        const label = `${contributor.name} (${contributor.count})`;
        if (contributor.profileUrl) {
            nodes.push(
                <a
                    key={contributor.key}
                    href={contributor.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#fff', textDecoration: 'underline' }}
                >
                    {label}
                </a>,
            );
        } else {
            nodes.push(<span key={contributor.key}>{label}</span>);
        }
    });
    return nodes;
};

export function About() {
    const { t } = useTranslation();

    const [contributors, setContributors] = useState<Contributor[]>([]);
    const [contributorsUpdatedAt, setContributorsUpdatedAt] = useState<number | null>(null);
    const [contributorsLoading, setContributorsLoading] = useState(false);
    const [contributorsError, setContributorsError] = useState<string | null>(null);

    useAppTitle(t('settings.about.title'));

    const { data, loading, error, refetch } = requestManager.useGetAbout({ notifyOnNetworkStatusChange: true });

    const {
        data: serverUpdateCheckData,
        loading: isCheckingForServerUpdate,
        refetch: checkForServerUpdate,
        error: serverUpdateCheckError,
    } = requestManager.useCheckForServerUpdate({ notifyOnNetworkStatusChange: true });

    useEffect(() => {
        let cancelled = false;

        const loadContributors = async () => {
            setContributorsLoading(true);
            setContributorsError(null);

            const cached = readContributorsCache();
            if (cached) {
                setContributors(cached.contributors);
                setContributorsUpdatedAt(cached.updatedAt);
                setContributorsLoading(false);
                return;
            }

            try {
                const combined = await fetchCombinedContributors();
                if (cancelled) {
                    return;
                }
                setContributors(combined.contributors);
                setContributorsUpdatedAt(combined.updatedAt);
                writeContributorsCache(combined);
            } catch (err) {
                if (cancelled) {
                    return;
                }
                setContributorsError(err instanceof Error ? err.message : 'Failed to load contributors.');
            } finally {
                if (!cancelled) {
                    setContributorsLoading(false);
                }
            }
        };

        loadContributors();

        return () => {
            cancelled = true;
        };
    }, []);

    const copyDonationAddress = (address: string) => {
        navigator.clipboard
            .writeText(address)
            .then(() => makeToast(t('global.label.copied_clipboard'), 'info'))
            .catch(defaultPromiseErrorHandler('About::copyDonationAddress'));
    };

    let content: ReactNode;

    if (loading) {
        content = <LoadingPlaceholder />;
    } else if (error || !data) {
        content = (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error ?? new Error('Missing about response'))}
                retry={() => refetch().catch(defaultPromiseErrorHandler('About::refetch'))}
            />
        );
    } else {
        const { aboutServer } = data;
        const selectedServerChannelInfo = serverUpdateCheckData?.checkForServerUpdates?.find(
            (channel) => channel.channel === aboutServer.buildType,
        );
        const isServerUpdateAvailable =
            !!selectedServerChannelInfo?.tag && selectedServerChannelInfo.tag !== aboutServer.version;

        content = (
            <Stack spacing={2.5}>
                <Paper
                    variant="outlined"
                    sx={{
                        p: 2.5,
                        borderRadius: 2,
                        background:
                            'linear-gradient(135deg, rgba(46, 204, 113, 0.12), rgba(52, 152, 219, 0.08))',
                    }}
                >
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        justifyContent="space-between"
                    >
                        <Box>
                            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: -0.4 }}>
                                Manatan
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                The seemless way to immerse in Anime, Manga, Lightnovels, and EPUBs with fast dictionary lookup and Anki workflows.
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                            <Chip label={`Server ${aboutServer.buildType}`} size="small" variant="outlined" />
                            <Chip label={`Version ${aboutServer.version}`} size="small" variant="outlined" />
                            <Chip
                                label={`Build ${dateFormatter.format(epochToDate(Number(aboutServer.buildTime)).toDate())}`}
                                size="small"
                                variant="outlined"
                            />
                        </Stack>
                    </Stack>
                </Paper>

                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
                            <Stack spacing={2}>
                                <Typography variant="h6">Support Manatan</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Donations help keep Manatan free and support development, hosting, and testing.
                                </Typography>
                                <List dense disablePadding>
                                    <ListItemLink
                                        to="https://ko-fi.com/manatancom"
                                        target="_blank"
                                        rel="noreferrer"
                                        sx={{ borderRadius: 1, px: 1, py: 0.75 }}
                                    >
                                        <ListItemText primary="Ko-fi" secondary="https://ko-fi.com/manatancom" />
                                    </ListItemLink>
                                </List>
                                <Divider />
                                <Stack spacing={1}>
                                    <Typography variant="subtitle2">Crypto</Typography>
                                    <List
                                        dense
                                        disablePadding
                                        sx={{ '& .MuiListItemText-secondary': { wordBreak: 'break-all' } }}
                                    >
                                        {DONATION_ADDRESSES.map((entry) => (
                                            <ListItem
                                                key={entry.key}
                                                disableGutters
                                                secondaryAction={
                                                    <IconButton
                                                        edge="end"
                                                        size="small"
                                                        aria-label={`Copy ${entry.ariaLabel} address`}
                                                        onClick={() => copyDonationAddress(entry.address)}
                                                    >
                                                        <ContentCopyIcon fontSize="small" />
                                                    </IconButton>
                                                }
                                                sx={{ py: 0.75, pr: 1.5 }}
                                            >
                                                <ListItemText primary={entry.label} secondary={entry.address} />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Stack>
                                <Divider />
                                <Stack spacing={1}>
                                    <Typography variant="subtitle2">Backer perks</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {MEMBERSHIP_PERKS.join(' · ')}
                                    </Typography>
                                </Stack>
                            </Stack>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
                            <Stack spacing={2}>
                                <Typography variant="h6">Contributors</Typography>
                                {contributorsLoading ? (
                                    <Typography variant="body2">Loading contributors...</Typography>
                                ) : contributorsError ? (
                                    <Typography variant="body2" color="error">
                                        Failed to load contributors. {contributorsError}
                                    </Typography>
                                ) : (
                                    <Typography component="div" variant="body2">
                                        {renderContributorInline(contributors)}
                                    </Typography>
                                )}
                                {contributorsUpdatedAt && (
                                    <Typography variant="caption" color="text.secondary">
                                        Updated {new Date(contributorsUpdatedAt).toLocaleDateString()}
                                    </Typography>
                                )}
                                <Typography variant="body2" color="text.secondary">
                                    Contributors who make meaningful contributions receive all backer perks.
                                </Typography>
                                <Divider />
                                <Stack spacing={1}>
                                    <Typography variant="h6">Backers</Typography>
                                    <Stack spacing={1}>
                                        {MEMBERSHIP_TIERS.map((tier) => (
                                            <Box
                                                key={tier.key}
                                                sx={{
                                                    p: 1.25,
                                                    borderRadius: 1.5,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    backgroundColor: 'action.hover',
                                                }}
                                            >
                                                <Typography variant="subtitle2">{tier.label}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {tier.backers.length ? tier.backers.join(', ') : 'No backers yet'}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Stack>
                                </Stack>
                            </Stack>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
                            <Stack spacing={2}>
                                <Typography variant="h6">{t('global.label.links')}</Typography>
                                <List dense disablePadding>
                                    <ListItemLink
                                        to="https://github.com/KolbyML/Manatan"
                                        target="_blank"
                                        rel="noreferrer"
                                        sx={{ borderRadius: 1, px: 1, py: 0.75 }}
                                    >
                                        <ListItemText
                                            primary="Manatan"
                                            secondary="https://github.com/KolbyML/Manatan"
                                        />
                                    </ListItemLink>
                                    <ListItemLink
                                        to="https://discord.gg/tDAtpPN8KK"
                                        target="_blank"
                                        rel="noreferrer"
                                        sx={{ borderRadius: 1, px: 1, py: 0.75 }}
                                    >
                                        <ListItemText
                                            primary="Manatan Discord"
                                            secondary="https://discord.gg/tDAtpPN8KK"
                                        />
                                    </ListItemLink>
                                    <ListItemLink
                                        to={aboutServer.github}
                                        target="_blank"
                                        rel="noreferrer"
                                        sx={{ borderRadius: 1, px: 1, py: 0.75 }}
                                    >
                                        <ListItemText primary="Suwayomi Server" secondary={aboutServer.github} />
                                    </ListItemLink>
                                </List>
                            </Stack>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
                            <Stack spacing={2}>
                                <Typography variant="h6">Build info</Typography>
                                <Stack
                                    direction={{ xs: 'column', md: 'row' }}
                                    spacing={2}
                                    divider={
                                        <Divider
                                            flexItem
                                            orientation="vertical"
                                            sx={{ display: { xs: 'none', md: 'block' } }}
                                        />
                                    }
                                >
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="subtitle2">{t('settings.server.title.server')}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {aboutServer.name} ({aboutServer.buildType})
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                            {t('settings.about.server.label.version')}
                                        </Typography>
                                        <VersionInfo
                                            version={aboutServer.version}
                                            isCheckingForUpdate={isCheckingForServerUpdate}
                                            isUpdateAvailable={isServerUpdateAvailable}
                                            updateCheckError={serverUpdateCheckError}
                                            checkForUpdate={checkForServerUpdate}
                                            downloadAsLink
                                            url={selectedServerChannelInfo?.url ?? ''}
                                        />
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                            {t('settings.about.server.label.build_time')}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {epochToDate(Number(aboutServer.buildTime)).toString()}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="subtitle2">{t('settings.webui.title.webui')}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('settings.about.webui.label.channel')}: BUNDLED
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                            {t('settings.about.webui.label.version')}
                                        </Typography>
                                        <WebUIVersionInfo />
                                    </Box>
                                </Stack>
                            </Stack>
                        </Paper>
                    </Grid>
                </Grid>
            </Stack>
        );
    }

    return <Box sx={{ px: { xs: 2, md: 3 }, py: 2 }}>{content}</Box>;
}
