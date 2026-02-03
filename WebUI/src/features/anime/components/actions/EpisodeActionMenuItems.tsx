/*
 * Copyright (C) Contributors to the Manatan project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import Delete from '@mui/icons-material/Delete';
import Download from '@mui/icons-material/Download';
import Done from '@mui/icons-material/Done';
import RemoveDone from '@mui/icons-material/RemoveDone';
import DoneAll from '@mui/icons-material/DoneAll';
import { useTranslation } from 'react-i18next';
import { MenuItem } from '@/base/components/menu/MenuItem.tsx';
import { IconWebView } from '@/assets/icons/IconWebView.tsx';
import { IconBrowser } from '@/assets/icons/IconBrowser.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';

type Episode = {
    id: number;
    isRead: boolean;
    isDownloaded: boolean;
    realUrl?: string | null;
};

type Props = {
    episode: Episode;
    onClose: () => void;
    onSelect: () => void;
    onDownload: () => void;
    onDeleteDownload: () => void;
    onMarkWatched: () => void;
    onMarkUnwatched: () => void;
    onMarkPreviousWatched: () => void;
};

export const EpisodeActionMenuItems = ({
    episode,
    onClose,
    onSelect,
    onDownload,
    onDeleteDownload,
    onMarkWatched,
    onMarkUnwatched,
    onMarkPreviousWatched,
}: Props) => {
    const { t } = useTranslation();

    return (
        <>
            <MenuItem
                onClick={() => {
                    onSelect();
                    onClose();
                }}
                Icon={CheckBoxOutlineBlank}
                title={t('chapter.action.label.select')}
            />
            <MenuItem
                Icon={IconBrowser}
                disabled={!episode.realUrl}
                onClick={() => {
                    if (episode.realUrl) {
                        window.open(episode.realUrl, '_blank', 'noopener,noreferrer');
                    }
                    onClose();
                }}
                title={t('global.button.open_browser')}
            />
            <MenuItem
                Icon={IconWebView}
                disabled={!episode.realUrl}
                onClick={() => {
                    if (episode.realUrl) {
                        window.open(requestManager.getWebviewUrl(episode.realUrl), '_blank', 'noopener,noreferrer');
                    }
                    onClose();
                }}
                title={t('global.button.open_webview')}
            />
            {!episode.isDownloaded && (
                <MenuItem
                    Icon={Download}
                    onClick={() => {
                        onDownload();
                        onClose();
                    }}
                    title={t('global.button.download')}
                />
            )}
            {episode.isDownloaded && (
                <MenuItem
                    Icon={Delete}
                    onClick={() => {
                        onDeleteDownload();
                        onClose();
                    }}
                    title={t('chapter.action.label.delete' as any)}
                />
            )}
            {!episode.isRead && (
                <MenuItem
                    Icon={Done}
                    onClick={() => {
                        onMarkWatched();
                        onClose();
                    }}
                    title="Mark as watched"
                />
            )}
            {episode.isRead && (
                <MenuItem
                    Icon={RemoveDone}
                    onClick={() => {
                        onMarkUnwatched();
                        onClose();
                    }}
                    title="Mark as unwatched"
                />
            )}
            <MenuItem
                Icon={DoneAll}
                onClick={() => {
                    onMarkPreviousWatched();
                    onClose();
                }}
                title="Mark previous as watched"
            />
        </>
    );
};
