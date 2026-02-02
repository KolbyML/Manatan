/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import CardActionArea from '@mui/material/CardActionArea';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import Stack from '@mui/material/Stack';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import IconButton from '@mui/material/IconButton';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { SourceContentType } from '@/features/source/browse/screens/SourceMangas.tsx';
import { GetSourcesListQuery } from '@/lib/graphql/generated/graphql.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';
import { Sources } from '@/features/source/services/Sources.ts';
import { ListCardAvatar } from '@/base/components/lists/cards/ListCardAvatar.tsx';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent.tsx';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { createUpdateSourceMetadata, useGetSourceMetadata } from '@/features/source/services/SourceMetadata.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { languageCodeToName } from '@/base/utils/Languages.ts';

interface IProps {
    source: GetSourcesListQuery['sources']['nodes'][number];
    showSourceRepo: boolean;
    showLanguage: boolean;
}

export const SourceCard: React.FC<IProps> = (props: IProps) => {
    const { t } = useTranslation();

    const { source, showSourceRepo, showLanguage } = props;
    const {
        id,
        name,
        lang,
        iconUrl,
        supportsLatest,
        isNsfw,
        extension: { repo },
    } = source;

    const { isPinned } = useGetSourceMetadata(source);
    const navigate = useNavigate();

    const sourceName = Sources.isLocalSource(source) ? t('source.local_source.title') : name;

    const updateSetting = createUpdateSourceMetadata(source, (e) =>
        makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
    );

    return (
        <Card>
            <CardActionArea
                component={Link}
                to={AppRoutes.sources.childRoutes.browse.path(id)}
                state={{ contentType: SourceContentType.POPULAR, clearCache: true }}
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
                        {showSourceRepo && <Typography variant="caption">{repo}</Typography>}
                    </Stack>
                    {supportsLatest && (
                        <Button
                            {...MUIUtil.preventRippleProp()}
                            variant="outlined"
                            onClick={(event) => {
                                event.preventDefault();
                                navigate(AppRoutes.sources.childRoutes.browse.path(id), {
                                    state: { contentType: SourceContentType.LATEST, clearCache: true },
                                });
                            }}
                        >
                            {t('global.button.latest')}
                        </Button>
                    )}
                    <CustomTooltip title={t(isPinned ? 'source.pin.remove' : 'source.pin.add')}>
                        <IconButton
                            {...MUIUtil.preventRippleProp()}
                            onClick={(e) => {
                                e.preventDefault();
                                updateSetting('isPinned', !isPinned);
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
