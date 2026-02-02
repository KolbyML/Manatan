/*
 * Copyright (C) Contributors to the Manatan project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import Done from '@mui/icons-material/Done';
import RemoveDone from '@mui/icons-material/RemoveDone';
import SyncIcon from '@mui/icons-material/Sync';
import { useTranslation } from 'react-i18next';
import { MenuItem } from '@/base/components/menu/MenuItem.tsx';
import { IconWebView } from '@/assets/icons/IconWebView.tsx';
import { IconBrowser } from '@/assets/icons/IconBrowser.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { HttpMethod } from '@/lib/requests/client/RestClient.ts';

type AnimeMenuEntry = {
    id: number;
    title: string;
    url?: string | null;
    inLibrary?: boolean;
};

type Props = {
    anime: AnimeMenuEntry;
    onClose: () => void;
    onLibraryChange?: (inLibrary: boolean) => void;
};

export const AnimeActionMenuItems = ({ anime, onClose, onLibraryChange }: Props) => {
    const { t } = useTranslation();
    const isInLibrary = !!anime.inLibrary;

    const handleToggleLibrary = async () => {
        const nextState = !isInLibrary;
        await requestManager.updateAnime(anime.id, { inLibrary: nextState }).response;
        onLibraryChange?.(nextState);
    };

    const handleUpdate = async () => {
        await Promise.all([
            requestManager.getClient().fetcher(`/api/v1/anime/${anime.id}?onlineFetch=true`),
            requestManager.getClient().fetcher(`/api/v1/anime/${anime.id}/episodes?onlineFetch=true`),
        ]);
    };

    const handleMarkAll = async (isRead: boolean) => {
        const response = await requestManager.getClient().fetcher(`/api/v1/anime/${anime.id}/episodes`);
        const episodes = (await response.json()) as Array<{ id: number }>;
        if (!episodes.length) {
            return;
        }

        await requestManager.getClient().fetcher('/api/v1/anime/episode/batch', {
            httpMethod: HttpMethod.POST,
            data: {
                episodeIds: episodes.map((episode) => episode.id),
                change: { isRead },
            },
            checkResponseIsJson: false,
        });
    };

    return (
        <>
            {anime.url && (
                <>
                    <MenuItem
                        Icon={IconBrowser}
                        onClick={() => {
                            window.open(anime.url!, '_blank', 'noopener,noreferrer');
                            onClose();
                        }}
                        title={t('global.button.open_browser')}
                    />
                    <MenuItem
                        Icon={IconWebView}
                        onClick={() => {
                            window.open(requestManager.getWebviewUrl(anime.url!), '_blank', 'noopener,noreferrer');
                            onClose();
                        }}
                        title={t('global.button.open_webview')}
                    />
                </>
            )}
            <MenuItem
                Icon={SyncIcon}
                onClick={async () => {
                    await handleUpdate();
                    onClose();
                }}
                title={t('global.button.refresh')}
            />
            <MenuItem
                Icon={Done}
                onClick={async () => {
                    await handleMarkAll(true);
                    onClose();
                }}
                title="Mark all as watched"
            />
            <MenuItem
                Icon={RemoveDone}
                onClick={async () => {
                    await handleMarkAll(false);
                    onClose();
                }}
                title="Mark all as unwatched"
            />
            <MenuItem
                Icon={isInLibrary ? FavoriteIcon : FavoriteBorderIcon}
                onClick={async () => {
                    await handleToggleLibrary();
                    onClose();
                }}
                title={isInLibrary ? t('manga.action.library.remove.label.action') : t('manga.button.add_to_library')}
            />
        </>
    );
};
