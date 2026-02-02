/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import FilterListIcon from '@mui/icons-material/FilterList';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import IconButton from '@mui/material/IconButton';
import SaveIcon from '@mui/icons-material/Save';
import Chip from '@mui/material/Chip';
import DeleteIcon from '@mui/icons-material/Delete';
import Typography from '@mui/material/Typography';
import PopupState, { bindDialog, bindTrigger } from 'material-ui-popup-state';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TextField from '@mui/material/TextField';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { OptionsPanel } from '@/base/components/modals/OptionsPanel.tsx';
import { CheckBoxFilter } from '@/features/source/browse/components/filters/CheckBoxFilter.tsx';
import { HeaderFilter } from '@/features/source/browse/components/filters/HeaderFilter.tsx';
import { SelectFilter } from '@/features/source/browse/components/filters/SelectFilter.tsx';
import { SortFilter } from '@/features/source/browse/components/filters/SortFilter.tsx';
import { TextFilter } from '@/features/source/browse/components/filters/TextFilter.tsx';
import { TriStateFilter } from '@/features/source/browse/components/filters/TriStateFilter.tsx';
// this can only cycle once, so should be fine
// eslint-disable-next-line import/no-cycle
import { GroupFilter } from '@/features/source/browse/components/filters/GroupFilter.tsx';
import { SeparatorFilter } from '@/features/source/browse/components/filters/SeparatorFilter.tsx';
import { StyledFab } from '@/base/components/buttons/StyledFab.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { ISourceMetadata, SourceFilters } from '@/features/source/Source.types.ts';
import { Confirmation } from '@/base/AppAwaitableComponent.ts';

interface IFilters {
    sourceFilter: SourceFilters[];
    updateFilterValue: Function;
    group: number | undefined;
    update: any;
}

interface IFilters1 {
    savedSearches: ISourceMetadata['savedSearches'];
    selectSavedSearch: (savedSearch: string) => void;
    updateSavedSearches: (savedSearch: string, updateType: 'create' | 'delete') => void;
    sourceFilter: SourceFilters[];
    updateFilterValue: Function;
    resetFilterValue: Function;
    setTriggerUpdate: Function;
    update: any;
}

export function Options({ sourceFilter, group, updateFilterValue, update }: IFilters) {
    return (
        <Stack key={`filters ${group}`}>
            {sourceFilter.map((e, index) => {
                let checkif = update.find(
                    (el: { group: number | undefined; position: number }) =>
                        el.group === group && el.position === index,
                );
                checkif = checkif ? checkif.state : checkif;
                switch (e.type) {
                    case 'CheckBoxFilter':
                        return (
                            <CheckBoxFilter
                                key={`filters ${e.name}`}
                                name={e.name}
                                state={checkif ?? e.CheckBoxFilterDefault}
                                position={index}
                                group={group}
                                updateFilterValue={updateFilterValue}
                                update={update}
                            />
                        );
                    case 'GroupFilter':
                        return (
                            <GroupFilter
                                key={`filters ${e.name}`}
                                name={e.name}
                                state={e.filters}
                                position={index}
                                updateFilterValue={updateFilterValue}
                                update={update}
                            />
                        );
                    case 'HeaderFilter':
                        return <HeaderFilter key={`filters ${e.name}`} name={e.name} />;
                    case 'SelectFilter':
                        return (
                            <SelectFilter
                                key={`filters ${e.name}`}
                                name={e.name}
                                values={e.values}
                                state={checkif != null ? parseInt(checkif, 10) : e.SelectFilterDefault}
                                position={index}
                                group={group}
                                updateFilterValue={updateFilterValue}
                                update={update}
                            />
                        );
                    case 'SeparatorFilter':
                        return <SeparatorFilter key={`filters ${e.name}`} name={e.name} />;
                    case 'SortFilter':
                        return (
                            <SortFilter
                                key={`filters ${e.name}`}
                                name={e.name}
                                values={e.values}
                                state={
                                    checkif ?? {
                                        ascending: e.SortFilterDefault?.ascending,
                                        index: e.SortFilterDefault?.index,
                                    }
                                }
                                position={index}
                                group={group}
                                updateFilterValue={updateFilterValue}
                                update={update}
                            />
                        );
                    case 'TextFilter':
                        return (
                            <TextFilter
                                key={`filters ${e.name}`}
                                name={e.name}
                                state={checkif ?? e.TextFilterDefault}
                                position={index}
                                group={group}
                                updateFilterValue={updateFilterValue}
                                update={update}
                            />
                        );
                    case 'TriStateFilter':
                        return (
                            <TriStateFilter
                                key={`filters ${e.name}`}
                                name={e.name}
                                state={checkif != null ? checkif : e.TriStateFilterDefault}
                                position={index}
                                group={group}
                                updateFilterValue={updateFilterValue}
                                update={update}
                            />
                        );
                    default:
                        throw new Error(`Unknown source filter "${e}"`);
                }
            })}
        </Stack>
    );
}

export function SourceOptions({
    savedSearches = {},
    selectSavedSearch,
    updateSavedSearches,
    sourceFilter,
    updateFilterValue,
    resetFilterValue,
    setTriggerUpdate,
    update,
}: IFilters1) {
    const { t } = useTranslation();
    const [FilterOptions, setFilterOptions] = useState(false);
    const [newSavedSearch, setNewSavedSearch] = useState('');

    const savedSearchNames = Object.keys(savedSearches);
    const savedSearchesExist = !!savedSearchNames.length;

    function handleReset() {
        resetFilterValue(0);
        setFilterOptions(false);
    }

    function handleSubmit() {
        setTriggerUpdate(0);
        setFilterOptions(false);
    }

    return (
        <>
            <StyledFab onClick={() => setFilterOptions(!FilterOptions)} variant="extended" color="primary">
                <FilterListIcon />
                {t('global.button.filter')}
            </StyledFab>

            <OptionsPanel open={FilterOptions} onClose={() => setFilterOptions(false)}>
                <Box sx={{ p: 2, pb: savedSearchesExist ? undefined : 0 }}>
                    <Box sx={{ display: 'flex', pb: 1 }}>
                        <Button onClick={handleReset}>{t('global.button.reset')}</Button>
                        <PopupState variant="dialog" popupId="source-browse-save-search">
                            {(popupState) => (
                                <>
                                    <CustomTooltip title={t('source.filter.save_search.label.save')}>
                                        <IconButton sx={{ marginLeft: 'auto' }} {...bindTrigger(popupState)}>
                                            <SaveIcon />
                                        </IconButton>
                                    </CustomTooltip>
                                    <Dialog {...bindDialog(popupState)} maxWidth="xs" fullWidth>
                                        <DialogTitle>{t('source.filter.save_search.dialog.label.title')}</DialogTitle>
                                        <DialogContent>
                                            <TextField
                                                sx={{ width: '100%' }}
                                                value={newSavedSearch}
                                                onChange={(e) => setNewSavedSearch(e.target.value as string)}
                                                slotProps={{
                                                    htmlInput: { maxLength: 50 },
                                                }}
                                            />
                                        </DialogContent>
                                        <DialogActions>
                                            <Button
                                                onClick={() => {
                                                    setNewSavedSearch('');
                                                    popupState.close();
                                                }}
                                            >
                                                {t('global.button.cancel')}
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    updateSavedSearches(newSavedSearch, 'create');
                                                    setNewSavedSearch('');
                                                    popupState.close();
                                                }}
                                            >
                                                {t('global.button.ok')}
                                            </Button>
                                        </DialogActions>
                                    </Dialog>
                                </>
                            )}
                        </PopupState>

                        <Button variant="contained" onClick={handleSubmit}>
                            {t('global.button.submit')}
                        </Button>
                    </Box>
                    {savedSearchesExist && (
                        <>
                            <Typography sx={{ pb: 1 }}>Saved searches</Typography>
                            <Stack sx={{ flexDirection: 'row' }}>
                                {savedSearchNames.map((savedSearch) => (
                                    <Chip
                                        label={savedSearch}
                                        onClick={() => {
                                            setFilterOptions(false);
                                            selectSavedSearch(savedSearch);
                                        }}
                                        onDelete={() => {
                                            Confirmation.show({
                                                title: t('global.label.are_you_sure'),
                                                message: t('source.filter.save_search.dialog.label.delete', {
                                                    name: savedSearch,
                                                }),
                                                actions: {
                                                    confirm: { title: t('global.button.delete') },
                                                },
                                            })
                                                .then(() => updateSavedSearches(savedSearch, 'delete'))
                                                .catch(defaultPromiseErrorHandler('SourceOptions::deleteSavedSearch'));
                                        }}
                                        deleteIcon={
                                            <CustomTooltip title={t('source.filter.save_search.label.delete')}>
                                                <DeleteIcon />
                                            </CustomTooltip>
                                        }
                                        variant="outlined"
                                    />
                                ))}
                            </Stack>
                        </>
                    )}
                </Box>
                <Box
                    sx={{
                        pb: 2,
                        mx: 2,
                    }}
                >
                    <Options
                        sourceFilter={sourceFilter}
                        updateFilterValue={updateFilterValue}
                        group={undefined}
                        update={update}
                    />
                </Box>
            </OptionsPanel>
        </>
    );
}
