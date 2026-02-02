/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useMemo, useState } from 'react';
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
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { translateExtensionLanguage } from '@/features/extension/Extensions.utils.ts';
import { languageSortComparator, toUniqueLanguageCodes } from '@/base/utils/Languages.ts';

interface IProps {
    selectedLanguages: string[];
    setSelectedLanguages: (languages: string[]) => void;
    languages: string[];
}

export function LanguageSelect(props: IProps) {
    const { t } = useTranslation();

    const { selectedLanguages, setSelectedLanguages, languages } = props;
    const [tmpSelectedLanguages, setTmpSelectedLanguages] = useState(toUniqueLanguageCodes(selectedLanguages));
    const [open, setOpen] = useState<boolean>(false);

    useEffect(() => {
        if (!open) {
            setTmpSelectedLanguages(toUniqueLanguageCodes(selectedLanguages));
        }
    }, [open, selectedLanguages]);

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
        setTmpSelectedLanguages(toUniqueLanguageCodes(selectedLanguages));
    };

    const handleOk = () => {
        setOpen(false);
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
                        itemContent={(_index, language) => (
                            <ListItem>
                                <ListItemText primary={translateExtensionLanguage(language)} />

                                <Switch
                                    checked={tmpSelectedLanguages.includes(language)}
                                    onChange={(e) => handleChange(language, e.target.checked)}
                                />
                            </ListItem>
                        )}
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
}
