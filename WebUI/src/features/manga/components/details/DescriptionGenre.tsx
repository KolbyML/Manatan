/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useMemo, useState } from 'react';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { useResizeObserver } from '@/base/hooks/useResizeObserver.tsx';
import {
    MangaDescriptionInfo,
    MangaGenreInfo,
    MangaLocationState,
    MangaSourceIdInfo,
} from '@/features/manga/Manga.types.ts';
import { SearchLink } from '@/features/manga/components/details/SearchLink.tsx';

const OPEN_CLOSE_BUTTON_HEIGHT = '35px';
const DESCRIPTION_COLLAPSED_SIZE = 75;

export const DescriptionGenre = ({
    manga: { description, genre: mangaGenres, sourceId },
    mode,
}: {
    manga: MangaDescriptionInfo & MangaGenreInfo & MangaSourceIdInfo;
    mode: MangaLocationState['mode'];
}) => {
    const [descriptionElement, setDescriptionElement] = useState<HTMLSpanElement | null>(null);
    const [descriptionHeight, setDescriptionHeight] = useState<number>();
    useResizeObserver(
        descriptionElement,
        useCallback(() => setDescriptionHeight(descriptionElement?.clientHeight), [descriptionElement]),
    );

    const [isCollapsed, setIsCollapsed] = useLocalStorage('isDescriptionGenreCollapsed', true);

    const collapsedSize = description
        ? Math.min(DESCRIPTION_COLLAPSED_SIZE, descriptionHeight ?? DESCRIPTION_COLLAPSED_SIZE)
        : 0;
    const genres = useMemo(() => mangaGenres.filter(Boolean), [mangaGenres]);

    return (
        <>
            {description && (
                <Stack sx={{ position: 'relative' }}>
                    <Collapse collapsedSize={collapsedSize} in={!isCollapsed}>
                        <Typography
                            ref={setDescriptionElement}
                            sx={{
                                whiteSpace: 'pre-line',
                                textAlign: 'justify',
                                textJustify: 'inter-word',
                                mb: OPEN_CLOSE_BUTTON_HEIGHT,
                            }}
                        >
                            {description}
                        </Typography>
                    </Collapse>
                    <Stack
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        sx={{
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            cursor: 'pointer',
                            position: 'absolute',
                            width: '100%',
                            height: OPEN_CLOSE_BUTTON_HEIGHT,
                            bottom: 0,
                            background: (theme) =>
                                `linear-gradient(transparent -15px, ${theme.palette.background.default})`,
                        }}
                    >
                        <IconButton sx={{ color: (theme) => (theme.palette.mode === 'light' ? 'black' : 'text') }}>
                            {isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                        </IconButton>
                    </Stack>
                </Stack>
            )}
            <Stack
                sx={{
                    flexDirection: 'row',
                    flexWrap: isCollapsed ? 'no-wrap' : 'wrap',
                    gap: 1,
                    overflowX: isCollapsed ? 'auto' : null,
                }}
            >
                {genres.map((genre) => (
                    <SearchLink key={genre} query={genre} sourceId={sourceId} mode={mode}>
                        <Chip label={genre} variant="outlined" onClick={() => {}} />
                    </SearchLink>
                ))}
            </Stack>
        </>
    );
};
