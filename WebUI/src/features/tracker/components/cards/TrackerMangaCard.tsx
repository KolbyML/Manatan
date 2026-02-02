/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import CardActionArea from '@mui/material/CardActionArea';
import CardMedia from '@mui/material/CardMedia';
import Collapse from '@mui/material/Collapse';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLayoutEffect, useRef, useState } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { SpinnerImage } from '@/base/components/SpinnerImage.tsx';
import { TypographyMaxLines } from '@/base/components/texts/TypographyMaxLines.tsx';
import { Metadata } from '@/base/components/texts/Metadata.tsx';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { Trackers } from '@/features/tracker/services/Trackers.ts';
import { MANGA_COVER_ASPECT_RATIO } from '@/features/manga/Manga.constants.ts';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';
import {
    PUBLISHING_STATUS_TO_TRANSLATION,
    PUBLISHING_TYPE_TO_TRANSLATION,
} from '@/features/tracker/Tracker.constants.ts';
import { TTrackerManga } from '@/features/tracker/Tracker.types.ts';

const TrackerMangaCardTitle = ({ title, selected }: { title: string; selected: boolean }) => (
    <Stack
        direction="row"
        sx={{
            gap: '5px',
            justifyContent: 'space-between',
        }}
    >
        <CustomTooltip title={title}>
            <TypographyMaxLines variant="h5" component="h1">
                {title}
            </TypographyMaxLines>
        </CustomTooltip>
        <CheckCircleIcon sx={{ visibility: selected ? 'visible' : 'hidden' }} color="primary" />
    </Stack>
);

const SUMMARY_COLLAPSED_SIZE = 50;
const TrackerMangaCardSummary = ({ summary }: { summary: string }) => {
    const { t } = useTranslation();

    const summaryRef = useRef<HTMLParagraphElement>(null);

    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
    const [showSummaryExpandButton, setShowSummaryExpandButton] = useState(false);

    const summaryCollapsedSize = showSummaryExpandButton ? SUMMARY_COLLAPSED_SIZE : 0;

    useLayoutEffect(() => {
        const shouldCollapseSummary = (summaryRef.current?.clientHeight ?? 0) > SUMMARY_COLLAPSED_SIZE;

        setShowSummaryExpandButton(shouldCollapseSummary);
        setIsSummaryExpanded(!shouldCollapseSummary);
    }, []);
    return (
        <>
            {summary.length && (
                <Collapse collapsedSize={summaryCollapsedSize} in={isSummaryExpanded}>
                    <Typography ref={summaryRef} variant="body1" component="p" sx={{ whiteSpace: 'pre-line' }}>
                        {summary}
                    </Typography>
                </Collapse>
            )}
            {summary.length && showSummaryExpandButton && (
                <Button
                    component="div"
                    {...MUIUtil.preventRippleProp()}
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsSummaryExpanded(!isSummaryExpanded);
                    }}
                >
                    {t(isSummaryExpanded ? 'global.button.show_less' : 'global.button.show_more')}
                </Button>
            )}
        </>
    );
};

const TrackerMangaCardLink = ({ children, url }: { children: React.ReactNode; url: string }) => (
    <Link
        {...MUIUtil.preventRippleProp()}
        href={url}
        rel="noreferrer"
        target="_blank"
        underline="none"
        color="inherit"
        onClick={(e) => e.stopPropagation()}
    >
        {children}
    </Link>
);

export const TrackerMangaCard = ({
    manga,
    selected,
    onSelect,
}: {
    manga: TTrackerManga;
    selected: boolean;
    onSelect: () => void;
}) => {
    const { t } = useTranslation();
    const isMobileWidth = MediaQuery.useIsMobileWidth();

    return (
        <Card
            sx={{
                backgroundColor: 'background.default',
                marginBottom: 2,
                '&:last-child': { marginBottom: 8 },
            }}
        >
            <CardActionArea onClick={onSelect}>
                <CardContent sx={{ padding: '0', borderRadius: 'inherit' }}>
                    <Box
                        sx={{
                            padding: 1,
                            border: '3px solid',
                            borderRadius: 'inherit',
                            borderColor: selected ? 'primary.main' : 'transparent',
                        }}
                    >
                        <Stack
                            direction="row"
                            sx={{
                                gap: 2,
                                marginBottom: 2,
                            }}
                        >
                            <CardMedia
                                sx={{
                                    aspectRatio: MANGA_COVER_ASPECT_RATIO,
                                    minWidth: '100px',
                                    width: '150px',
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                }}
                            >
                                <TrackerMangaCardLink url={manga.trackingUrl}>
                                    <SpinnerImage
                                        useFetchApi={false}
                                        disableCors
                                        ignoreQueue
                                        alt={manga.title}
                                        src={manga.coverUrl}
                                        spinnerStyle={{ width: '100%', height: '100%' }}
                                        imgStyle={{
                                            width: '100%',
                                            height: isMobileWidth ? undefined : '100%',
                                            maxHeight: '100%',
                                            objectFit: 'cover',
                                        }}
                                    />
                                </TrackerMangaCardLink>
                            </CardMedia>
                            <Stack direction="column" sx={{ width: '100%' }}>
                                <TrackerMangaCardLink url={manga.trackingUrl}>
                                    <TrackerMangaCardTitle title={manga.title} selected={selected} />
                                </TrackerMangaCardLink>
                                {manga.publishingType && (
                                    <Metadata
                                        title={t('global.label.type')}
                                        value={t(PUBLISHING_TYPE_TO_TRANSLATION[Trackers.getPublishingType(manga)])}
                                    />
                                )}
                                {manga.startDate && (
                                    <Metadata title={t('global.label.started')} value={manga.startDate} />
                                )}
                                {manga.publishingStatus && (
                                    <Metadata
                                        title={t('manga.label.status')}
                                        value={t(PUBLISHING_STATUS_TO_TRANSLATION[Trackers.getPublishingStatus(manga)])}
                                    />
                                )}
                                {manga.score > 0 && (
                                    <Metadata title={t('tracking.track_record.label.score')} value={manga.score} />
                                )}
                                {manga.totalChapters > 0 && (
                                    <Metadata title={t('chapter.title_other')} value={manga.totalChapters} />
                                )}
                            </Stack>
                        </Stack>
                        <TrackerMangaCardSummary summary={manga.summary} />
                    </Box>
                </CardContent>
            </CardActionArea>
        </Card>
    );
};
