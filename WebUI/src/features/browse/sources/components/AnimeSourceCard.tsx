/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import { Link, useNavigate } from 'react-router-dom';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { ListCardAvatar } from '@/base/components/lists/cards/ListCardAvatar.tsx';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent.tsx';
import { languageCodeToName } from '@/base/utils/Languages.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { AnimeSourceContentType } from '@/features/anime/browse/screens/AnimeSourceBrowse.tsx';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { useTranslation } from 'react-i18next';
import { createUpdateSourceMetadata, useGetSourceMetadata } from '@/features/source/services/SourceMetadata.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { Sources } from '@/features/source/services/Sources.ts';

export type AnimeSourceInfo = {
    id: string;
    name: string;
    lang: string;
    iconUrl: string;
    supportsLatest: boolean;
    isConfigurable: boolean;
    isNsfw: boolean;
    displayName: string;
    baseUrl?: string | null;
    extension?: { repo?: string | null } | null;
    meta: Array<{ sourceId: string; key: string; value: string }>;
};

export const AnimeSourceCard = ({
    source,
    showSourceRepo,
    showLanguage,
    onMetaUpdated,
}: {
    source: AnimeSourceInfo;
    showSourceRepo: boolean;
    showLanguage: boolean;
    onMetaUpdated?: () => void;
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { name, lang, iconUrl, isNsfw, supportsLatest, extension } = source;
    const { isPinned } = useGetSourceMetadata(source);
    const sourceName = Sources.isLocalSource(source) ? t('source.local_source.title') : name;
    const updateSetting = createUpdateSourceMetadata(source, (e) =>
        makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
    );

    return (
        <Card>
            <CardActionArea
                component={Link}
                to={AppRoutes.animeSources.childRoutes.browse.path(source.id)}
                state={{ contentType: AnimeSourceContentType.POPULAR, clearCache: true }}
            >
                <ListCardContent>
                    <ListCardAvatar
                        iconUrl={requestManager.getValidImgUrlFor(iconUrl)}
                        alt={sourceName}
                        slots={{
                            spinnerImageProps: {
                                ignoreQueue: true,
                            },
                        }}
                    />
                    <Stack
                        sx={{
                            justifyContent: 'center',
                            flexGrow: 1,
                            flexShrink: 1,
                            wordBreak: 'break-word',
                        }}
                    >
                        <Typography variant="h6" component="h3">
                            {sourceName}
                        </Typography>
                        <Typography variant="caption">
                            {showLanguage && languageCodeToName(lang)}
                            {isNsfw && (
                                <Typography variant="caption" color="error">
                                    {' 18+'}
                                </Typography>
                            )}
                        </Typography>
                        {showSourceRepo && extension?.repo && <Typography variant="caption">{extension.repo}</Typography>}
                    </Stack>
                    {supportsLatest && (
                        <Button
                            {...MUIUtil.preventRippleProp()}
                            variant="outlined"
                            onClick={(event) => {
                                event.preventDefault();
                                navigate(AppRoutes.animeSources.childRoutes.browse.path(source.id), {
                                    state: { contentType: AnimeSourceContentType.LATEST, clearCache: true },
                                });
                            }}
                        >
                            {t('global.button.latest')}
                        </Button>
                    )}
                    <CustomTooltip title={t(isPinned ? 'source.pin.remove' : 'source.pin.add')}>
                        <IconButton
                            {...MUIUtil.preventRippleProp()}
                            onClick={(event) => {
                                event.preventDefault();
                                updateSetting('isPinned', !isPinned).then(() => onMetaUpdated?.());
                            }}
                            color={isPinned ? 'primary' : 'inherit'}
                        >
                            {isPinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
                        </IconButton>
                    </CustomTooltip>
                </ListCardContent>
            </CardActionArea>
        </Card>
    );
};
