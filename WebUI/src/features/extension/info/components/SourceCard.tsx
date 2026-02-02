/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import SettingsIcon from '@mui/icons-material/Settings';
import Switch from '@mui/material/Switch';
import CardActionArea from '@mui/material/CardActionArea';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { Sources } from '@/features/source/services/Sources.ts';
import { translateExtensionLanguage } from '@/features/extension/Extensions.utils.ts';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent.tsx';
import { StyledGroupItemWrapper } from '@/base/components/virtuoso/StyledGroupItemWrapper.tsx';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { createUpdateSourceMetadata, useGetSourceMetadata } from '@/features/source/services/SourceMetadata.ts';
import { SourceConfigurableInfo, SourceIdInfo, SourceLanguageInfo } from '@/features/source/Source.types.ts';

export const SourceCard = (source: SourceIdInfo & SourceLanguageInfo & SourceConfigurableInfo) => {
    const { id, isConfigurable } = source;

    const { t } = useTranslation();
    const { isEnabled } = useGetSourceMetadata(source);

    const updateSetting = createUpdateSourceMetadata(source, (e) =>
        makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
    );

    return (
        <StyledGroupItemWrapper key={id} sx={{ px: 0 }}>
            <Card>
                <CardActionArea onClick={() => updateSetting('isEnabled', !isEnabled)}>
                    <ListCardContent>
                        <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
                            {translateExtensionLanguage(Sources.getLanguage(source))}
                        </Typography>
                        {isConfigurable && (
                            <CustomTooltip title={t('settings.title')}>
                                <IconButton
                                    component={Link}
                                    to={AppRoutes.sources.childRoutes.configure.path(id)}
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
