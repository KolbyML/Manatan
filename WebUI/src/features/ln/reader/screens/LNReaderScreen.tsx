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
    ListItemText,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button
} from '@mui/material';
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

const THEMES = {
    light: { bg: '#FFFFFF', fg: '#1a1a1a' },
    sepia: { bg: '#F4ECD8', fg: '#5C4B37' },
    dark: { bg: '#2B2B2B', fg: '#E0E0E0' },
    black: { bg: '#000000', fg: '#CCCCCC' },
} as const;

export const LNReaderScreen: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { settings, setSettings, openSettings } = useOCR();

    const [savedProgress, setSavedProgress] = useState<any>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [tocOpen, setTocOpen] = useState(false);
    const [progressLoaded, setProgressLoaded] = useState(false);
    const [currentChapter, setCurrentChapter] = useState(0);
    const [showMigrationDialog, setShowMigrationDialog] = useState(false);

    // Check for blocks and show migration dialog one-time
    useEffect(() => {
        if (!id || !progressLoaded) return;

        const checkBlocksAndShowDialog = async () => {
            const hasBlocks = await AppStorage.hasBookBlocks(id);
            const migrationKey = `ln_migration_dialog_shown_${id}`;

            if (!hasBlocks && !localStorage.getItem(migrationKey)) {
                setShowMigrationDialog(true);
                localStorage.setItem(migrationKey, 'true');
            }
        };

        checkBlocksAndShowDialog();
    }, [id, progressLoaded]);

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

    const themeKey = (settings.lnTheme || 'dark') as keyof typeof THEMES;
    const theme = THEMES[themeKey] || THEMES.dark;

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
            blockId: undefined,
            blockLocalOffset: 0,
            contextSnippet: '',
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
                    bgcolor: theme.bg,
                    color: theme.fg,
                    gap: 2,
                }}
            >
                <CircularProgress sx={{ color: theme.fg }} />
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
                    bgcolor: theme.bg,
                    color: theme.fg,
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
                            blockId: savedProgress.blockId,
                            blockLocalOffset: savedProgress.blockLocalOffset,
                            contextSnippet: savedProgress.contextSnippet,
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
                                background: `linear-gradient(to bottom, ${theme.bg}ee, ${theme.bg}00)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                zIndex: 150,
                                pointerEvents: showUI ? 'auto' : 'none',
                            }}
                        >
                            <IconButton onClick={() => navigate(-1)} sx={{ color: theme.fg }}>
                                <ArrowBackIcon />
                            </IconButton>

                            <Typography
                                sx={{
                                    color: theme.fg,
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
                                <IconButton onClick={() => openSettings()} sx={{ color: theme.fg }}>
                                    <Box
                                        component="img"
                                        src={ManatanLogo}
                                        alt="Manatan"
                                        sx={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                </IconButton>

                                <IconButton onClick={() => setTocOpen(true)} sx={{ color: theme.fg }}>
                                    <FormatListBulletedIcon />
                                </IconButton>

                                <IconButton onClick={() => setSettingsOpen(true)} sx={{ color: theme.fg }}>
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
                        bgcolor: theme.bg,
                        color: theme.fg,
                    },
                }}
            >
                <Box sx={{ p: 2, borderBottom: `1px solid ${theme.fg}22` }}>
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
                                    borderBottom: `1px solid ${theme.fg}11`,
                                    '&.Mui-selected': { bgcolor: `${theme.fg}22` },
                                    '&:hover': { bgcolor: `${theme.fg}11` },
                                }}
                            >
                                <ListItemText
                                    primary={chapter.label}
                                    primaryTypographyProps={{
                                        fontSize: '0.9rem',
                                        color: theme.fg,
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
                                    borderBottom: `1px solid ${theme.fg}11`,
                                    '&.Mui-selected': { bgcolor: `${theme.fg}22` },
                                }}
                            >
                                <ListItemText
                                    primary={`Chapter ${idx + 1}`}
                                    primaryTypographyProps={{ color: theme.fg }}
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
                theme={theme}
            />

            <YomitanPopup />

            <Dialog
                open={showMigrationDialog}
                onClose={() => setShowMigrationDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Reader Update</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This book needs to be re-imported to update its data for improved progress tracking.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowMigrationDialog(false)}>Dismiss</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};