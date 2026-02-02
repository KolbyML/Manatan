/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import FilterListIcon from '@mui/icons-material/FilterList';
import ListItemText from '@mui/material/ListItemText';
import ListItem from '@mui/material/ListItem';
import { useTranslation } from 'react-i18next';
import { Virtuoso } from 'react-virtuoso';
import Box from '@mui/material/Box';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { translateExtensionLanguage } from '@/features/extension/Extensions.utils.ts';
import { languageSortComparator, toUniqueLanguageCodes } from '@/base/utils/Languages.ts';
import {
    SourceDisplayNameInfo,
    SourceIconInfo,
    SourceIdInfo,
    SourceLanguageInfo,
    SourceMetaInfo,
    SourceNameInfo,
} from '@/features/source/Source.types.ts';
import { Sources } from '@/features/source/services/Sources';
import { getSourceMetadata, updateSourceMetadata } from '@/features/source/services/SourceMetadata.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { ListCardAvatar } from '@/base/components/lists/cards/ListCardAvatar.tsx';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';

export const SourceLanguageSelect = ({
    selectedLanguages,
    setSelectedLanguages,
    languages,
    sources,
}: {
    selectedLanguages: string[];
    setSelectedLanguages: (languages: string[]) => void;
    languages: string[];
    sources: (SourceIdInfo &
        SourceLanguageInfo &
        SourceNameInfo &
        SourceDisplayNameInfo &
        SourceIconInfo &
        SourceMetaInfo)[];
}) => {
    const { t } = useTranslation();

    const [tmpSourceIdToEnabledState, setTmpSourceIdToEnabledState] = useState<Record<SourceIdInfo['id'], boolean>>({});

    const [tmpSelectedLanguages, setTmpSelectedLanguages] = useState(toUniqueLanguageCodes(selectedLanguages));
    const [open, setOpen] = useState<boolean>(false);

    const sourcesByLanguage = useMemo(() => Sources.groupByLanguage(sources), [sources]);

    const languagesSortedBySelectState = useMemo(
        () =>
            toUniqueLanguageCodes([
                ...tmpSelectedLanguages.toSorted(languageSortComparator),
                ...languages.toSorted(languageSortComparator),
            ]),
        [languages, tmpSelectedLanguages],
    );

    const handleCancel = () => {
        setOpen(false);

        setTmpSourceIdToEnabledState({});
        setTmpSelectedLanguages(toUniqueLanguageCodes(selectedLanguages));
    };

    const handleOk = () => {
        setOpen(false);

        Promise.all(
            Object.entries(tmpSourceIdToEnabledState).map(([sourceId, enabled]) =>
                updateSourceMetadata(sources.find((source) => source.id === sourceId)!, 'isEnabled', enabled),
            ),
        ).catch((e) => makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)));
        setTmpSourceIdToEnabledState({});
        setSelectedLanguages(toUniqueLanguageCodes(tmpSelectedLanguages));
    };

    const handleChange = (language: string, selected: boolean) => {
        if (selected) {
            setTmpSelectedLanguages([...tmpSelectedLanguages, language]);
        } else {
            setTmpSelectedLanguages(tmpSelectedLanguages.toSpliced(tmpSelectedLanguages.indexOf(language), 1));
        }
    };

    return (
        <>
            <CustomTooltip title={t('settings.title')}>
                <IconButton onClick={() => setOpen(true)} aria-label="display more actions" edge="end" color="inherit">
                    <FilterListIcon />
                </IconButton>
            </CustomTooltip>
            <Dialog fullWidth maxWidth="xs" open={open} onClose={handleCancel}>
                <DialogTitle>{t('global.language.title.enabled_languages')}</DialogTitle>
                <DialogContent dividers sx={{ padding: 0 }}>
                    <Virtuoso
                        style={{
                            height: languagesSortedBySelectState.length * 54,
                            minHeight: '25vh',
                            maxHeight: '50vh',
                        }}
                        data={languagesSortedBySelectState}
                        increaseViewportBy={400}
                        computeItemKey={(index) => languagesSortedBySelectState[index]}
                        itemContent={(_index, language) => {
                            const sourcesOfLanguage = sourcesByLanguage[language] ?? [];
                            const isEnabled = tmpSelectedLanguages.includes(language);

                            return (
                                <>
                                    <ListItem>
                                        <ListItemText primary={translateExtensionLanguage(language)} />
                                        <Switch
                                            checked={isEnabled}
                                            onChange={(e) => handleChange(language, e.target.checked)}
                                        />
                                    </ListItem>
                                    {isEnabled && !!sourcesOfLanguage.length && (
                                        <Box sx={{ ml: 1 }}>
                                            {sourcesOfLanguage.map((source) => (
                                                <ListItem key={source.id}>
                                                    <ListItemAvatar sx={{ minWidth: 32, mr: 1 }}>
                                                        <ListCardAvatar
                                                            iconUrl={requestManager.getValidImgUrlFor(source.iconUrl)}
                                                            alt={source.name}
                                                            slots={{
                                                                avatarProps: {
                                                                    sx: {
                                                                        width: 32,
                                                                        height: 32,
                                                                    },
                                                                },
                                                                spinnerImageProps: {
                                                                    ignoreQueue: true,
                                                                },
                                                            }}
                                                        />
                                                    </ListItemAvatar>
                                                    <ListItemText primary={source.name} />
                                                    <Switch
                                                        checked={
                                                            tmpSourceIdToEnabledState[source.id] ??
                                                            getSourceMetadata(source).isEnabled
                                                        }
                                                        onChange={(e) =>
                                                            setTmpSourceIdToEnabledState({
                                                                ...tmpSourceIdToEnabledState,
                                                                [source.id]: e.target.checked,
                                                            })
                                                        }
                                                    />
                                                </ListItem>
                                            ))}
                                        </Box>
                                    )}
                                </>
                            );
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button autoFocus onClick={handleCancel} color="primary">
                        {t('global.button.cancel')}
                    </Button>
                    <Button onClick={handleOk} color="primary">
                        {t('global.button.ok')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};
