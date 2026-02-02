/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Checkbox from '@mui/material/Checkbox';
import { useTranslation } from 'react-i18next';
import ClearIcon from '@mui/icons-material/Clear';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { SelectableCollectionSelectAll } from '@/base/collection/components/SelectableCollectionSelectAll.tsx';

export const SelectableCollectionSelectMode = ({
    isActive,
    areAllItemsSelected,
    areNoItemsSelected,
    onSelectAll,
    onModeChange,
}: {
    isActive: boolean;
    areAllItemsSelected: boolean;
    areNoItemsSelected: boolean;
    onSelectAll: (selectAll: boolean) => void;
    onModeChange: (checked: boolean) => void;
}) => {
    const { t } = useTranslation();

    return (
        <>
            {isActive && (
                <SelectableCollectionSelectAll
                    areAllItemsSelected={areAllItemsSelected}
                    areNoItemsSelected={areNoItemsSelected}
                    onChange={onSelectAll}
                />
            )}
            <CustomTooltip title={t(!isActive ? 'global.button.select_all' : 'global.button.cancel')}>
                <Checkbox
                    checkedIcon={<ClearIcon />}
                    sx={{
                        padding: '8px',
                        color: 'inherit',
                        '&.Mui-checked': {
                            color: 'inherit',
                        },
                    }}
                    checked={isActive}
                    onChange={(_, checked) => onModeChange(checked)}
                />
            </CustomTooltip>
        </>
    );
};
