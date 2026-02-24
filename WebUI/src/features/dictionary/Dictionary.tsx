import { useCallback, useEffect, useState, useMemo } from 'react';
import {
    Box,
    TextField,
    IconButton,
    Typography,
    Paper,
    Fade,
    CircularProgress,
    Stack,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import TranslateIcon from '@mui/icons-material/Translate';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DictionaryResult } from '@/Manatan/types';
import { DictionaryView } from '@/Manatan/components/DictionaryView';
import { useOCR } from '@/Manatan/context/OCRContext';
import { cleanPunctuation, lookupYomitan } from '@/Manatan/utils/api';
import { buildScopedCustomCss } from '@/Manatan/utils/customCss';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle';

const getLookupTextFromHref = (href: string, fallback: string) => {
    const safeFallback = fallback.trim();
    if (!href) return safeFallback;
    const trimmedHref = href.trim();
    if (!trimmedHref) return safeFallback;
    const extractQuery = (params: URLSearchParams) =>
        params.get('query') || params.get('text') || params.get('term') || params.get('q') || '';
    if (trimmedHref.startsWith('http://') || trimmedHref.startsWith('https://')) {
        try {
            const parsed = new URL(trimmedHref);
            const queryText = extractQuery(parsed.searchParams);
            if (queryText) return queryText;
        } catch (err) {
            console.warn('Failed to parse http link', err);
        }
        return safeFallback;
    }
    if (trimmedHref.startsWith('?') || trimmedHref.includes('?')) {
        const queryString = trimmedHref.startsWith('?') ? trimmedHref.slice(1) : trimmedHref.slice(trimmedHref.indexOf('?') + 1);
        const params = new URLSearchParams(queryString);
        const queryText = extractQuery(params);
        if (queryText) return queryText;
    }
    if (trimmedHref.startsWith('#')) return safeFallback;
    try {
        if (trimmedHref.startsWith('term://')) return decodeURIComponent(trimmedHref.slice('term://'.length));
        if (trimmedHref.startsWith('yomitan://')) {
            const parsed = new URL(trimmedHref);
            return extractQuery(parsed.searchParams) || decodeURIComponent(parsed.pathname.replace(/^\//, '')) || safeFallback;
        }
    } catch (err) {
        console.warn('Failed to parse yomitan link', err);
    }
    try {
        return decodeURIComponent(trimmedHref);
    } catch (err) {
        return safeFallback || trimmedHref;
    }
};

interface LookupHistoryEntry {
    term: string;
    results: DictionaryResult[];
    isLoading: boolean;
    systemLoading: boolean;
}

export const Dictionary = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<DictionaryResult[]>([]);
    const [kanjiResults, setKanjiResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const { settings } = useOCR();
    const muiTheme = useTheme();

    // History state
    const [history, setHistory] = useState<LookupHistoryEntry[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    useAppTitle('Dictionary');

    // Configuration from settings (with defaults)
    const maxHistory = settings.yomitanLookupMaxHistory || 10;
    const navMode = settings.yomitanLookupNavigationMode || 'stacked'; // 'stacked' or 'tabs'

    const customCss = useMemo(
        () => settings.yomitanPopupCustomCss?.trim() || '',
        [settings.yomitanPopupCustomCss],
    );

    const currentEntry = historyIndex >= 0 && historyIndex < history.length ? history[historyIndex] : null;
    const displayResults = currentEntry ? currentEntry.results : results;
    const displayIsLoading = currentEntry ? currentEntry.isLoading : isLoading;
    const displaySystemLoading = currentEntry ? currentEntry.systemLoading : false;

    const handleSearch = useCallback(async (term: string, isFromHistory: boolean = false) => {
        if (!term.trim()) return;
        
        if (!isFromHistory) {
            setIsLoading(true);
            setHasSearched(true);
        }

        const res = await lookupYomitan(
            cleanPunctuation(term, true),
            0,
            settings.resultGroupingMode || 'grouped',
            settings.yomitanLanguage || 'japanese'
        );
        
        console.log('[Dictionary] Raw lookup result:', JSON.stringify(res, null, 2));
        
        const loadedResults = res === 'loading' ? [] : (res as any).terms || res;
        const loadedKanji = res === 'loading' ? [] : (res as any).kanji || [];
        const isSystemLoading = res === 'loading';

        setKanjiResults(loadedKanji);

        if (!isFromHistory) {
            setResults(loadedResults);
            setIsLoading(false);
        }

        return { results: loadedResults, isSystemLoading };
    }, [settings.resultGroupingMode, settings.yomitanLanguage]);

    // Debounced search for text input
    useEffect(() => {
        const trimmed = searchTerm.trim();
        if (!trimmed) {
            setIsLoading(false);
            setResults([]);
            setHasSearched(false);
            setHistory([]);
            setHistoryIndex(-1);
            return;
        }

        const timeout = setTimeout(async () => {
            const result = await handleSearch(trimmed);
            if (result) {
                // Initialize history with first search
                const term = result.results[0]?.headword || trimmed;
                setHistory([{ term, results: result.results, isLoading: false, systemLoading: result.isSystemLoading }]);
                setHistoryIndex(0);
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [searchTerm, handleSearch]);

    const handleLinkClick = useCallback(async (href: string, text: string) => {
        const newTerm = getLookupTextFromHref(href, text);
        const cleanText = cleanPunctuation(newTerm, true).trim();
        if (!cleanText) return;

        // Update search term to show in input
        setSearchTerm(newTerm);

        // Create new history entry
        const newEntry: LookupHistoryEntry = { 
            term: cleanText, 
            results: [], 
            isLoading: true, 
            systemLoading: false 
        };

        // Add to history based on navigation mode
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(newEntry);
            if (newHistory.length > maxHistory) newHistory.shift();
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, maxHistory - 1));

        // Perform lookup
        try {
            const result = await handleSearch(cleanText, true);
            if (result) {
                setHistory(prev => {
                    const newHistory = [...prev];
                    const idx = Math.min(historyIndex + 1, maxHistory - 1);
                    if (newHistory[idx]) {
                        const matchedTerm = result.results[0]?.headword || cleanText;
                        newHistory[idx] = { 
                            term: matchedTerm, 
                            results: result.results, 
                            isLoading: false, 
                            systemLoading: result.isSystemLoading 
                        };
                    }
                    return newHistory;
                });
            }
        } catch (err) {
            console.warn('Failed to lookup link definition', err);
            setHistory(prev => {
                const newHistory = [...prev];
                const idx = Math.min(historyIndex + 1, maxHistory - 1);
                if (newHistory[idx]) {
                    newHistory[idx] = { ...newHistory[idx], results: [], isLoading: false, systemLoading: false };
                }
                return newHistory;
            });
        }
    }, [historyIndex, maxHistory, handleSearch]);

    const handleWordClick = useCallback(async (text: string, position: number) => {
        const cleanText = cleanPunctuation(text, true).trim();
        if (!cleanText) return;

        const textEncoder = new TextEncoder();
        const prefixBytes = textEncoder.encode(text.slice(0, position)).length;

        // Create new history entry
        const newEntry: LookupHistoryEntry = { 
            term: cleanText, 
            results: [], 
            isLoading: true, 
            systemLoading: false 
        };

        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(newEntry);
            if (newHistory.length > maxHistory) newHistory.shift();
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, maxHistory - 1));

        // Perform lookup with position
        try {
            const res = await lookupYomitan(
                cleanText,
                prefixBytes,
                settings.resultGroupingMode || 'grouped',
                settings.yomitanLanguage || 'japanese'
            );
            const loadedResults = res === 'loading' ? [] : (res as any).terms || res || [];
            const loadedKanji = res === 'loading' ? [] : (res as any).kanji || [];
            const isSystemLoading = res === 'loading';
            
            setKanjiResults(loadedKanji);

            setHistory(prev => {
                const newHistory = [...prev];
                const idx = Math.min(historyIndex + 1, maxHistory - 1);
                if (newHistory[idx]) {
                    const matchedTerm = loadedResults[0]?.headword || cleanText;
                    newHistory[idx] = { 
                        term: matchedTerm, 
                        results: loadedResults, 
                        isLoading: false, 
                        systemLoading: isSystemLoading 
                    };
                }
                return newHistory;
            });
        } catch (err) {
            console.warn('Failed to lookup word', err);
            setHistory(prev => {
                const newHistory = [...prev];
                const idx = Math.min(historyIndex + 1, maxHistory - 1);
                if (newHistory[idx]) {
                    newHistory[idx] = { ...newHistory[idx], results: [], isLoading: false, systemLoading: false };
                }
                return newHistory;
            });
        }
    }, [historyIndex, maxHistory, settings.resultGroupingMode, settings.yomitanLanguage]);

    const navigateToHistory = useCallback((index: number) => {
        if (index >= 0 && index < history.length) {
            setHistoryIndex(index);
            setSearchTerm(history[index].term);
        }
    }, [history]);

    const goBack = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
            setSearchTerm(history[historyIndex - 1].term);
        }
    }, [historyIndex, history]);

    const handleClear = () => {
        setSearchTerm('');
        setResults([]);
        setHasSearched(false);
        setHistory([]);
        setHistoryIndex(-1);
    };

    const renderHistoryNav = () => {
        if (navMode === 'tabs' && history.length > 1) {
            return (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
                    {history.map((entry, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {i > 0 && (
                                <Typography sx={{ color: 'text.secondary', fontSize: '0.7em', px: 0.5 }}>
                                    →
                                </Typography>
                            )}
                            <Box
                                component="button"
                                onClick={() => navigateToHistory(i)}
                                sx={{
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: 1,
                                    border: 'none',
                                    background: i === historyIndex 
                                        ? muiTheme.palette.primary.main 
                                        : alpha(muiTheme.palette.primary.main, 0.1),
                                    color: i === historyIndex 
                                        ? muiTheme.palette.primary.contrastText 
                                        : muiTheme.palette.text.primary,
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    maxWidth: '120px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        background: i === historyIndex 
                                            ? muiTheme.palette.primary.dark 
                                            : alpha(muiTheme.palette.primary.main, 0.2),
                                    }
                                }}
                                title={entry.term}
                            >
                                {entry.term.slice(0, 12)}
                                {entry.term.length > 12 ? '...' : ''}
                            </Box>
                        </Box>
                    ))}
                </Box>
            );
        } else if (navMode === 'stacked' && historyIndex > 0) {
            return (
                <Box sx={{ mb: 2 }}>
                    <Box
                        component="button"
                        onClick={goBack}
                        sx={{
                            px: 2,
                            py: 1,
                            borderRadius: 1,
                            border: 'none',
                            background: muiTheme.palette.primary.main,
                            color: muiTheme.palette.primary.contrastText,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            transition: 'all 0.2s',
                            '&:hover': {
                                background: muiTheme.palette.primary.dark,
                            }
                        }}
                    >
                        <ArrowBackIcon sx={{ fontSize: 18 }} />
                        Back
                    </Box>
                </Box>
            );
        }
        return null;
    };

    return (
        <>
            {customCss && <style>{customCss}</style>}
            <div
                style={{
                    height: '100%',
                    minHeight: 'calc(100vh - 64px)',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
            {/* Header / Search Bar */}
            <Box
                sx={{
                    p: 3,
                    borderBottom: `1px solid ${muiTheme.palette.divider}`,
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                }}
            >
                <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                        fullWidth
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                                if (typeof window !== 'undefined' && (window as any).ManatanNative?.hideKeyboard) {
                                    (window as any).ManatanNative.hideKeyboard();
                                }
                            }
                        }}
                        placeholder="Search..."
                        autoFocus
                        size="medium"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: muiTheme.palette.background.paper,
                                color: muiTheme.palette.text.primary,
                                borderRadius: '12px',
                                transition: 'all 0.2s ease',
                                '&:hover fieldset': {
                                    borderColor: muiTheme.palette.divider,
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: muiTheme.palette.primary.main,
                                    borderWidth: '2px',
                                },
                            },
                            '& .MuiInputBase-input': {
                                fontSize: '1.1rem',
                                padding: '14px 16px',
                            },
                        }}
                        InputProps={{
                            startAdornment: (
                                <SearchIcon sx={{ mr: 1, color: 'text.secondary', opacity: 0.7, ml: 1 }} />
                            ),
                            endAdornment: (
                                <Box sx={{ display: 'flex', gap: 0.5, mr: 1 }}>
                                    {searchTerm && (
                                        <IconButton
                                            size="small"
                                            onClick={handleClear}
                                            sx={{ color: 'text.secondary', opacity: 0.7, '&:hover': { opacity: 1 } }}
                                        >
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Box>
                            ),
                        }}
                    />
                </Stack>
            </Box>

            {/* Content */}
            <Box
                sx={{
                    flex: 1,
                    overflow: 'auto',
                    p: { xs: 2, sm: 3, md: 4 },
                }}
            >
                {/* Empty State */}
                <Fade in={!displayIsLoading && !hasSearched} timeout={300} mountOnEnter unmountOnExit>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '50vh',
                            opacity: 0.6,
                        }}
                    >
                        <TranslateIcon sx={{ fontSize: 80, mb: 3, opacity: 0.3 }} />
                        <Typography variant="h4" sx={{ mb: 1, fontWeight: 300, letterSpacing: '-0.5px' }}>
                            Dictionary
                        </Typography>
                        <Typography variant="body1" sx={{ opacity: 0.7, textAlign: 'center', maxWidth: 400 }}>
                            Enter text above to search your imported dictionaries
                        </Typography>
                    </Box>
                </Fade>

                {/* Loading State */}
                <Fade in={displayIsLoading} timeout={200} mountOnEnter unmountOnExit>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '30vh',
                        }}
                    >
                        <CircularProgress size={40} thickness={4} sx={{ mb: 2, color: 'primary.main' }} />
                        <Typography variant="body1" sx={{ opacity: 0.8 }}>Searching dictionary...</Typography>
                    </Box>
                </Fade>

                {/* Results */}
                <Fade in={!displayIsLoading && hasSearched} timeout={300}>
                    <Box sx={{ display: !displayIsLoading && hasSearched ? 'block' : 'none' }}>
                        {displayResults.length > 0 ? (
                            <Box>
                                {renderHistoryNav()}
                                <Paper
                                    elevation={0}
                                    className={muiTheme.palette.mode === 'dark' ? 'yomitan-popup-dark' : 'yomitan-popup-light'}
                                    sx={{
                                        maxWidth: 900,
                                        mx: 'auto',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '16px',
                                        border: `1px solid ${muiTheme.palette.divider}`,
                                        overflow: 'hidden',
                                        p: { xs: 2, sm: 3 },
                                    }}
                                >
                                    <DictionaryView
                                        results={displayResults}
                                        isLoading={displayIsLoading}
                                        systemLoading={displaySystemLoading}
                                        onLinkClick={handleLinkClick}
                                        onWordClick={handleWordClick}
                                        kanjiResults={kanjiResults}
                                    />
                                </Paper>
                            </Box>
                        ) : (
                            /* No Results State */
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: '30vh',
                                    opacity: 0.7,
                                }}
                            >
                                <Typography variant="h5" sx={{ mb: 1, fontWeight: 400 }}>
                                    No Results Found
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.7, textAlign: 'center' }}>
                                    Try checking your spelling or search with different terms
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Fade>
            </Box>
        </div>
        </>
    );
};