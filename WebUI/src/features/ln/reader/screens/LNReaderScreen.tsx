import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    Button,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    TextField
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ImageIcon from '@mui/icons-material/Image';
import SearchIcon from '@mui/icons-material/Search';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import DeleteIcon from '@mui/icons-material/Delete';

import { useOCR } from '@/Manatan/context/OCRContext';
import ManatanLogo from '@/Manatan/assets/manatan_logo.png';
import { AppStorage, LNHighlight } from '@/lib/storage/AppStorage';
import { useBookContent } from '../hooks/useBookContent';
import { useHighlights } from '../hooks/useHighlights';
import { VirtualReader } from '../components/VirtualReader';
import { ReaderControls } from '../components/ReaderControls';
import { YomitanPopup } from '@/Manatan/components/YomitanPopup';
import { useSyncOnChapterOpen, useSyncOnChapterRead } from '@/features/sync/services/useSyncTriggers';

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
    const [searchOpen, setSearchOpen] = useState(false);
    const [highlightsOpen, setHighlightsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{chapterIndex: number; text: string; position: number}[]>([]);
    const [progressLoaded, setProgressLoaded] = useState(false);
    const [currentChapter, setCurrentChapter] = useState(0);
    const [showMigrationDialog, setShowMigrationDialog] = useState(false);
    const [expandedToc, setExpandedToc] = useState<Set<number>>(new Set());
    const navigationRef = useRef<{ scrollToBlock?: (blockId: string, offset?: number) => void; scrollToChapter?: (chapterIndex: number) => void }>({});
    const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const readerSafeTopOffsetPx = isIOS ? 24 : 0;
    const readerSafeTopInset = `${readerSafeTopOffsetPx}px`;
    const headerSafeTopInset = isIOS
        ? 'min(env(safe-area-inset-top, 0px), 44px)'
        : 'env(safe-area-inset-top, 0px)';

    const bookId = id || '';
    const chapterId = bookId ? `${bookId}-${currentChapter}` : null;
    const { triggerSync } = useSyncOnChapterRead();
    useSyncOnChapterOpen(chapterId);

    const { highlights, loading: highlightsLoading, addHighlight, removeHighlight, exportToTxt, exportToJson, downloadFile, refresh } = useHighlights(bookId);

    useEffect(() => {
        if (highlightsOpen) {
            refresh();
        }
    }, [highlightsOpen, refresh]);

    const handleExportTxt = useCallback((title: string, toc: any[]) => {
        const txt = exportToTxt(toc?.map((t: any) => t.label) || []);
        downloadFile(txt, `${title || 'highlights'}.txt`, 'text/plain');
    }, [exportToTxt, downloadFile]);

    const handleExportJson = useCallback((title: string) => {
        const json = exportToJson();
        downloadFile(json, `${title || 'highlights'}.json`, 'application/json');
    }, [exportToJson, downloadFile]);

    const handleJumpToHighlight = useCallback((hl: LNHighlight) => {
        // Try direct navigation first (for continuous reader)
        if (hl.blockId && navigationRef.current?.scrollToBlock) {
            navigationRef.current.scrollToBlock(hl.blockId, hl.startOffset);
            setHighlightsOpen(false);
            return;
        }

        // Fallback to savedProgress (for paged reader or if nav ref not ready)
        setSavedProgress((prev: any) => ({
            ...prev,
            chapterIndex: hl.chapterIndex,
            pageNumber: 0,
            blockId: hl.blockId,
            blockLocalOffset: hl.startOffset,
        }));
        setCurrentChapter(hl.chapterIndex);
        setHighlightsOpen(false);
    }, []);

    const handleDeleteHighlight = useCallback((e: React.MouseEvent, hl: LNHighlight) => {
        e.stopPropagation();
        removeHighlight(hl.id);
    }, [removeHighlight]);

    // Helper: Check if chapter is Art (image-only)
    const isArtChapter = (chapterHtml: string): boolean => {
        if (!chapterHtml) return false;
        const text = chapterHtml.replace(/<[^>]*>/g, '').trim();
        const hasImages = chapterHtml.includes('<img') || 
                        chapterHtml.includes('<figure') || 
                        chapterHtml.includes('data-src') ||
                        chapterHtml.includes('image-only');
        return text.length < 50 && hasImages;
    };

    // Helper: Find covering TOC item index (highest chapterIndex <= currentChapter)
    const findCoveringTocIndex = (toc: any[], currentCh: number): number => {
        let coveringIndex = -1;
        for (let i = 0; i < toc.length; i++) {
            if (toc[i].chapterIndex <= currentCh) {
                coveringIndex = i;
            } else {
                break;
            }
        }
        return coveringIndex;
    };

    // Helper: Get chapters in range for a TOC item
    const getChaptersInRange = (tocIndex: number, tocItems: any[], totalChapters: number): number[] => {
        const startIdx = tocItems[tocIndex].chapterIndex;
        const endIdx = tocIndex + 1 < tocItems.length 
            ? tocItems[tocIndex + 1].chapterIndex 
            : totalChapters;
        
        const chapters: number[] = [];
        for (let i = startIdx; i < endIdx && i < totalChapters; i++) {
            chapters.push(i);
        }
        return chapters;
    };

    // Helper: Group consecutive art chapters for display
    const getChapterDisplayLabel = (chapterIdx: number, chapters: string[], artGroups: Map<number, number>, firstTocChapterIndex: number): string => {
        const isArt = isArtChapter(chapters[chapterIdx]);
        
        if (isArt) {
            const artCount = artGroups.get(chapterIdx);
            if (artCount && artCount > 1) {
                return `Art (${artCount})`;
            }
            return 'Art';
        }
        
        // Count art chapters before this one within the TOC range
        let artCountBefore = 0;
        for (let i = firstTocChapterIndex; i < chapterIdx; i++) {
            if (isArtChapter(chapters[i])) artCountBefore++;
        }
        
        const chapterNum = chapterIdx - firstTocChapterIndex - artCountBefore + 1;
        return `Chapter ${Math.max(1, chapterNum)}`;
    };

    // Helper: Pre-calculate art groups
    const calculateArtGroups = (chapters: string[]): Map<number, number> => {
        const artGroups = new Map<number, number>();
        let consecutiveArt: number[] = [];
        
        chapters.forEach((html, idx) => {
            if (isArtChapter(html)) {
                consecutiveArt.push(idx);
            } else {
                if (consecutiveArt.length > 0) {
                    artGroups.set(consecutiveArt[0], consecutiveArt.length);
                    consecutiveArt = [];
                }
            }
        });
        
        if (consecutiveArt.length > 0) {
            artGroups.set(consecutiveArt[0], consecutiveArt.length);
        }
        
        return artGroups;
    };

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
        // Get first block ID for this chapter from blockMaps
        const blockMaps = content?.stats?.blockMaps;
        let firstBlockId: string | undefined;
        
        if (blockMaps) {
            const chapterBlocks = blockMaps
                .filter(b => b.blockId.startsWith(`ch${index}-`))
                .sort((a, b) => a.startOffset - b.startOffset);
            
            if (chapterBlocks.length > 0) {
                firstBlockId = chapterBlocks[0].blockId;
            }
        }
        
        // Fallback if no blockMaps
        if (!firstBlockId) {
            firstBlockId = `ch${index}-b0`;
        }
        
        setSavedProgress((prev: any) => ({
            ...prev,
            chapterIndex: index,
            pageNumber: 0,
            chapterCharOffset: 1, // Use 1 to trigger blockMaps lookup in restoration
            sentenceText: '',
            blockId: firstBlockId,
            blockLocalOffset: 0,
            contextSnippet: '',
        }));
        setCurrentChapter(index);
        setTocOpen(false);
    };

    const handleChapterChange = (chapterIndex: number) => {
        setCurrentChapter(chapterIndex);
    };

    const toggleTocExpand = (index: number) => {
        setExpandedToc(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const handleTocItemClick = (chapterIndex: number) => {
        // Try direct navigation first (for continuous reader)
        if (navigationRef.current?.scrollToChapter) {
            navigationRef.current.scrollToChapter(chapterIndex);
            setTocOpen(false);
            return;
        }

        // Fallback to savedProgress (for paged reader or if nav ref not ready)
        // Get first block ID for this chapter from blockMaps
        const blockMaps = content?.stats?.blockMaps;
        let firstBlockId: string | undefined;
        
        if (blockMaps) {
            const chapterBlocks = blockMaps
                .filter(b => b.blockId.startsWith(`ch${chapterIndex}-`))
                .sort((a, b) => a.startOffset - b.startOffset);
            
            if (chapterBlocks.length > 0) {
                firstBlockId = chapterBlocks[0].blockId;
            }
        }
        
        // Fallback if no blockMaps
        if (!firstBlockId) {
            firstBlockId = `ch${chapterIndex}-b0`;
        }
        
        setSavedProgress((prev: any) => ({
            ...prev,
            chapterIndex: chapterIndex,
            pageNumber: 0,
            chapterCharOffset: 1, // Use 1 to trigger blockMaps lookup in restoration
            sentenceText: '',
            blockId: firstBlockId,
            blockLocalOffset: 0,
            contextSnippet: '',
        }));
        setCurrentChapter(chapterIndex);
        setTocOpen(false);
    };

    const handleSearch = (query: string) => {
        if (!query.trim() || !content) {
            setSearchResults([]);
            return;
        }

        const results: {chapterIndex: number; text: string; position: number}[] = [];
        const searchLower = query.toLowerCase();

        content.chapters.forEach((chapterHtml, chapterIdx) => {
            const text = chapterHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            const textLower = text.toLowerCase();
            let position = textLower.indexOf(searchLower);
            
            while (position !== -1) {
                // Get context around the match
                const start = Math.max(0, position - 30);
                const end = Math.min(text.length, position + query.length + 30);
                const context = text.substring(start, end);
                
                results.push({
                    chapterIndex: chapterIdx,
                    text: context,
                    position: position
                });
                
                // Find next occurrence
                position = textLower.indexOf(searchLower, position + 1);
                
                // Limit results per chapter
                if (results.filter(r => r.chapterIndex === chapterIdx).length >= 5) break;
            }
        });

        setSearchResults(results);
    };

    const handleSearchResultClick = (result: {chapterIndex: number; text: string; position: number}) => {
        // Use existing blockMaps from metadata to find the block
        let blockId: string | undefined;
        let blockLocalOffset: number = 0;
        
        const blockMaps = content?.stats?.blockMaps;
        if (blockMaps) {
            // Find block for this specific chapter
            // BlockId format: "ch{chapterIndex}-b{blockOrder}"
            const chapterBlock = blockMaps.find(b => {
                const match = b.blockId.match(/ch(\d+)-b\d+/);
                if (!match) return false;
                const blockChapterIndex = parseInt(match[1], 10);
                return blockChapterIndex === result.chapterIndex && 
                       result.position >= b.startOffset && 
                       result.position < b.endOffset;
            });
            if (chapterBlock) {
                blockId = chapterBlock.blockId;
                blockLocalOffset = result.position - chapterBlock.startOffset;
            }
        }

        // Try direct navigation first (for continuous reader)
        if (blockId && navigationRef.current?.scrollToBlock) {
            navigationRef.current.scrollToBlock(blockId, blockLocalOffset);
            setSearchOpen(false);
            return;
        }

        // Fallback to savedProgress (for paged reader or if nav ref not ready)
        setSavedProgress((prev: any) => ({
            ...prev,
            chapterIndex: result.chapterIndex,
            pageNumber: 0,
            chapterCharOffset: result.position,
            sentenceText: result.text,
            blockId: blockId,
            blockLocalOffset: blockLocalOffset,
            contextSnippet: result.text,
        }));
        setCurrentChapter(result.chapterIndex);
        setSearchOpen(false);
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
                highlights={highlights}
                onAddHighlight={addHighlight}
                onUpdateSettings={(key, value) => setSettings(prev => ({ ...prev, [key]: value }))}
                onChapterChange={handleChapterChange}
                navigationRef={navigationRef}
                safeAreaTopInset={readerSafeTopInset}
                safeAreaTopOffsetPx={readerSafeTopOffsetPx}
                renderHeader={(showUI, toggleUI) => (
                    <Fade in={showUI}>
                        <Box
                            sx={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                pt: `calc(10px + ${headerSafeTopInset})`,
                                pb: 1.5,
                                px: 'calc(12px + env(safe-area-inset-left, 0px))',
                                pr: 'calc(12px + env(safe-area-inset-right, 0px))',
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

                                <IconButton onClick={() => setSearchOpen(true)} sx={{ color: theme.fg }}>
                                    <SearchIcon />
                                </IconButton>

                                <IconButton onClick={() => setHighlightsOpen(true)} sx={{ color: theme.fg }}>
                                    <FormatQuoteIcon />
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
                <Box sx={{ overflow: 'auto', pb: 2 }}>
                    {content.metadata.toc && content.metadata.toc.length > 0 ? (
                        (() => {
                            const coveringIndex = findCoveringTocIndex(content.metadata.toc, currentChapter);
                            const artGroups = calculateArtGroups(content.chapters);
                            const firstTocChapterIndex = content.metadata.toc[0]?.chapterIndex ?? 0;
                            
                            return content.metadata.toc.map((tocItem: any, tocIdx: number) => {
                                const chaptersInRange = getChaptersInRange(tocIdx, content.metadata.toc, content.chapters.length);
                                const isExpanded = expandedToc.has(tocIdx);
                                const isCovering = tocIdx === coveringIndex;
                                
                                return (
                                    <Box key={tocIdx}>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                p: 1.5,
                                                borderBottom: `1px solid ${theme.fg}11`,
                                                bgcolor: isCovering ? `${theme.fg}15` : 'transparent',
                                                cursor: 'pointer',
                                                '&:hover': { bgcolor: `${theme.fg}08` },
                                            }}
                                        >
                                            <Box
                                                onClick={() => toggleTocExpand(tocIdx)}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    flex: 1,
                                                    minWidth: 0,
                                                }}
                                            >
                                                {isExpanded ? (
                                                    <ExpandLessIcon sx={{ fontSize: 20, mr: 1, color: theme.fg, opacity: 0.7 }} />
                                                ) : (
                                                    <ExpandMoreIcon sx={{ fontSize: 20, mr: 1, color: theme.fg, opacity: 0.7 }} />
                                                )}
                                                <Typography
                                                    sx={{
                                                        fontSize: '0.9rem',
                                                        fontWeight: isCovering ? 600 : 400,
                                                        color: theme.fg,
                                                        noWrap: true,
                                                    }}
                                                >
                                                    {tocItem.label}
                                                </Typography>
                                                {isCovering && (
                                                    <Box
                                                        sx={{
                                                            ml: 1,
                                                            px: 0.75,
                                                            py: 0.25,
                                                            bgcolor: theme.fg,
                                                            borderRadius: 1,
                                                            fontSize: '0.65rem',
                                                            color: theme.bg,
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        Current
                                                    </Box>
                                                )}
                                            </Box>
                                        </Box>
                                        
                                        {isExpanded && chaptersInRange.length > 0 && (
                                            <Box sx={{ pl: 1, pr: 1 }}>
                                                {chaptersInRange.map((chapterIdx: number) => {
                                                    const isCurrentChapter = chapterIdx === currentChapter;
                                                    const isArt = isArtChapter(content.chapters[chapterIdx]);
                                                    const label = getChapterDisplayLabel(chapterIdx, content.chapters, artGroups, firstTocChapterIndex);
                                                    
                                                    return (
                                                        <ListItemButton
                                                            key={chapterIdx}
                                                            onClick={() => handleTocItemClick(chapterIdx)}
                                                            sx={{
                                                                pl: 3,
                                                                py: 0.75,
                                                                borderBottom: `1px solid ${theme.fg}08`,
                                                                bgcolor: isCurrentChapter ? `${theme.fg}22` : 'transparent',
                                                                '&:hover': { bgcolor: `${theme.fg}11` },
                                                            }}
                                                        >
                                                            {isArt && (
                                                                <ImageIcon sx={{ fontSize: 16, mr: 1, color: theme.fg, opacity: 0.6 }} />
                                                            )}
                                                            <ListItemText
                                                                primary={label}
                                                                primaryTypographyProps={{
                                                                    fontSize: '0.8rem',
                                                                    color: theme.fg,
                                                                    opacity: isCurrentChapter ? 1 : 0.8,
                                                                    fontWeight: isCurrentChapter ? 500 : 400,
                                                                }}
                                                            />
                                                            {isCurrentChapter && (
                                                                <Box
                                                                    sx={{
                                                                        width: 6,
                                                                        height: 6,
                                                                        borderRadius: '50%',
                                                                        bgcolor: theme.fg,
                                                                    }}
                                                                />
                                                            )}
                                                        </ListItemButton>
                                                    );
                                                })}
                                            </Box>
                                        )}
                                    </Box>
                                );
                            });
                        })()
                    ) : (
                        (() => {
                            const artGroups = calculateArtGroups(content.chapters);
                            const firstTocChapterIndex = 0;
                            
                            return content.chapters.map((_: any, idx: number) => {
                                const isCurrentChapter = idx === currentChapter;
                                const isArt = isArtChapter(content.chapters[idx]);
                                const label = getChapterDisplayLabel(idx, content.chapters, artGroups, firstTocChapterIndex);
                                
                                return (
                                    <ListItemButton
                                        key={idx}
                                        onClick={() => handleTocItemClick(idx)}
                                        selected={isCurrentChapter}
                                        sx={{
                                            borderBottom: `1px solid ${theme.fg}11`,
                                            '&.Mui-selected': { bgcolor: `${theme.fg}22` },
                                            '&:hover': { bgcolor: `${theme.fg}11` },
                                        }}
                                    >
                                        {isArt && (
                                            <ImageIcon sx={{ fontSize: 18, mr: 1, color: theme.fg, opacity: 0.6 }} />
                                        )}
                                        <ListItemText
                                            primary={label}
                                            primaryTypographyProps={{
                                                fontSize: '0.9rem',
                                                color: theme.fg,
                                            }}
                                        />
                                        {isCurrentChapter && (
                                            <Box
                                                sx={{
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: '50%',
                                                    bgcolor: theme.fg,
                                                }}
                                            />
                                        )}
                                    </ListItemButton>
                                );
                            });
                        })()
                    )}
                </Box>
            </Drawer>

            {/* Search Drawer */}
            <Drawer
                anchor="right"
                open={searchOpen}
                onClose={() => setSearchOpen(false)}
                PaperProps={{
                    sx: {
                        width: '85%',
                        maxWidth: 400,
                        bgcolor: theme.bg,
                        color: theme.fg,
                    },
                }}
            >
                <Box sx={{ p: 2, borderBottom: `1px solid ${theme.fg}22` }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                        Search
                    </Typography>
                    <TextField
                        fullWidth
                        autoFocus
                        placeholder="Search in book..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            handleSearch(e.target.value);
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                color: theme.fg,
                                '& fieldset': { borderColor: `${theme.fg}44` },
                                '&:hover fieldset': { borderColor: `${theme.fg}66` },
                                '&.Mui-focused fieldset': { borderColor: theme.fg },
                            },
                        }}
                    />
                </Box>
                <Box sx={{ overflow: 'auto', pb: 2 }}>
                    {searchResults.length > 0 ? (
                        <List sx={{ pt: 0 }}>
                            {searchResults.map((result, idx) => (
                                <ListItemButton
                                    key={idx}
                                    onClick={() => handleSearchResultClick(result)}
                                    sx={{
                                        borderBottom: `1px solid ${theme.fg}11`,
                                        '&:hover': { bgcolor: `${theme.fg}11` },
                                    }}
                                >
                                    <ListItemText
                                        primary={`Chapter ${result.chapterIndex + 1}`}
                                        secondary={result.text}
                                        primaryTypographyProps={{
                                            fontSize: '0.85rem',
                                            color: theme.fg,
                                            fontWeight: 500,
                                        }}
                                        secondaryTypographyProps={{
                                            fontSize: '0.75rem',
                                            color: theme.fg,
                                            sx: { opacity: 0.7 },
                                            noWrap: true,
                                        }}
                                    />
                                </ListItemButton>
                            ))}
                        </List>
                    ) : searchQuery.trim() ? (
                        <Box sx={{ p: 3, textAlign: 'center' }}>
                            <Typography sx={{ color: theme.fg, opacity: 0.6 }}>
                                No results found
                            </Typography>
                        </Box>
                    ) : null}
                </Box>
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

            <Drawer
                anchor="right"
                open={highlightsOpen}
                onClose={() => setHighlightsOpen(false)}
                PaperProps={{
                    sx: {
                        width: '85%',
                        maxWidth: 360,
                        bgcolor: theme.bg,
                        color: theme.fg,
                    },
                }}
            >
                <Box sx={{ p: 2, borderBottom: `1px solid ${theme.fg}22` }}>
                    <Typography variant="h6" sx={{ color: theme.fg, fontWeight: 600 }}>
                        Highlights
                    </Typography>
                </Box>
                <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleExportTxt(content?.metadata?.title || 'highlights', content?.metadata?.toc || [])}
                        sx={{ color: theme.fg, borderColor: theme.fg }}
                    >
                        Export TXT
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleExportJson(content?.metadata?.title || 'highlights')}
                        sx={{ color: theme.fg, borderColor: theme.fg }}
                    >
                        Export JSON
                    </Button>
                </Box>
                <Divider sx={{ borderColor: theme.fg + '22' }} />
                {highlightsLoading ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <CircularProgress size={24} sx={{ color: theme.fg }} />
                    </Box>
                ) : highlights.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography sx={{ color: theme.fg, opacity: 0.6 }}>
                            No highlights yet
                        </Typography>
                        <Typography sx={{ color: theme.fg, opacity: 0.4, fontSize: '0.8rem', mt: 1 }}>
                            Select text and tap "Highlight" to save
                        </Typography>
                    </Box>
                ) : (
                    <List sx={{ py: 0 }}>
                        {highlights.map((hl) => (
                            <ListItemButton
                                key={hl.id}
                                onClick={() => handleJumpToHighlight(hl)}
                                sx={{ py: 1.5, borderBottom: `1px solid ${theme.fg}11` }}
                            >
                                <ListItemText
                                    primary={hl.text.slice(0, 100) + (hl.text.length > 100 ? '...' : '')}
                                    secondary={`${content?.metadata?.toc?.[hl.chapterIndex]?.label || `Chapter ${hl.chapterIndex + 1}`} • ${new Date(hl.createdAt).toLocaleDateString()}`}
                                    primaryTypographyProps={{ sx: { color: theme.fg, fontSize: '0.9rem' } }}
                                    secondaryTypographyProps={{ sx: { color: theme.fg, opacity: 0.5, fontSize: '0.75rem' } }}
                                />
                                <IconButton
                                    size="small"
                                    onClick={(e) => handleDeleteHighlight(e, hl)}
                                    sx={{ color: theme.fg, opacity: 0.5, '&:hover': { opacity: 1, color: '#f44336' } }}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </ListItemButton>
                        ))}
                    </List>
                )}
            </Drawer>

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
