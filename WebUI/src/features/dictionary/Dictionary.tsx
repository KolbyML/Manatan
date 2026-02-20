import { useCallback, useEffect, useState, useRef } from 'react';
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
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle';

interface LookupHistoryEntry {
    term: string;
    results: DictionaryResult[];
    isLoading: boolean;
    systemLoading: boolean;
}

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

export const Dictionary = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<DictionaryResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [history, setHistory] = useState<LookupHistoryEntry[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isNavigatingHistory = useRef(false);
    const { settings } = useOCR();
    const muiTheme = useTheme();

    const maxHistory = settings.yomitanLookupMaxHistory || 10;
    const navMode = settings.yomitanLookupNavigationMode || 'stacked';

    const currentEntry = historyIndex >= 0 && historyIndex < history.length ? history[historyIndex] : null;

    const processedEntries = currentEntry ? currentEntry.results : results;
    const currentIsLoading = currentEntry ? currentEntry.isLoading : isLoading;
    const currentSystemLoading = currentEntry ? currentEntry.systemLoading : false;

    useAppTitle('Dictionary');

    const handleSearch = useCallback(async (term: string, addToHistory: boolean = true) => {
        if (!term.trim()) return;
        
        const cleanTerm = cleanPunctuation(term, true).trim();
        if (!cleanTerm) return;

        if (addToHistory) {
            const newEntry: LookupHistoryEntry = { term: cleanTerm, results: [], isLoading: true, systemLoading: false };
            setHistory(prev => {
                // Truncate forward history when adding new search from current position
                const newHistory = prev.slice(0, historyIndex + 1);
                newHistory.push(newEntry);
                if (newHistory.length > maxHistory) newHistory.shift();
                return newHistory;
            });
            setHistoryIndex(prev => Math.min(prev + 1, maxHistory - 1));
            setHasSearched(true);
        }
        
        setIsLoading(true);
        
        const res = await lookupYomitan(
            cleanTerm,
            0,
            settings.resultGroupingMode,
            settings.yomitanLanguage
        );
        
        const loadedResults = res === 'loading' ? [] : (res || []);
        const isSystemLoading = res === 'loading';
        
        if (addToHistory) {
            setHistory(prev => {
                const newHistory = [...prev];
                const idx = Math.min(historyIndex + 1, maxHistory - 1);
                if (newHistory[idx]) {
                    const matchedTerm = loadedResults[0]?.headword || cleanTerm;
                    newHistory[idx] = { ...newHistory[idx], term: matchedTerm, results: loadedResults, isLoading: false, systemLoading: isSystemLoading };
                }
                return newHistory;
            });
        } else {
            setResults(loadedResults);
        }
        
        setIsLoading(false);
    }, [settings.resultGroupingMode, settings.yomitanLanguage, maxHistory, historyIndex]);

    const handleWordClick = useCallback(async (text: string, position: number) => {
        const textEncoder = new TextEncoder();
        const prefixBytes = textEncoder.encode(text.slice(0, position)).length;
        
        const cleanText = cleanPunctuation(text, true).trim();
        if (!cleanText) return;

        const newEntry: LookupHistoryEntry = { term: cleanText, results: [], isLoading: true, systemLoading: false };

        setHistory(prev => {
            // Truncate forward history when adding new search from current position
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(newEntry);
            if (newHistory.length > maxHistory) newHistory.shift();
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, maxHistory - 1));

        try {
            const results = await lookupYomitan(cleanText, prefixBytes, settings.resultGroupingMode || 'grouped', settings.yomitanLanguage || 'japanese');
            const loadedResults = results === 'loading' ? [] : (results || []);
            const isSystemLoading = results === 'loading';

            setHistory(prev => {
                const newHistory = [...prev];
                const idx = Math.min(historyIndex + 1, maxHistory - 1);
                if (newHistory[idx]) {
                    const matchedTerm = loadedResults[0]?.headword || cleanText;
                    newHistory[idx] = { ...newHistory[idx], term: matchedTerm, results: loadedResults, isLoading: false, systemLoading: isSystemLoading };
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
    }, [settings.resultGroupingMode, settings.yomitanLanguage, maxHistory, historyIndex]);

    const navigateToHistory = useCallback((index: number) => {
        if (index >= 0 && index < history.length) {
            const entry = history[index];
            isNavigatingHistory.current = true;
            setHistoryIndex(index);
            setSearchTerm(entry.term);
        }
    }, [history]);

    const goBack = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const entry = history[newIndex];
            isNavigatingHistory.current = true;
            setHistoryIndex(newIndex);
            setSearchTerm(entry.term);
        }
    }, [historyIndex, history]);

    useEffect(() => {
        const trimmed = searchTerm.trim();
        
        if (isNavigatingHistory.current) {
            isNavigatingHistory.current = false;
            return;
        }

        if (!trimmed) {
            setIsLoading(false);
            setResults([]);
            setHasSearched(false);
            setHistory([]);
            setHistoryIndex(-1);
            return;
        }

        const timeout = setTimeout(() => {
            setHistory([]);
            setHistoryIndex(-1);
            handleSearch(trimmed, true);
        }, 300);

        return () => clearTimeout(timeout);
    }, [searchTerm, handleSearch]);

    const handleLinkClick = (href: string, text: string) => {
        const newTerm = getLookupTextFromHref(href, text);
        setSearchTerm(newTerm);
        handleSearch(newTerm, true);
    };

    const handleClear = () => {
        setSearchTerm('');
        setResults([]);
        setHasSearched(false);
        setHistory([]);
        setHistoryIndex(-1);
    };

    return (
        <Box
            sx={{
                height: '100%',
                minHeight: 'calc(100vh - 64px)',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.default',
                color: 'text.primary',
            }}
        >
            {/* Header / Search Bar */}
            <Box
                sx={{
                    p: 3,
                    borderBottom: `1px solid ${muiTheme.palette.divider}`,
                    background: `linear-gradient(180deg, ${muiTheme.palette.background.default} 0%, ${alpha(muiTheme.palette.background.default, 0.93)} 100%)`,
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
                <Fade in={!isLoading && !hasSearched} timeout={300} mountOnEnter unmountOnExit>
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
                <Fade in={currentIsLoading} timeout={200} mountOnEnter unmountOnExit>
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
                <Fade in={!currentIsLoading && hasSearched} timeout={300}>
                    <Box sx={{ display: !currentIsLoading && hasSearched ? 'block' : 'none' }}>
                        {processedEntries.length > 0 ? (
                                <Paper
                                    elevation={0}
                                    sx={{
                                        maxWidth: 900,
                                        mx: 'auto',
                                        backgroundColor: muiTheme.palette.background.paper,
                                        color: muiTheme.palette.text.primary,
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '16px',
                                        border: `1px solid ${muiTheme.palette.divider}`,
                                        overflow: 'hidden',
                                        p: { xs: 2, sm: 3 },
                                    }}
                                >
                                {/* Navigation Bar */}
                                {(navMode === 'tabs' ? history.length > 1 : historyIndex > 0) && (
                                    <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                                        {navMode === 'tabs' ? (
                                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                                {history.map((entry, i) => (
                                                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        {i > 0 && (
                                                            <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>→</Typography>
                                                        )}
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => navigateToHistory(i)}
                                                            sx={{
                                                                backgroundColor: i === historyIndex ? 'primary.main' : 'action.hover',
                                                                color: i === historyIndex ? 'primary.contrastText' : 'text.primary',
                                                                '&:hover': {
                                                                    backgroundColor: i === historyIndex ? 'primary.dark' : 'action.selected',
                                                                },
                                                                fontSize: '0.75rem',
                                                                maxWidth: 100,
                                                                textTransform: 'none',
                                                            }}
                                                        >
                                                            <Typography sx={{ 
                                                                overflow: 'hidden', 
                                                                textOverflow: 'ellipsis', 
                                                                whiteSpace: 'nowrap',
                                                                fontSize: '0.75rem',
                                                            }}>
                                                                {entry.term.slice(0, 10)}
                                                            </Typography>
                                                        </IconButton>
                                                    </Box>
                                                ))}
                                            </Box>
                                        ) : (
                                            <IconButton
                                                onClick={goBack}
                                                size="small"
                                                sx={{
                                                    backgroundColor: 'primary.main',
                                                    color: 'primary.contrastText',
                                                    '&:hover': { backgroundColor: 'primary.dark' },
                                                }}
                                            >
                                                <ArrowBackIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                    </Box>
                                )}
                                <DictionaryView
                                    results={processedEntries}
                                    isLoading={currentIsLoading}
                                    systemLoading={currentSystemLoading}
                                    onLinkClick={handleLinkClick}
                                    onWordClick={handleWordClick}
                                />
                            </Paper>
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
        </Box>
    );
};
