import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Card,
    CardActionArea,
    Typography,
    IconButton,
    LinearProgress,
    Skeleton,
    Stack,
    MenuItem,
    ListItemIcon,
    Checkbox,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { styled } from '@mui/material/styles';

import { AppStorage, LNMetadata } from '@/lib/storage/AppStorage';
import { AppRoutes } from '@/base/AppRoute.constants';
import { parseEpub, ParseProgress } from '../services/epubParser';
import { clearBookCache } from '../reader/hooks/useBookContent';

import PopupState, { bindMenu, bindTrigger } from 'material-ui-popup-state';
import { useLongPress } from 'use-long-press';
import { Menu } from '@/base/components/menu/Menu';
import { MUIUtil } from '@/lib/mui/MUI.util';
import { MediaQuery } from '@/base/utils/MediaQuery';
import { CustomTooltip } from '@/base/components/CustomTooltip';
import { TypographyMaxLines } from '@/base/components/texts/TypographyMaxLines';
import { MANGA_COVER_ASPECT_RATIO } from '@/features/manga/Manga.constants';
import { useAppAction } from '@/features/navigation-bar/hooks/useAppAction';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata';
import { useResizeObserver } from '@/base/hooks/useResizeObserver';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext';
import LibraryAddCheckIcon from '@mui/icons-material/LibraryAddCheck';

interface LibraryItem extends LNMetadata {
    importProgress?: number;
    importMessage?: string;
}

const BottomGradient = styled('div')({
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: '30%',
    background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 100%)',
});

const BottomGradientDoubledDown = styled('div')({
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: '20%',
    background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 100%)',
});

type LNLibraryCardProps = {
    item: LibraryItem;
    onOpen: (id: string) => void;
    onDelete: (id: string, event: React.MouseEvent) => void;
    isSelectionMode: boolean;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
    onLongPress: (id: string) => void;
};

const LNLibraryCard = ({ item, onOpen, onDelete, isSelectionMode, isSelected, onToggleSelect, onLongPress }: LNLibraryCardProps) => {
    const preventMobileContextMenu = MediaQuery.usePreventMobileContextMenu();
    const optionButtonRef = useRef<HTMLButtonElement>(null);

    const longPressBind = useLongPress(
        useCallback((e: any, { context }: any) => {
            if (isSelectionMode) return;
            (context as () => void)?.();
        }, [isSelectionMode]),
        {
            onCancel: (e, { context }) => {
                // Prevent click after long press
            },
            threshold: 500,
            cancelOnMovement: true,
        }
    );

    const isProcessing = item.isProcessing || false;

    const handleCardClick = () => {
        if (isProcessing) return;
        if (isSelectionMode) {
            onToggleSelect(item.id);
        } else {
            onOpen(item.id);
        }
    };

    return (
        <PopupState variant="popover" popupId={`ln-card-action-menu-${item.id}`}>
            {(popupState) => (
                <>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            m: 0.25,
                            '@media (hover: hover) and (pointer: fine)': {
                                '&:hover .ln-option-button': {
                                    visibility: 'visible',
                                    pointerEvents: 'all',
                                },
                            },
                        }}
                    >
                        <Card sx={{ aspectRatio: MANGA_COVER_ASPECT_RATIO, display: 'flex' }}>
                            <CardActionArea
                                {...longPressBind(() => {
                                    if (!isSelectionMode) {
                                        onLongPress(item.id);
                                    }
                                })}
                                onClick={handleCardClick}
                                onContextMenu={(e) => {
                                    if (isSelectionMode) {
                                        e.preventDefault();
                                        return;
                                    }
                                    preventMobileContextMenu(e);
                                }}
                                sx={{
                                    position: 'relative',
                                    height: '100%',
                                    cursor: isProcessing ? 'wait' : 'pointer',
                                    opacity: isProcessing ? 0.7 : 1,
                                }}
                            >
                                {isProcessing ? (
                                    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                                        <Skeleton variant="rectangular" width="100%" height="100%" />
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                p: 1,
                                                bgcolor: 'rgba(0,0,0,0.7)',
                                            }}
                                        >
                                            <LinearProgress
                                                variant="determinate"
                                                value={item.importProgress || 0}
                                                sx={{ mb: 0.5 }}
                                            />
                                            <Typography variant="caption" sx={{ color: 'white', fontSize: '0.65rem' }}>
                                                {item.importMessage || 'Processing...'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                ) : item.cover ? (
                                    <Box
                                        component="img"
                                        src={item.cover}
                                        alt={item.title}
                                        loading="lazy"
                                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <Stack
                                        sx={{
                                            height: '100%',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            bgcolor: (theme) => theme.palette.background.default,
                                        }}
                                    >
                                        <Typography variant="h3" color="text.disabled">
                                            Aa
                                        </Typography>
                                    </Stack>
                                )}

                                {!isProcessing && (
                                    <>
                                        <Stack
                                            direction="row"
                                            sx={{
                                                alignItems: 'start',
                                                justifyContent: 'space-between',
                                                position: 'absolute',
                                                top: (theme) => theme.spacing(1),
                                                left: (theme) => theme.spacing(1),
                                                right: (theme) => theme.spacing(1),
                                            }}
                                        >
                                            {isSelectionMode ? (
                                                <Checkbox
                                                    checked={isSelected}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onToggleSelect(item.id);
                                                    }}
                                                    sx={{
                                                        color: 'white',
                                                        bgcolor: 'rgba(0,0,0,0.5)',
                                                        borderRadius: 1,
                                                        p: 0.5,
                                                        '&.Mui-checked': {
                                                            color: 'primary.main',
                                                        },
                                                    }}
                                                />
                                            ) : item.hasProgress ? (
                                                <Box
                                                    sx={{
                                                        bgcolor: 'primary.main',
                                                        color: 'white',
                                                        px: 1,
                                                        py: 0.5,
                                                        borderRadius: 1,
                                                        fontSize: '0.75rem',
                                                        fontWeight: 'bold',
                                                        boxShadow: 2,
                                                    }}
                                                >
                                                    READING
                                                </Box>
                                            ) : (
                                                <Box />
                                            )}
                                            {!isSelectionMode && (
                                                <CustomTooltip title="Options">
                                                    <IconButton
                                                        ref={optionButtonRef}
                                                        {...MUIUtil.preventRippleProp(bindTrigger(popupState), {
                                                            onClick: (event) => {
                                                                event.stopPropagation();
                                                                event.preventDefault();
                                                                popupState.open();
                                                            },
                                                        })}
                                                        className="ln-option-button"
                                                        size="small"
                                                        sx={{
                                                            minWidth: 'unset',
                                                            paddingX: 0,
                                                            paddingY: '2.5px',
                                                            backgroundColor: 'primary.main',
                                                            color: 'common.white',
                                                            '&:hover': { backgroundColor: 'primary.main' },
                                                            visibility: popupState.isOpen ? 'visible' : 'hidden',
                                                            pointerEvents: 'none',
                                                            '@media not (pointer: fine)': {
                                                                visibility: 'hidden',
                                                                width: 0,
                                                                height: 0,
                                                                p: 0,
                                                                m: 0,
                                                            },
                                                        }}
                                                    >
                                                        <MoreVertIcon />
                                                    </IconButton>
                                                </CustomTooltip>
                                            )}
                                        </Stack>

                                        <BottomGradient />
                                        <BottomGradientDoubledDown />

                                        <Stack
                                            direction="row"
                                            sx={{
                                                justifyContent: 'space-between',
                                                alignItems: 'end',
                                                position: 'absolute',
                                                bottom: 0,
                                                width: '100%',
                                                p: 1,
                                                gap: 1,
                                            }}
                                        >
                                            <CustomTooltip title={item.title} placement="top">
                                                <TypographyMaxLines
                                                    component="h3"
                                                    sx={{
                                                        color: 'white',
                                                        textShadow: '0px 0px 3px #000000',
                                                    }}
                                                >
                                                    {item.title}
                                                </TypographyMaxLines>
                                            </CustomTooltip>
                                        </Stack>
                                    </>
                                )}
                            </CardActionArea>
                        </Card>
                    </Box>

                    {popupState.isOpen && !isSelectionMode && (
                        <Menu {...bindMenu(popupState)}>
                            {(onClose) => (
                                <MenuItem
                                    onClick={(event) => {
                                        onClose();
                                        onDelete(item.id, event);
                                    }}
                                >
                                    <ListItemIcon>
                                        <DeleteIcon fontSize="small" />
                                    </ListItemIcon>
                                    Delete
                                </MenuItem>
                            )}
                        </Menu>
                    )}
                </>
            )}
        </PopupState>
    );
};

export const LNLibrary: React.FC = () => {
    const navigate = useNavigate();
    const [library, setLibrary] = useState<LibraryItem[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const { navBarWidth } = useNavBarContext();
    const { settings: { mangaGridItemWidth } } = useMetadataServerSettings();

    const gridWrapperRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState(
        gridWrapperRef.current?.offsetWidth ?? Math.max(0, document.documentElement.offsetWidth - navBarWidth)
    );

    useEffect(() => {
        loadLibrary();
    }, []);

    useResizeObserver(
        gridWrapperRef,
        useCallback(() => {
            const gridWidth = gridWrapperRef.current?.offsetWidth;
            setDimensions(gridWidth ?? document.documentElement.offsetWidth - navBarWidth);
        }, [navBarWidth])
    );

    const gridColumns = Math.max(1, Math.ceil(dimensions / mangaGridItemWidth));

    const loadLibrary = async () => {
        try {
            const keys = await AppStorage.lnMetadata.keys();
            const items: LibraryItem[] = [];

            for (const key of keys) {
                const metadata = await AppStorage.lnMetadata.getItem<LNMetadata>(key);
                if (metadata) {
                    const hasProgress = await AppStorage.lnProgress.getItem(key);
                    items.push({
                        ...metadata,
                        hasProgress: !!hasProgress,
                    });
                }
            }

            setLibrary(items.sort((a, b) => b.addedAt - a.addedAt));
        } catch (e) {
            console.error('Failed to load library:', e);
        }
    };

    // Normalize title for comparison
    const normalizeTitle = (title: string): string => {
        return title
            .toLowerCase()
            .replace(/\.epub$/i, '')
            .replace(/[^\p{L}\p{N}\s]/gu, '') // Unicode-aware: keeps all letters and numbers
            .replace(/\s+/g, ' ')
            .trim();
    };

    // Check if a book with similar title already exists in current library state
    const findDuplicateInLibrary = useCallback((title: string, currentLibrary: LibraryItem[]): LibraryItem | undefined => {
        const normalizedTitle = normalizeTitle(title);
        return currentLibrary.find(item =>
            !item.isProcessing && normalizeTitle(item.title) === normalizedTitle
        );
    }, []);

    const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;

        const files = Array.from(e.target.files);
        setIsImporting(true);

        const skippedFiles: string[] = [];
        const importedFiles: string[] = [];

        // Keep track of current library state for duplicate checking
        let currentLibrary = [...library];

        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const file = files[fileIndex];
            const fileTitle = file.name.replace(/\.epub$/i, '');

            // Check for duplicate by filename first
            const existingBook = findDuplicateInLibrary(fileTitle, currentLibrary);

            if (existingBook) {
                const shouldReplace = window.confirm(
                    `"${existingBook.title}" already exists in your library.\n\nDo you want to replace it?`
                );

                if (!shouldReplace) {
                    skippedFiles.push(file.name);
                    continue;
                }

                // Delete the existing book before importing
                clearBookCache(existingBook.id);
                await AppStorage.deleteLnData(existingBook.id);
                currentLibrary = currentLibrary.filter(item => item.id !== existingBook.id);
                setLibrary(prev => prev.filter(item => item.id !== existingBook.id));
            }

            const bookId = `ln_${Date.now()}_${fileIndex}`;

            const placeholder: LibraryItem = {
                id: bookId,
                title: fileTitle,
                author: '',
                addedAt: Date.now(),
                isProcessing: true,
                importProgress: 0,
                importMessage: 'Starting...',
                stats: { chapterLengths: [], totalLength: 0 },
                chapterCount: 0,
            };

            currentLibrary = [placeholder, ...currentLibrary];
            setLibrary((prev) => [placeholder, ...prev]);

            try {
                const result = await parseEpub(file, bookId, (progress: ParseProgress) => {
                    setLibrary((prev) =>
                        prev.map((item) =>
                            item.id === bookId
                                ? {
                                    ...item,
                                    importProgress: progress.percent,
                                    importMessage: progress.message,
                                }
                                : item
                        )
                    );
                });

                if (result.success && result.metadata && result.content) {
                    // Check again for duplicate using parsed metadata title
                    const metadataTitle = result.metadata.title;
                    const duplicateByMetadata = findDuplicateInLibrary(metadataTitle, currentLibrary.filter(i => i.id !== bookId));

                    if (duplicateByMetadata) {
                        const shouldReplace = window.confirm(
                            `The book "${metadataTitle}" already exists in your library (detected from EPUB metadata).\n\nDo you want to replace it?`
                        );

                        if (!shouldReplace) {
                            // Remove the placeholder and skip
                            currentLibrary = currentLibrary.filter(item => item.id !== bookId);
                            setLibrary(prev => prev.filter(item => item.id !== bookId));
                            skippedFiles.push(file.name);
                            continue;
                        }

                        // Delete the existing book
                        clearBookCache(duplicateByMetadata.id);
                        await AppStorage.deleteLnData(duplicateByMetadata.id);
                        currentLibrary = currentLibrary.filter(item => item.id !== duplicateByMetadata.id);
                        setLibrary(prev => prev.filter(item => item.id !== duplicateByMetadata.id));
                    }

                    await Promise.all([
                        AppStorage.files.setItem(bookId, file),
                        AppStorage.lnMetadata.setItem(bookId, result.metadata),
                        AppStorage.lnContent.setItem(bookId, result.content),
                    ]);

                    const finalItem: LibraryItem = {
                        ...result.metadata,
                        isProcessing: false,
                        hasProgress: false,
                    };

                    // Update current library tracking
                    currentLibrary = currentLibrary.map(item =>
                        item.id === bookId ? finalItem : item
                    );

                    setLibrary((prev) =>
                        prev.map((item) =>
                            item.id === bookId ? finalItem : item
                        )
                    );

                    importedFiles.push(result.metadata.title);
                    console.log(`[Import] Complete: ${result.metadata.title}`);
                    console.log(`[Import] Stats: ${result.metadata.chapterCount} chapters, ${result.metadata.stats.totalLength} chars`);
                } else {
                    setLibrary((prev) =>
                        prev.map((item) =>
                            item.id === bookId
                                ? {
                                    ...item,
                                    isProcessing: false,
                                    isError: true,
                                    errorMsg: result.error || 'Import failed',
                                }
                                : item
                        )
                    );
                }
            } catch (err: any) {
                console.error(`[Import] Error for ${file.name}:`, err);

                setLibrary((prev) =>
                    prev.map((item) =>
                        item.id === bookId
                            ? {
                                ...item,
                                isProcessing: false,
                                isError: true,
                                errorMsg: err.message || 'Unknown error',
                            }
                            : item
                    )
                );
            }
        }

        // Show summary if multiple files were processed
        if (files.length > 1) {
            const summary = [];
            if (importedFiles.length > 0) {
                summary.push(`Imported: ${importedFiles.length} book(s)`);
            }
            if (skippedFiles.length > 0) {
                summary.push(`Skipped: ${skippedFiles.length}`);
            }
            if (summary.length > 0) {
                console.log(`[Import Summary] ${summary.join(', ')}`);
            }
        }

        setIsImporting(false);
        e.target.value = '';
    }, [library, findDuplicateInLibrary]);

    const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!window.confirm('Delete this book?')) return;

        clearBookCache(id);
        setLibrary((prev) => prev.filter((item) => item.id !== id));
        await AppStorage.deleteLnData(id);
    }, []);

    const handleMultiDelete = useCallback(async () => {
        if (selectedIds.size === 0) return;

        const count = selectedIds.size;
        if (!window.confirm(`Delete ${count} selected book${count > 1 ? 's' : ''}?`)) return;

        // Delete all selected books
        for (const id of selectedIds) {
            clearBookCache(id);
            await AppStorage.deleteLnData(id);
        }

        setLibrary((prev) => prev.filter((item) => !selectedIds.has(item.id)));
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    }, [selectedIds]);

    const handleToggleSelect = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        const allIds = library.filter(item => !item.isProcessing).map(item => item.id);
        setSelectedIds(new Set(allIds));
    }, [library]);

    const handleCancelSelection = useCallback(() => {
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    }, []);

    const handleLongPress = useCallback((id: string) => {
        setIsSelectionMode(true);
        setSelectedIds(new Set([id]));
    }, []);

    const handleOpen = useCallback((id: string) => {
        navigate(AppRoutes.ln.childRoutes.reader.path(id));
    }, [navigate]);

    useAppTitle('Light Novels');

    const appAction = useMemo(
        () => (
            <Stack direction="row" spacing={1} alignItems="center">
                {isSelectionMode ? (
                    <>
                        <Typography variant="body2" sx={{ color: 'inherit' }}>
                            {selectedIds.size} selected
                        </Typography>
                        <Button
                            color="inherit"
                            onClick={handleSelectAll}
                            size="small"
                            sx={{ textTransform: 'none', minWidth: 'auto' }}
                        >
                            All
                        </Button>
                        <IconButton
                            color="inherit"
                            onClick={handleMultiDelete}
                            disabled={selectedIds.size === 0}
                            size="small"
                        >
                            <DeleteIcon />
                        </IconButton>
                        <Button
                            color="inherit"
                            onClick={handleCancelSelection}
                            size="small"
                            sx={{ textTransform: 'none', minWidth: 'auto' }}
                        >
                            Cancel
                        </Button>
                    </>
                ) : (
                    <>
                        {/* Add Multi-Select Button here */}
                        {library.length > 0 && (
                            <IconButton
                                color="inherit"
                                onClick={() => setIsSelectionMode(true)}
                                size="small"
                                sx={{ mr: 1 }}
                            >
                                <LibraryAddCheckIcon />
                            </IconButton>
                        )}
                        <Button
                            color="inherit"
                            component="label"
                            startIcon={<UploadFileIcon />}
                            disabled={isImporting}
                            sx={{ textTransform: 'none' }}
                        >
                            {isImporting ? 'Importing...' : 'Import EPUB'}
                            <input type="file" accept=".epub" multiple hidden onChange={handleImport} />
                        </Button>
                    </>
                )}
            </Stack>
        ),
        [handleImport, isImporting, isSelectionMode, selectedIds.size, handleMultiDelete, handleSelectAll, handleCancelSelection, library.length]
    );

    useAppAction(appAction, [appAction]);

    return (
        <Box sx={{ p: 1 }}>
            {library.length === 0 && !isImporting && (
                <Typography variant="body1" color="text.secondary" align="center" sx={{ mt: 10 }}>
                    No books found. Import an EPUB to start reading.
                </Typography>
            )}

            <Box
                ref={gridWrapperRef}
                sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
                    gap: 1,
                }}
            >
                {library.map((item) => (
                    <Box key={item.id}>
                        <LNLibraryCard
                            item={item}
                            onOpen={handleOpen}
                            onDelete={handleDelete}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedIds.has(item.id)}
                            onToggleSelect={handleToggleSelect}
                            onLongPress={handleLongPress}
                        />
                    </Box>
                ))}
            </Box>
        </Box>
    );
};