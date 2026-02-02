import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    Box,
    CircularProgress,
    Fade,
    IconButton,
    Typography,
    Drawer,
    List,
    ListItemButton,
    ListItemText
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';

import { useOCR } from '@/Manatan/context/OCRContext';
import ManatanLogo from '@/Manatan/assets/manatan_logo.png';
import { AppStorage } from '@/lib/storage/AppStorage';
import { useBookContent } from '../hooks/useBookContent';
import { VirtualReader } from '../components/VirtualReader';
import { ReaderControls } from '../components/ReaderControls';
import { YomitanPopup } from '@/Manatan/components/YomitanPopup';

export const LNReaderScreen: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { settings, setSettings, openSettings } = useOCR();
    const muiTheme = useTheme();

    const [savedProgress, setSavedProgress] = useState<any>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [tocOpen, setTocOpen] = useState(false);
    const [progressLoaded, setProgressLoaded] = useState(false);
    const [currentChapter, setCurrentChapter] = useState(0);

    useEffect(() => {
        if (!id) return;

        setSavedProgress(null);
        setProgressLoaded(false);

        AppStorage.getLnProgress(id).then((progress) => {
            setSavedProgress(progress);
            setProgressLoaded(true);
            if (progress?.chapterIndex !== undefined) {
                setCurrentChapter(progress.chapterIndex);
            }
        });
    }, [id]);

    const { content, isLoading, error } = useBookContent(id);

    const backgroundDefault = muiTheme.palette.background.default;
    const divider = muiTheme.palette.divider;

    useEffect(() => {
        if (!content || isLoading) return;

        const hash = location.hash;
        if (hash) {
            setTimeout(() => {
                const targetId = hash.substring(1);
                const element = document.getElementById(targetId);

                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 500);
        }
    }, [content, isLoading, location.hash]);

    const handleChapterClick = (index: number) => {
        setSavedProgress((prev: any) => ({
            ...prev,
            chapterIndex: index,
            pageNumber: 0,
            chapterCharOffset: 0,
            sentenceText: '',
        }));
        setCurrentChapter(index);
        setTocOpen(false);
    };

    const handleChapterChange = (chapterIndex: number) => {
        setCurrentChapter(chapterIndex);
    };

    if (isLoading || !progressLoaded) {
        return (
            <Box
                sx={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.default',
                    color: 'text.primary',
                    gap: 2,
                }}
            >
                <CircularProgress sx={{ color: 'primary.main' }} />
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    Loading book...
                </Typography>
            </Box>
        );
    }

    if (error || !content) {
        return (
            <Box
                sx={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.default',
                    color: 'text.primary',
                    gap: 2,
                    px: 3,
                }}
            >
                <Typography color="error" align="center">
                    {error || 'Book not found'}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => navigate(-1)}
                >
                    Go back
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
            <VirtualReader
                key={`${id}-${savedProgress?.chapterIndex}`}
                bookId={id!}
                items={content.chapters}
                stats={content.stats}
                chapterFilenames={content.chapterFilenames || []}
                settings={settings}
                initialIndex={savedProgress?.chapterIndex ?? 0}
                initialPage={savedProgress?.pageNumber ?? 0}
                initialProgress={
                    savedProgress
                        ? {
                            sentenceText: savedProgress.sentenceText,
                            chapterIndex: savedProgress.chapterIndex,
                            pageIndex: savedProgress.pageNumber,
                            chapterCharOffset: savedProgress.chapterCharOffset,
                            totalProgress: savedProgress.totalProgress,
                        }
                        : undefined
                }
                onUpdateSettings={(key, value) => setSettings(prev => ({ ...prev, [key]: value }))}
                onChapterChange={handleChapterChange}
                renderHeader={(showUI, toggleUI) => (
                    <Fade in={showUI}>
                        <Box
                            sx={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                p: 1.5,
                                background: `linear-gradient(to bottom, ${alpha(backgroundDefault, 0.93)}, ${alpha(backgroundDefault, 0)})`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                zIndex: 150,
                                pointerEvents: showUI ? 'auto' : 'none',
                            }}
                        >
                            {/* Back Button */}
                            <IconButton onClick={() => navigate(-1)} sx={{ color: 'text.primary' }}>
                                <ArrowBackIcon />
                            </IconButton>

                            <Typography
                                sx={{
                                    color: 'text.primary',
                                    fontWeight: 600,
                                    flex: 1,
                                    textAlign: 'center',
                                    mx: 2,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {content.metadata.title}
                            </Typography>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {/* Manatan Logo / OCR Settings */}
                                <IconButton onClick={() => openSettings()} sx={{ color: 'text.primary' }}>
                                    <Box
                                        component="img"
                                        src={ManatanLogo}
                                        alt="Manatan"
                                        sx={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                </IconButton>

                                {/* Table of Contents Button */}
                                <IconButton onClick={() => setTocOpen(true)} sx={{ color: 'text.primary' }}>
                                    <FormatListBulletedIcon />
                                </IconButton>

                                {/* Reader Settings Button */}
                                <IconButton onClick={() => setSettingsOpen(true)} sx={{ color: 'text.primary' }}>
                                    <SettingsIcon />
                                </IconButton>
                            </Box>
                        </Box>
                    </Fade>
                )}
            />

            <Drawer
                anchor="right"
                open={tocOpen}
                onClose={() => setTocOpen(false)}
                PaperProps={{
                    sx: {
                        width: '85%',
                        maxWidth: 320,
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                    },
                }}
            >
                <Box sx={{ p: 2, borderBottom: `1px solid ${divider}` }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Table of Contents
                    </Typography>
                </Box>
                <List sx={{ pt: 0 }}>
                    {content.metadata.toc && content.metadata.toc.length > 0 ? (
                        content.metadata.toc.map((chapter: any, idx: number) => (
                            <ListItemButton
                                key={idx}
                                onClick={() => handleChapterClick(chapter.chapterIndex)}
                                selected={chapter.chapterIndex === currentChapter}
                                sx={{
                                    borderBottom: `1px solid ${divider}`,
                                    '&.Mui-selected': { bgcolor: 'action.selected' },
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                            >
                                <ListItemText
                                    primary={chapter.label}
                                    primaryTypographyProps={{
                                        fontSize: '0.9rem',
                                        color: 'text.primary',
                                        noWrap: true,
                                    }}
                                />
                            </ListItemButton>
                        ))
                    ) : (
                        content.chapters.map((_, idx) => (
                            <ListItemButton
                                key={idx}
                                onClick={() => handleChapterClick(idx)}
                                selected={idx === currentChapter}
                                sx={{
                                    borderBottom: `1px solid ${divider}`,
                                    '&.Mui-selected': { bgcolor: 'action.selected' },
                                }}
                            >
                                <ListItemText
                                    primary={`Chapter ${idx + 1}`}
                                    primaryTypographyProps={{ color: 'text.primary' }}
                                />
                            </ListItemButton>
                        ))
                    )}
                </List>
            </Drawer>

            <ReaderControls
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                settings={settings}
                onUpdateSettings={(k, v) => setSettings((p) => ({ ...p, [k]: v }))}
                onResetSettings={() => {
                    import('@/Manatan/types').then(({ DEFAULT_SETTINGS }) => {
                        setSettings((prev) => ({
                            ...prev,
                            lnFontSize: DEFAULT_SETTINGS.lnFontSize,
                            lnLineHeight: DEFAULT_SETTINGS.lnLineHeight,
                            lnFontFamily: DEFAULT_SETTINGS.lnFontFamily,
                            lnTheme: DEFAULT_SETTINGS.lnTheme,
                            lnReadingDirection: DEFAULT_SETTINGS.lnReadingDirection,
                            lnPaginationMode: DEFAULT_SETTINGS.lnPaginationMode,
                            lnPageWidth: DEFAULT_SETTINGS.lnPageWidth,
                            lnPageMargin: DEFAULT_SETTINGS.lnPageMargin,
                            lnEnableFurigana: DEFAULT_SETTINGS.lnEnableFurigana,
                            lnTextAlign: DEFAULT_SETTINGS.lnTextAlign,
                            lnLetterSpacing: DEFAULT_SETTINGS.lnLetterSpacing,
                            lnParagraphSpacing: DEFAULT_SETTINGS.lnParagraphSpacing,
                        }));
                    });
                }}
            />

            <YomitanPopup />
        </Box>
    );
};
