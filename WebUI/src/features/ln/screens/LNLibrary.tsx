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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    FormControl,
    Select,
    Tabs,
    Tab,
    TextField,
    InputLabel,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LibraryAddCheckIcon from '@mui/icons-material/LibraryAddCheck';
import SortIcon from '@mui/icons-material/Sort';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import CategoryIcon from '@mui/icons-material/Category';
import { styled } from '@mui/material/styles';

import { AppStorage, LNMetadata, LnCategory, LnCategoryMetadata } from '@/lib/storage/AppStorage';
import { AppRoutes } from '@/base/AppRoute.constants';
import { parseEpub, ParseProgress } from '../services/epubParser';
import { clearBookCache } from '../reader/hooks/useBookContent';
import { LNCategoriesService, LnSortMode, LnSortModeType } from '../services/LNCategories';

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

// --- Types ---

interface LibraryItem extends LNMetadata {
    importProgress?: number;
    importMessage?: string;
    lastRead?: number;
    totalProgress?: number;
}

// --- Styled Components ---

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

// --- Helper Components ---

type LNLibraryCardProps = {
    item: LibraryItem;
    onOpen: (id: string) => void;
    onDelete: (id: string, event: React.MouseEvent) => void;
    onEdit: (item: LibraryItem) => void;
    isSelectionMode: boolean;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
    onLongPress: (id: string) => void;
};

const LNLibraryCard = ({ item, onOpen, onDelete, onEdit, isSelectionMode, isSelected, onToggleSelect, onLongPress }: LNLibraryCardProps) => {
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
                                                        color: 'primary.contrastText',
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
                                                        component="span"
                                                        {...MUIUtil.preventRippleProp(bindTrigger(popupState), {
                                                            onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
                                                                event.stopPropagation();
                                                                event.preventDefault();
                                                                popupState.open();
                                                            },
                                                        })}
                                                        aria-label="Options"
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
                                <>
                                    <MenuItem
                                        onClick={(event: React.MouseEvent<HTMLElement>) => {
                                            onClose();
                                            onEdit(item);
                                        }}
                                    >
                                        <ListItemIcon>
                                            <EditIcon fontSize="small" />
                                        </ListItemIcon>
                                        Edit
                                    </MenuItem>
                                    <MenuItem
                                        onClick={(event: React.MouseEvent<HTMLElement>) => {
                                            onClose();
                                            onDelete(item.id, event);
                                        }}
                                    >
                                        <ListItemIcon>
                                            <DeleteIcon fontSize="small" />
                                        </ListItemIcon>
                                        Delete
                                    </MenuItem>
                                </>
                            )}
                        </Menu>
                    )}
                </>
            )}
        </PopupState>
    );
};

// --- Main Component ---

export const LNLibrary: React.FC = () => {
    const navigate = useNavigate();
    const [library, setLibrary] = useState<LibraryItem[]>([]);
    const [allBooks, setAllBooks] = useState<LibraryItem[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    // Category state
    const [categories, setCategories] = useState<LnCategory[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>(LNCategoriesService.getAllCategoryId());
    const [categoryMetadata, setCategoryMetadata] = useState<Record<string, LnCategoryMetadata>>({});
    const [currentSort, setCurrentSort] = useState<LnCategoryMetadata>({ sortBy: 'dateAdded', sortDesc: true });

    // Dialog states
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmOptions, setConfirmOptions] = useState<{ title: string; message: string; confirmText?: string; cancelText?: string }>({
        title: '',
        message: ''
    });
    const confirmResolver = useRef<((value: boolean) => void) | null>(null);

    // Edit dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
    const [editForm, setEditForm] = useState({ title: '', author: '', language: '', categoryIds: [] as string[] });

    // Add category dialog state
    const [addCategoryDialogOpen, setAddCategoryDialogOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const { navBarWidth } = useNavBarContext();
    const { settings: { mangaGridItemWidth } } = useMetadataServerSettings();

    const gridWrapperRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState(
        gridWrapperRef.current?.offsetWidth ?? Math.max(0, document.documentElement.offsetWidth - navBarWidth)
    );

    // Helper to show confirm dialog as a Promise (replacing window.confirm)
    const confirm = useCallback((title: string, message: string, confirmText = 'Confirm', cancelText = 'Cancel'): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmOptions({ title, message, confirmText, cancelText });
            setConfirmOpen(true);
            confirmResolver.current = resolve;
        });
    }, []);

    const handleConfirmClose = (result: boolean) => {
        setConfirmOpen(false);
        if (confirmResolver.current) {
            confirmResolver.current(result);
            confirmResolver.current = null;
        }
    };

    // Load categories and metadata
    const loadCategories = useCallback(async () => {
        const cats = await LNCategoriesService.getCategories();
        setCategories(cats);
        const meta = await LNCategoriesService.getAllCategoryMetadata();
        setCategoryMetadata(meta);
    }, []);

    // Load sort settings for current category
    const loadSortSettings = useCallback(async () => {
        const sort = await LNCategoriesService.getCategoryMetadata(selectedCategoryId);
        setCurrentSort(sort);
    }, [selectedCategoryId]);

    // Filter and sort books
    const filterAndSortBooks = useCallback((books: LibraryItem[], categoryId: string, sort: LnCategoryMetadata): LibraryItem[] => {
        let filtered = books;

        // Filter by category
        if (!LNCategoriesService.isAllCategory(categoryId)) {
            filtered = filtered.filter(book => book.categoryIds?.includes(categoryId));
        }

        // Sort
        const compareFn = LNCategoriesService.compareFn(
            filtered.map(book => ({ metadata: book, progress: {} })),
            sort.sortBy as LnSortModeType,
            sort.sortDesc
        );

        return [...filtered].sort((a, b) => {
            const multiplier = sort.sortDesc ? -1 : 1;
            switch (sort.sortBy) {
                case LnSortMode.DATE_ADDED:
                    return multiplier * (b.addedAt - a.addedAt);
                case LnSortMode.TITLE:
                    return multiplier * ((a.title || '').localeCompare(b.title || ''));
                case LnSortMode.AUTHOR:
                    return multiplier * ((a.author || '').localeCompare(b.author || ''));
                case LnSortMode.LENGTH:
                    // For length: sortDesc=true (longer first), sortDesc=false (shorter first)
                    return multiplier * ((a.stats?.totalLength || 0) - (b.stats?.totalLength || 0));
                case LnSortMode.LANGUAGE:
                    return multiplier * ((a.language || 'unknown') > (b.language || 'unknown') ? 1 : -1);
                case LnSortMode.LAST_READ:
                    return multiplier * ((b.lastRead || 0) - (a.lastRead || 0));
                case LnSortMode.PROGRESS:
                    return multiplier * ((b.totalProgress || 0) - (a.totalProgress || 0));
                default:
                    return multiplier * (b.addedAt - a.addedAt);
            }
        });
    }, []);

    useEffect(() => {
        const init = async () => {
            await AppStorage.migrateLnMetadata();
            await loadCategories();
            await loadLibrary();
        };
        init();
    }, [loadCategories, loadLibrary]);

    // Reload library when tab becomes visible again (handles browser suspending connections after long background time)
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                await loadLibrary();
                await loadCategories();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [loadLibrary, loadCategories]);

    useEffect(() => {
        loadSortSettings();
    }, [selectedCategoryId, loadSortSettings]);

    useEffect(() => {
        const filtered = filterAndSortBooks(allBooks, selectedCategoryId, currentSort);
        setLibrary(filtered);
    }, [allBooks, selectedCategoryId, currentSort, filterAndSortBooks]);

    useResizeObserver(
        gridWrapperRef,
        useCallback(() => {
            const gridWidth = gridWrapperRef.current?.offsetWidth;
            setDimensions(gridWidth ?? document.documentElement.offsetWidth - navBarWidth);
        }, [navBarWidth])
    );

    const gridColumns = Math.max(1, Math.ceil(dimensions / mangaGridItemWidth));

    const loadLibrary = useCallback(async () => {
        try {
            const keys = await AppStorage.lnMetadata.keys();
            const items: LibraryItem[] = [];

            for (const key of keys) {
                const metadata = await AppStorage.lnMetadata.getItem<LNMetadata>(key);
                if (metadata) {
                    const progress = await AppStorage.lnProgress.getItem(key);
                    items.push({
                        ...metadata,
                        hasProgress: !!progress,
                        lastRead: progress?.lastRead,
                        totalProgress: progress?.totalProgress,
                    } as LibraryItem & { lastRead?: number; totalProgress?: number });
                }
            }

            setAllBooks(items);
        } catch (e) {
            console.error('Failed to load library:', e);
        }
    }, []);

    // Normalize title for comparison
    const normalizeTitle = (title: string): string => {
        return title
            .toLowerCase()
            .replace(/\.epub$/i, '')
            .replace(/[^\p{L}\p{N}\s]/gu, '') // Unicode-aware
            .replace(/\s+/g, ' ')
            .trim();
    };

    const findDuplicateInLibrary = useCallback((title: string, currentLibrary: LibraryItem[]): LibraryItem | undefined => {
        const normalizedTitle = normalizeTitle(title);
        return currentLibrary.find(item =>
            !item.isProcessing && normalizeTitle(item.title) === normalizedTitle
        );
    }, []);

    const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement> | { target: { files: File[]; value: string } }) => {
        if (!e.target.files?.length) return;

        const files = Array.from(e.target.files);
        setIsImporting(true);

        const skippedFiles: string[] = [];
        const importedFiles: string[] = [];

        let currentLibrary = [...library];

        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const file = files[fileIndex];
            const fileTitle = file.name.replace(/\.epub$/i, '');

            const existingBook = findDuplicateInLibrary(fileTitle, currentLibrary);

            if (existingBook) {
                const shouldReplace = await confirm(
                    'Duplicate File',
                    `"${existingBook.title}" already exists in your library.\n\nDo you want to replace it?`,
                    'Replace',
                    'Skip'
                );

                if (!shouldReplace) {
                    skippedFiles.push(file.name);
                    continue;
                }

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
                toc: [],
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
                    const metadataTitle = result.metadata.title;
                    const duplicateByMetadata = findDuplicateInLibrary(metadataTitle, currentLibrary.filter(i => i.id !== bookId));

                    if (duplicateByMetadata) {
                        const shouldReplace = await confirm(
                            'Duplicate Metadata',
                            `The book "${metadataTitle}" already exists in your library (detected from EPUB metadata).\n\nDo you want to replace it?`,
                            'Replace',
                            'Skip'
                        );

                        if (!shouldReplace) {
                            currentLibrary = currentLibrary.filter(item => item.id !== bookId);
                            setLibrary(prev => prev.filter(item => item.id !== bookId));
                            skippedFiles.push(file.name);
                            continue;
                        }

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

        setIsImporting(false);
        e.target.value = '';
    }, [library, findDuplicateInLibrary, confirm]);

    const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();

        const shouldDelete = await confirm('Delete Book', 'Are you sure you want to delete this book? This cannot be undone.', 'Delete');
        if (!shouldDelete) return;

        clearBookCache(id);
        setLibrary((prev) => prev.filter((item) => item.id !== id));
        setAllBooks((prev) => prev.filter((item) => item.id !== id));
        await AppStorage.deleteLnData(id);
    }, [confirm]);

    const handleEdit = useCallback((item: LibraryItem) => {
        setEditingItem(item);
        setEditForm({
            title: item.title,
            author: item.author,
            language: item.language || 'unknown',
            categoryIds: item.categoryIds || [],
        });
        setEditDialogOpen(true);
    }, []);

    const handleEditSave = useCallback(async () => {
        if (!editingItem) return;

        const updates: Partial<LNMetadata> = {
            title: editForm.title,
            author: editForm.author,
            language: editForm.language,
            categoryIds: editForm.categoryIds,
        };

        await AppStorage.updateLnMetadata(editingItem.id, updates);

        setAllBooks((prev) =>
            prev.map((item) =>
                item.id === editingItem.id ? { ...item, ...updates } : item
            )
        );

        setEditDialogOpen(false);
        setEditingItem(null);
    }, [editingItem, editForm]);

    const handleMultiDelete = useCallback(async () => {
        if (selectedIds.size === 0) return;

        const count = selectedIds.size;
        const shouldDelete = await confirm(
            'Delete Selected',
            `Are you sure you want to delete ${count} selected book${count > 1 ? 's' : ''}?`,
            'Delete'
        );

        if (!shouldDelete) return;

        for (const id of selectedIds) {
            clearBookCache(id);
            await AppStorage.deleteLnData(id);
        }

        setLibrary((prev) => prev.filter((item) => !selectedIds.has(item.id)));
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    }, [selectedIds, confirm]);

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

    // Drag and Drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only hide overlay if leaving the main container
        if (e.currentTarget === e.target) {
            setIsDragOver(false);
        }
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        const epubFiles = files.filter(file => 
            file.name.toLowerCase().endsWith('.epub') || 
            file.type === 'application/epub+zip'
        );

        if (epubFiles.length === 0) return;

        // Simulate input change event to reuse existing import logic
        const mockEvent = {
            target: {
                files: epubFiles,
                value: '',
            }
        } as any;

        await handleImport(mockEvent);
    }, [handleImport]);

    const handleSortChange = useCallback(async (newSortBy: LnSortModeType) => {
        const newSort = { ...currentSort };
        if (currentSort.sortBy === newSortBy) {
            newSort.sortDesc = !newSort.sortDesc;
        } else {
            newSort.sortBy = newSortBy;
            newSort.sortDesc = getDefaultSortDesc(newSortBy);
        }
        setCurrentSort(newSort);
        await LNCategoriesService.setCategoryMetadata(selectedCategoryId, newSort);
    }, [currentSort, selectedCategoryId]);

    const handleCategoryChange = useCallback((categoryId: string) => {
        if (categoryId === '__add__') {
            setAddCategoryDialogOpen(true);
            return;
        }
        setSelectedCategoryId(categoryId);
    }, []);

    const handleCreateCategory = useCallback(async () => {
        if (newCategoryName.trim()) {
            await LNCategoriesService.createCategory(newCategoryName.trim());
            await loadCategories();
            setNewCategoryName('');
            setAddCategoryDialogOpen(false);
        }
    }, [newCategoryName]);

    const getSortLabel = (sortBy: string): string => {
        const labels: Record<string, string> = {
            dateAdded: 'Date Added',
            title: 'Title',
            author: 'Author',
            length: 'Length',
            language: 'Language',
            lastRead: 'Last Read',
            progress: 'Progress',
        };
        return labels[sortBy] || sortBy;
    };

    // Get default sort direction for each sort type
    const getDefaultSortDesc = (sortBy: string): boolean => {
        switch (sortBy) {
            case LnSortMode.TITLE:
            case LnSortMode.AUTHOR:
            case LnSortMode.LANGUAGE:
                return false; // A to Z (ascending)
            case LnSortMode.LENGTH:
                return true; // Long to short (descending)
            case LnSortMode.DATE_ADDED:
            case LnSortMode.LAST_READ:
            case LnSortMode.PROGRESS:
            default:
                return true; // Newest/most first (descending)
        }
    };

    // Toggle sort direction
    const handleToggleSortDirection = useCallback(async () => {
        const newSort = { ...currentSort, sortDesc: !currentSort.sortDesc };
        setCurrentSort(newSort);
        await LNCategoriesService.setCategoryMetadata(selectedCategoryId, newSort);
    }, [currentSort, selectedCategoryId]);

    useAppTitle('Novels', 'Novel');

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
                        <PopupState variant="popover" popupId="sort-menu">
                            {(popupState) => (
                                <>
                                    <CustomTooltip title="Sort">
                                        <IconButton
                                            color="inherit"
                                            {...bindTrigger(popupState)}
                                            size="small"
                                        >
                                            <SortIcon />
                                            <Typography sx={{ fontWeight: 'bold', fontSize: 12, ml: 0.25 }}>
                                                {currentSort.sortDesc ? '↓' : '↑'}
                                            </Typography>
                                        </IconButton>
                                    </CustomTooltip>
                                    <Menu {...bindMenu(popupState)}>
                                        {(onClose) => (
                                            <>
                                                <MenuItem
                                                    selected={currentSort.sortBy === 'dateAdded'}
                                                    onClick={() => { handleSortChange('dateAdded'); onClose(); }}
                                                >
                                                    Date Added {currentSort.sortBy === 'dateAdded' && (currentSort.sortDesc ? '↓' : '↑')}
                                                </MenuItem>
                                                <MenuItem
                                                    selected={currentSort.sortBy === 'title'}
                                                    onClick={() => { handleSortChange('title'); onClose(); }}
                                                >
                                                    Title {currentSort.sortBy === 'title' && (currentSort.sortDesc ? '↓' : '↑')}
                                                </MenuItem>
                                                <MenuItem
                                                    selected={currentSort.sortBy === 'author'}
                                                    onClick={() => { handleSortChange('author'); onClose(); }}
                                                >
                                                    Author {currentSort.sortBy === 'author' && (currentSort.sortDesc ? '↓' : '↑')}
                                                </MenuItem>
                                                <MenuItem
                                                    selected={currentSort.sortBy === 'length'}
                                                    onClick={() => { handleSortChange('length'); onClose(); }}
                                                >
                                                    Length {currentSort.sortBy === 'length' && (currentSort.sortDesc ? '↓' : '↑')}
                                                </MenuItem>
                                                <MenuItem
                                                    selected={currentSort.sortBy === 'language'}
                                                    onClick={() => { handleSortChange('language'); onClose(); }}
                                                >
                                                    Language {currentSort.sortBy === 'language' && (currentSort.sortDesc ? '↓' : '↑')}
                                                </MenuItem>
                                                <MenuItem
                                                    selected={currentSort.sortBy === 'lastRead'}
                                                    onClick={() => { handleSortChange('lastRead'); onClose(); }}
                                                >
                                                    Last Read {currentSort.sortBy === 'lastRead' && (currentSort.sortDesc ? '↓' : '↑')}
                                                </MenuItem>
                                                <MenuItem
                                                    selected={currentSort.sortBy === 'progress'}
                                                    onClick={() => { handleSortChange('progress'); onClose(); }}
                                                >
                                                    Progress {currentSort.sortBy === 'progress' && (currentSort.sortDesc ? '↓' : '↑')}
                                                </MenuItem>
                                            </>
                                        )}
                                    </Menu>
                                </>
                            )}
                        </PopupState>
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
        [handleImport, isImporting, isSelectionMode, selectedIds.size, handleMultiDelete, handleSelectAll, handleCancelSelection, library.length, currentSort.sortBy, handleSortChange]
    );

    useAppAction(appAction, [appAction]);

    return (
        <Box 
            sx={{ p: 1, position: 'relative', minHeight: '100vh' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag overlay */}
            {isDragOver && (
                <Box
                    sx={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        pointerEvents: 'none',
                    }}
                >
                    <Box sx={{ textAlign: 'center', color: 'white' }}>
                        <UploadFileIcon sx={{ fontSize: 64, mb: 2 }} />
                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                            Drop EPUB files to import
                        </Typography>
                    </Box>
                </Box>
            )}

            {/* Category Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
                <Tabs
                    value={selectedCategoryId}
                    onChange={(_, newValue) => handleCategoryChange(newValue)}
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    <Tab
                        label="All"
                        value={LNCategoriesService.getAllCategoryId()}
                        icon={<CategoryIcon />}
                        iconPosition="start"
                    />
                    {categories.map((category) => (
                        <Tab
                            key={category.id}
                            label={category.name}
                            value={category.id}
                        />
                    ))}
                    <Tab
                        label="Add"
                        value="__add__"
                        icon={<AddIcon />}
                        iconPosition="start"
                    />
                </Tabs>
            </Box>

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
                            onEdit={handleEdit}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedIds.has(item.id)}
                            onToggleSelect={handleToggleSelect}
                            onLongPress={handleLongPress}
                        />
                    </Box>
                ))}
            </Box>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edit Book</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Title"
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            fullWidth
                        />
                        <TextField
                            label="Author"
                            value={editForm.author}
                            onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
                            fullWidth
                        />
                        <FormControl fullWidth>
                            <InputLabel>Language</InputLabel>
                            <Select
                                value={editForm.language}
                                label="Language"
                                onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                            >
                                <MenuItem value="unknown">Unknown</MenuItem>
                                <MenuItem value="ja">Japanese</MenuItem>
                                <MenuItem value="en">English</MenuItem>
                                <MenuItem value="zh">Chinese</MenuItem>
                                <MenuItem value="ko">Korean</MenuItem>
                                <MenuItem value="es">Spanish</MenuItem>
                                <MenuItem value="fr">French</MenuItem>
                                <MenuItem value="de">German</MenuItem>
                                <MenuItem value="ru">Russian</MenuItem>
                                <MenuItem value="pt">Portuguese</MenuItem>
                                <MenuItem value="it">Italian</MenuItem>
                                <MenuItem value="ar">Arabic</MenuItem>
                                <MenuItem value="other">Other</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Categories</InputLabel>
                            <Select
                                multiple
                                value={editForm.categoryIds}
                                label="Categories"
                                onChange={(e) => setEditForm({ ...editForm, categoryIds: e.target.value as string[] })}
                                renderValue={(selected) => {
                                    const selectedCats = categories.filter(c => selected.includes(c.id));
                                    return selectedCats.map(c => c.name).join(', ');
                                }}
                            >
                                {categories.map((category) => (
                                    <MenuItem key={category.id} value={category.id}>
                                        <Checkbox checked={editForm.categoryIds.includes(category.id)} />
                                        {category.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleEditSave} variant="contained">Save</Button>
                </DialogActions>
            </Dialog>

            {/* Confirmation Dialog */}
            <Dialog
                open={confirmOpen}
                onClose={() => handleConfirmClose(false)}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    {confirmOptions.title}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description" sx={{ whiteSpace: 'pre-line' }}>
                        {confirmOptions.message}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => handleConfirmClose(false)} color="inherit">
                        {confirmOptions.cancelText || 'Cancel'}
                    </Button>
                    <Button onClick={() => handleConfirmClose(true)} autoFocus color="primary">
                        {confirmOptions.confirmText || 'Confirm'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Category Dialog */}
            <Dialog
                open={addCategoryDialogOpen}
                onClose={() => setAddCategoryDialogOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Create Category</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        margin="dense"
                        label="Category Name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newCategoryName.trim()) {
                                handleCreateCategory();
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddCategoryDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateCategory}
                        disabled={!newCategoryName.trim()}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
