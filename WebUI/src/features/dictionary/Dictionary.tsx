import { useCallback, useEffect, useState } from 'react';
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
import { DictionaryResult } from '@/Manatan/types';
import { DictionaryView } from '@/Manatan/components/DictionaryView';
import { useOCR } from '@/Manatan/context/OCRContext';
import { cleanPunctuation, lookupYomitan } from '@/Manatan/utils/api';
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

export const Dictionary = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<DictionaryResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const { settings } = useOCR();
    const muiTheme = useTheme();

    useAppTitle('Dictionary');

    const handleSearch = useCallback(async (term: string) => {
        if (!term.trim()) return;
        setIsLoading(true);
        setHasSearched(true);
        const res = await lookupYomitan(
            cleanPunctuation(term, true),
            0,
            settings.resultGroupingMode,
            settings.yomitanLanguage
        );
        setResults(res === 'loading' ? [] : res);
        setIsLoading(false);
    }, [settings.resultGroupingMode, settings.yomitanLanguage]);

    useEffect(() => {
        const trimmed = searchTerm.trim();
        if (!trimmed) {
            setIsLoading(false);
            setResults([]);
            setHasSearched(false);
            return;
        }

        const timeout = setTimeout(() => {
            handleSearch(trimmed);
        }, 300);

        return () => clearTimeout(timeout);
    }, [searchTerm, handleSearch]);

    const handleLinkClick = (href: string, text: string) => {
        const newTerm = getLookupTextFromHref(href, text);
        setSearchTerm(newTerm);
        handleSearch(newTerm);
    };

    const handleClear = () => {
        setSearchTerm('');
        setResults([]);
        setHasSearched(false);
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
                <Fade in={isLoading} timeout={200} mountOnEnter unmountOnExit>
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
                <Fade in={!isLoading && hasSearched} timeout={300}>
                    <Box sx={{ display: !isLoading && hasSearched ? 'block' : 'none' }}>
                        {results.length > 0 ? (
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
                                <DictionaryView
                                    results={results}
                                    isLoading={isLoading}
                                    systemLoading={false}
                                    onLinkClick={handleLinkClick}
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
