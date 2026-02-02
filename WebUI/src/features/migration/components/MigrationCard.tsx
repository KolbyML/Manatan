/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { GetMigratableSourcesQuery } from '@/lib/graphql/generated/graphql.ts';
import { translateExtensionLanguage } from '@/features/extension/Extensions.utils.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { ListCardAvatar } from '@/base/components/lists/cards/ListCardAvatar.tsx';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent.tsx';

export type TMigratableSource = NonNullable<GetMigratableSourcesQuery['mangas']['nodes'][number]['source']> & {
    mangaCount: number;
};

// TODO - cleanup source/extension components
export const MigrationCard = ({ id, name, lang, iconUrl, mangaCount }: TMigratableSource) => {
    const { t } = useTranslation();

    const isLocalSource = Number(id) === 0;
    const sourceName = isLocalSource ? t('source.local_source.title') : name;

    return (
        <Card>
            <CardActionArea component={Link} to={AppRoutes.migrate.path(id)}>
                <ListCardContent sx={{ justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <ListCardAvatar
                            iconUrl={requestManager.getValidImgUrlFor(iconUrl)}
                            alt={sourceName}
                            slots={{
                                spinnerImageProps: {
                                    ignoreQueue: true,
                                },
                            }}
                        />
                        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="h6" component="h3">
                                {sourceName}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{
                                    display: 'block',
                                }}
                            >
                                {translateExtensionLanguage(lang)}
                            </Typography>
                        </Box>
                    </Box>
                    <Chip sx={{ borderRadius: 1 }} size="small" label={mangaCount} />
                </ListCardContent>
            </CardActionArea>
        </Card>
    );
};
