/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import SettingsIcon from '@mui/icons-material/Settings';
import Switch from '@mui/material/Switch';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import { useTranslation } from 'react-i18next';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';

import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { languageSortComparator } from '@/base/utils/Languages.ts';
import { assertIsDefined } from '@/base/Asserts.ts';
import { Sources } from '@/features/source/services/Sources.ts';
import { Meta } from '@/features/extension/info/components/Meta.tsx';
import { SpinnerImage } from '@/base/components/SpinnerImage.tsx';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { createUpdateSourceMetadata, useGetSourceMetadata } from '@/features/source/services/SourceMetadata.ts';
import { translateExtensionLanguage } from '@/features/extension/Extensions.utils.ts';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent.tsx';
import { StyledGroupItemWrapper } from '@/base/components/virtuoso/StyledGroupItemWrapper.tsx';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { UrlUtil } from '@/lib/UrlUtil.ts';

type ExtensionLike = {
    name: string;
    pkgName: string;
    iconUrl: string;
    repo: string | null;
    versionName: string;
    lang: string;
    isNsfw: boolean;
    isInstalled: boolean;
    hasUpdate: boolean;
    isObsolete: boolean;
};

type AnimeSourceLike = {
    id: string;
    lang: string;
    isConfigurable: boolean;
    isNsfw: boolean;
    displayName: string;
    meta: any[];
    extension: {
        pkgName: string;
        repo: string;
    };
};

const normalizePkg = (pkgName: string) =>
    pkgName
        .replace('eu.kanade.tachiyomi.extension.', '')
        .replace('eu.kanade.tachiyomi.animeextension.', '');

const AnimeExtensionHeader = ({ name, pkgName, iconUrl, repo }: ExtensionLike) => (
    <Stack sx={{ alignItems: 'center' }}>
        <SpinnerImage alt={name} src={requestManager.getValidImgUrlFor(iconUrl)} ignoreQueue />
        <Typography variant="h5" component="h2">
            {name}
        </Typography>
        <Typography variant="body2" color="textSecondary">
            {normalizePkg(pkgName)}
        </Typography>
        {repo && (
            <Typography variant="body2" color="textSecondary">
                {repo}
            </Typography>
        )}
    </Stack>
);

const AnimeExtensionActionButton = (extension: ExtensionLike) => {
    const { t } = useTranslation();
    const { pkgName, isInstalled, hasUpdate, isObsolete } = extension;

    if (!isInstalled) {
        return null;
    }

    const action = hasUpdate && !isObsolete ? 'update' : 'uninstall';
    const labelKey = action === 'update' ? 'extension.action.label.update' : 'extension.action.label.uninstall';

    return (
        <Box sx={{ px: 1, flexGrow: 1, flexBasis: 0 }}>
            <Button
                sx={{ width: '100%', color: isObsolete ? 'red' : 'inherit' }}
                variant="outlined"
                size="large"
                onClick={async () => {
                    try {
                        await requestManager.updateAnimeExtension(pkgName, action === 'update' ? { update: true } : { uninstall: true })
                            .response;
                    } catch (e) {
                        defaultPromiseErrorHandler('AnimeExtensionInfo::ActionButton::onClick');
                    }
                }}
            >
                {t(labelKey as any)}
            </Button>
        </Box>
    );
};

const AnimeExtensionSourceCard = (source: AnimeSourceLike) => {
    const { id, isConfigurable } = source;
    const { t } = useTranslation();
    const location = useLocation();
    const { isEnabled } = useGetSourceMetadata(source as any);

    const updateSetting = createUpdateSourceMetadata(source as any, (e) =>
        makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
    );

    return (
        <StyledGroupItemWrapper key={id} sx={{ px: 0 }}>
            <Card>
                <CardActionArea onClick={() => updateSetting('isEnabled' as any, !isEnabled)}>
                    <ListCardContent>
                        <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
                            {translateExtensionLanguage(Sources.getLanguage(source as any))}
                        </Typography>
                        {isConfigurable && (
                            <CustomTooltip title={t('settings.title')}>
                                <IconButton
                                    component={Link}
                                    to={UrlUtil.addParams(AppRoutes.animeSources.childRoutes.configure.path(id), {
                                        back: `${location.pathname}${location.search}`,
                                    })}
                                    color="inherit"
                                    onClick={(e) => e.stopPropagation()}
                                    {...MUIUtil.preventRippleProp()}
                                >
                                    <SettingsIcon />
                                </IconButton>
                            </CustomTooltip>
                        )}
                        <Switch checked={isEnabled} />
                    </ListCardContent>
                </CardActionArea>
            </Card>
        </StyledGroupItemWrapper>
    );
};

export const AnimeExtensionInfo = () => {
    const { t } = useTranslation();
    const { pkgName } = useParams<{ pkgName: string }>();
    useAppTitle(t('source.extension_info.title'));

    const extensionResponse = requestManager.useGetAnimeExtension(pkgName ?? '');
    const sourcesResponse = requestManager.useGetAnimeSourceList();

    const { extension } = (extensionResponse.data ?? {}) as any;
    const sources = useMemo(() => {
        const nodes = sourcesResponse.data?.animeSources?.nodes ?? [];
        if (!extension?.pkgName) {
            return [];
        }
        return (nodes as AnimeSourceLike[])
            .filter((source) => source.extension?.pkgName === extension.pkgName)
            .sort((a, b) => languageSortComparator(Sources.getLanguage(a as any), Sources.getLanguage(b as any)));
    }, [extension?.pkgName, sourcesResponse.data]);

    const isLoading = extensionResponse.loading || sourcesResponse.loading;
    const error = extensionResponse.error || sourcesResponse.error;

    if (isLoading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(extensionResponse.error)}
                retry={() => {
                    if (extensionResponse.error) {
                        extensionResponse
                            .refetch()
                            .catch(defaultPromiseErrorHandler('AnimeExtensionInfo::extension::refetch'));
                    }
                    if (sourcesResponse.error) {
                        sourcesResponse.refetch().catch(defaultPromiseErrorHandler('AnimeExtensionInfo::sources::refetch'));
                    }
                }}
            />
        );
    }

    assertIsDefined(extension);

    return (
        <Stack sx={{ gap: 2 }}>
            <AnimeExtensionHeader {...(extension as ExtensionLike)} />
            <Meta {...(extension as any)} />
            <Stack sx={{ flexDirection: 'row' }}>
                <AnimeExtensionActionButton {...(extension as ExtensionLike)} />
            </Stack>
            <Box sx={{ px: 1 }}>
                {sources.map((source) => (
                    <AnimeExtensionSourceCard key={source.id} {...(source as any)} />
                ))}
            </Box>
        </Stack>
    );
};
