import React, { useState } from 'react';
import {
    Drawer, Box, Typography, Slider, Select, MenuItem,
    FormControl, InputLabel, IconButton, Divider, Switch,
    FormControlLabel, ToggleButtonGroup, ToggleButton,
    SelectChangeEvent, Button, InputAdornment, TextField,
} from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ClearIcon from '@mui/icons-material/Clear';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import { Settings } from '@/Manatan/types';
const CUSTOM_FONT_VALUE = '__custom__';

// A safe cross-language fallback stack 
const UNIVERSAL_FALLBACK_STACK =
    'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", serif';

const FONT_PRESETS = [
    { label: 'Serif', value: '"Noto Serif JP", "Noto Serif KR", "Noto Serif SC", "Noto Serif TC", serif' },
    { label: 'Shippori Mincho', value: '"Shippori Mincho", serif' },
    { label: 'Klee One', value: '"Klee One", serif' },
    { label: 'Sans-Serif', value: '"Noto Sans JP", "Noto Sans KR", "Noto Sans SC", "Noto Sans TC", sans-serif' },
    { label: 'Yu Mincho', value: '"Yu Mincho", "YuMincho", serif' },
    { label: 'Yu Gothic', value: '"Yu Gothic", "YuGothic", sans-serif' },
    { label: 'System', value: UNIVERSAL_FALLBACK_STACK },
];

function getPrimaryFontName(fontFamily: string): string {
    const first = (fontFamily || '').split(',')[0]?.trim() ?? '';
    return first.replace(/^["']|["']$/g, '');
}

function buildFontFamilyFromCustomName(name: string): string {
    const raw = (name || '').trim();
    if (!raw) return UNIVERSAL_FALLBACK_STACK;
    const safe = raw.replace(/,/g, '').trim();
    if (!safe) return UNIVERSAL_FALLBACK_STACK;
    const needsQuotes = /\s/.test(safe);
    const font = needsQuotes ? `"${safe.replace(/"/g, '')}"` : safe;
    return `${font}, ${UNIVERSAL_FALLBACK_STACK}`;
}

function findMatchingPreset(value: string): string | null {
    const match = FONT_PRESETS.find(p => p.value === value);
    return match ? match.value : null;
}

interface Props {
    open: boolean;
    onClose: () => void;
    settings: Settings;
    onUpdateSettings: (key: keyof Settings, value: any) => void;
    onResetSettings?: () => void;
}

const getMenuProps = (theme: Theme) => ({
    sx: { zIndex: 2100 },
    PaperProps: {
        sx: {
            bgcolor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: 3,
            '& .MuiMenuItem-root': {
                '&:hover': { bgcolor: theme.palette.action.hover },
                '&.Mui-selected': {
                    bgcolor: theme.palette.action.selected,
                    '&:hover': { bgcolor: alpha(theme.palette.action.selected, 0.7) },
                },
            },
        },
    },
    keepMounted: true,
});

const getSelectStyles = (theme: Theme) => ({
    color: theme.palette.text.primary,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.text.secondary },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.main },
    '& .MuiSvgIcon-root': { color: theme.palette.text.secondary },
    '& .MuiInputBase-input': { color: theme.palette.text.primary },
    '& .MuiSelect-select': { color: theme.palette.text.primary },
    '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
    '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.primary.main },
    '& .MuiFormHelperText-root': { color: theme.palette.text.secondary },
});

const getInputStyles = (theme: Theme) => ({
    width: '100px',
    '& input': {
        textAlign: 'center',
        padding: '6px 8px',
        fontSize: '0.875rem',
        color: theme.palette.text.primary,
        fontWeight: 600,
    },
    '& .MuiOutlinedInput-root': {
        '& fieldset': { borderColor: theme.palette.divider },
        '&:hover fieldset': { borderColor: theme.palette.text.secondary },
        '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
    },
});

export const ReaderControls: React.FC<Props> = ({
    open,
    onClose,
    settings,
    onUpdateSettings,
    onResetSettings,
}) => {
    const muiTheme = useTheme();
    const menuProps = getMenuProps(muiTheme);
    const selectStyles = getSelectStyles(muiTheme);

    // Local state for manual inputs
    const [fontSizeInput, setFontSizeInput] = useState(settings.lnFontSize.toString());
    const [lineHeightInput, setLineHeightInput] = useState(settings.lnLineHeight.toFixed(1));
    const [letterSpacingInput, setLetterSpacingInput] = useState(settings.lnLetterSpacing.toString());
    const [pageMarginInput, setPageMarginInput] = useState(settings.lnPageMargin.toString());

    // Sync local state when settings change
    React.useEffect(() => {
        setFontSizeInput(settings.lnFontSize.toString());
        setLineHeightInput(settings.lnLineHeight.toFixed(1));
        setLetterSpacingInput(settings.lnLetterSpacing.toString());
        setPageMarginInput(settings.lnPageMargin.toString());
    }, [settings.lnFontSize, settings.lnLineHeight, settings.lnLetterSpacing, settings.lnPageMargin]);

    const handleFontSizeChange = (value: string) => {
        setFontSizeInput(value);
        const num = parseInt(value, 10);
        if (!isNaN(num) && num >= 12 && num <= 50) {
            onUpdateSettings('lnFontSize', num);
        }
    };

    const handleFontSizeBlur = () => {
        const num = parseInt(fontSizeInput, 10);
        if (isNaN(num) || num < 12) {
            setFontSizeInput('12');
            onUpdateSettings('lnFontSize', 12);
        } else if (num > 50) {
            setFontSizeInput('50');
            onUpdateSettings('lnFontSize', 50);
        }
    };

    const handleLineHeightChange = (value: string) => {
        setLineHeightInput(value);
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 1.2 && num <= 2.5) {
            onUpdateSettings('lnLineHeight', num);
        }
    };

    const handleLineHeightBlur = () => {
        const num = parseFloat(lineHeightInput);
        if (isNaN(num) || num < 1.2) {
            setLineHeightInput('1.2');
            onUpdateSettings('lnLineHeight', 1.2);
        } else if (num > 2.5) {
            setLineHeightInput('2.5');
            onUpdateSettings('lnLineHeight', 2.5);
        } else {
            setLineHeightInput(num.toFixed(1));
        }
    };

    const handleLetterSpacingChange = (value: string) => {
        setLetterSpacingInput(value);
        const num = parseFloat(value);
        if (!isNaN(num) && num >= -2 && num <= 5) {
            onUpdateSettings('lnLetterSpacing', num);
        }
    };

    const handleLetterSpacingBlur = () => {
        const num = parseFloat(letterSpacingInput);
        if (isNaN(num) || num < -2) {
            setLetterSpacingInput('-2');
            onUpdateSettings('lnLetterSpacing', -2);
        } else if (num > 5) {
            setLetterSpacingInput('5');
            onUpdateSettings('lnLetterSpacing', 5);
        } else {
            setLetterSpacingInput(num.toString());
        }
    };

    const handlePageMarginChange = (value: string) => {
        setPageMarginInput(value);
        const num = parseInt(value, 10);
        if (!isNaN(num) && num >= 0 && num <= 80) {
            onUpdateSettings('lnPageMargin', num);
        }
    };

    const handlePageMarginBlur = () => {
        const num = parseInt(pageMarginInput, 10);
        if (isNaN(num) || num < 0) {
            setPageMarginInput('0');
            onUpdateSettings('lnPageMargin', 0);
        } else if (num > 80) {
            setPageMarginInput('80');
            onUpdateSettings('lnPageMargin', 80);
        }
    };

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            sx={{ zIndex: 2000 }}
            PaperProps={{
                sx: {
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxHeight: '85vh',
                },
            }}
            ModalProps={{ keepMounted: false }}
        >
            <Box sx={{ p: 3, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Reader Settings
                    </Typography>
                    <IconButton onClick={onClose} sx={{ color: 'text.primary' }}>
                        <CloseIcon />
                    </IconButton>
                </Box>
                <Divider sx={{ my: 3, borderColor: 'divider' }} />

                {/* Typography Section */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, opacity: 0.8 }}>
                        Typography
                    </Typography>

                    {/* Font Family */}
                    <Box sx={{ mb: 2 }}>
                        {(() => {
                            const presetMatch = findMatchingPreset(settings.lnFontFamily);
                            const selectValue = presetMatch ?? CUSTOM_FONT_VALUE;
                            const customName = getPrimaryFontName(settings.lnFontFamily);

                            return (
                                <>
                                    <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                                        <InputLabel sx={{ color: 'text.secondary', '&.Mui-focused': { color: 'primary.main' } }}>
                                            Font Family
                                        </InputLabel>
                                        <Select
                                            value={selectValue}
                                            label="Font Family"
                                            onChange={(e: SelectChangeEvent) => {
                                                const v = e.target.value;
                                                if (v === CUSTOM_FONT_VALUE) {
                                                    const primary = getPrimaryFontName(settings.lnFontFamily);
                                                    onUpdateSettings('lnFontFamily', buildFontFamilyFromCustomName(primary));
                                                } else {
                                                    onUpdateSettings('lnFontFamily', v);
                                                }
                                            }}
                                            sx={selectStyles}
                                            MenuProps={menuProps}
                                        >
                                            <MenuItem value={CUSTOM_FONT_VALUE}>Custom…</MenuItem>
                                            {FONT_PRESETS.map(p => (
                                                <MenuItem key={p.label} value={p.value}>
                                                    <span style={{ fontFamily: p.value }}>{p.label}</span>
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>

                                            {selectValue === CUSTOM_FONT_VALUE && (
                                        <TextField
                                            size="small"
                                            fullWidth
                                            label="Custom font name"
                                            value={customName}
                                            onChange={(e) => {
                                                onUpdateSettings('lnFontFamily', buildFontFamilyFromCustomName(e.target.value));
                                            }}
                                            placeholder='Example: Ridibatang'
                                            helperText="Font must be installed on your device"
                                            InputLabelProps={{ style: { color: muiTheme.palette.text.secondary } }}
                                            InputProps={{
                                                endAdornment: customName ? (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => onUpdateSettings('lnFontFamily', UNIVERSAL_FALLBACK_STACK)}
                                                            sx={{ color: 'text.secondary' }}
                                                        >
                                                            <ClearIcon fontSize="small" />
                                                        </IconButton>
                                                    </InputAdornment>
                                                ) : null
                                            }}
                                            sx={selectStyles}
                                        />
                                    )}
                                </>
                            );
                        })()}
                    </Box>

                    {/* Font Size */}
                    <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>Font Size</Typography>
                            <TextField
                                size="small"
                                value={fontSizeInput}
                                onChange={(e) => handleFontSizeChange(e.target.value)}
                                onBlur={handleFontSizeBlur}
                                type="number"
                                inputProps={{ min: 12, max: 50, step: 1 }}
                                sx={getInputStyles(muiTheme)}
                                InputProps={{
                                    endAdornment: <InputAdornment position="end" sx={{ color: 'text.secondary' }}>px</InputAdornment>
                                }}
                            />
                        </Box>
                        <Slider
                            value={settings.lnFontSize}
                            min={12}
                            max={50}
                            step={1}
                            onChange={(_, v) => onUpdateSettings('lnFontSize', v)}
                            sx={{ color: 'primary.main' }}
                        />
                    </Box>

                    {/* Line Height */}
                    <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>Line Height</Typography>
                            <TextField
                                size="small"
                                value={lineHeightInput}
                                onChange={(e) => handleLineHeightChange(e.target.value)}
                                onBlur={handleLineHeightBlur}
                                type="number"
                                inputProps={{ min: 1.2, max: 2.5, step: 0.1 }}
                                sx={getInputStyles(muiTheme)}
                            />
                        </Box>
                        <Slider
                            value={settings.lnLineHeight}
                            min={1.2}
                            max={2.5}
                            step={0.1}
                            onChange={(_, v) => onUpdateSettings('lnLineHeight', v)}
                            sx={{ color: 'primary.main' }}
                        />
                    </Box>

                    {/* Letter Spacing */}
                    <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>Letter Spacing</Typography>
                            <TextField
                                size="small"
                                value={letterSpacingInput}
                                onChange={(e) => handleLetterSpacingChange(e.target.value)}
                                onBlur={handleLetterSpacingBlur}
                                type="number"
                                inputProps={{ min: -2, max: 5, step: 0.5 }}
                                sx={getInputStyles(muiTheme)}
                                InputProps={{
                                    endAdornment: <InputAdornment position="end" sx={{ color: 'text.secondary' }}>px</InputAdornment>
                                }}
                            />
                        </Box>
                        <Slider
                            value={settings.lnLetterSpacing}
                            min={-2}
                            max={5}
                            step={0.5}
                            onChange={(_, v) => onUpdateSettings('lnLetterSpacing', v)}
                            sx={{ color: 'primary.main' }}
                        />
                    </Box>

                    {/* Text Alignment */}
                    <Box>
                        <Typography variant="caption" sx={{ opacity: 0.8, mb: 1, display: 'block' }}>
                            Text Alignment
                        </Typography>
                        <ToggleButtonGroup
                            value={settings.lnTextAlign}
                            exclusive
                            onChange={(_, v) => v && onUpdateSettings('lnTextAlign', v)}
                            size="small"
                            fullWidth
                            sx={{
                                '& .MuiToggleButton-root': {
                                    color: 'text.primary',
                                    borderColor: 'divider',
                                    '&.Mui-selected': { bgcolor: 'action.selected', color: 'text.primary' },
                                },
                            }}
                        >
                            <ToggleButton value="left"><FormatAlignLeftIcon sx={{ mr: 0.5 }} />Left</ToggleButton>
                            <ToggleButton value="center"><FormatAlignCenterIcon sx={{ mr: 0.5 }} />Center</ToggleButton>
                            <ToggleButton value="justify"><FormatAlignJustifyIcon sx={{ mr: 0.5 }} />Justify</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                </Box>

                <Divider sx={{ my: 3, borderColor: 'divider' }} />

                {/* Layout Section */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, opacity: 0.8 }}>
                        Layout
                    </Typography>

                    {/* Reading Direction */}
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel sx={{ color: 'text.secondary', '&.Mui-focused': { color: 'primary.main' } }}>
                            Text Direction
                        </InputLabel>
                        <Select
                            value={settings.lnReadingDirection}
                            label="Text Direction"
                            onChange={(e: SelectChangeEvent) => onUpdateSettings('lnReadingDirection', e.target.value)}
                            sx={selectStyles}
                            MenuProps={menuProps}
                        >
                            <MenuItem value="horizontal">Horizontal (Left-to-Right)</MenuItem>
                            <MenuItem value="vertical-rtl">Vertical (Japanese RTL)</MenuItem>
                        </Select>
                    </FormControl>

                    {/* Pagination Mode */}
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel sx={{ color: 'text.secondary', '&.Mui-focused': { color: 'primary.main' } }}>
                            Pagination
                        </InputLabel>
                        <Select
                            value={settings.lnPaginationMode}
                            label="Pagination"
                            onChange={(e: SelectChangeEvent) => onUpdateSettings('lnPaginationMode', e.target.value)}
                            sx={selectStyles}
                            MenuProps={menuProps}
                        >
                            <MenuItem value="scroll">Continuous Scroll</MenuItem>
                            <MenuItem value="paginated">Paginated (Pages)</MenuItem>
                        </Select>
                    </FormControl>

                    {/* Page Margin */}
                    <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>Page Margin</Typography>
                            <TextField
                                size="small"
                                value={pageMarginInput}
                                onChange={(e) => handlePageMarginChange(e.target.value)}
                                onBlur={handlePageMarginBlur}
                                type="number"
                                inputProps={{ min: 0, max: 80, step: 4 }}
                                sx={getInputStyles(muiTheme)}
                                InputProps={{
                                    endAdornment: <InputAdornment position="end" sx={{ color: 'text.secondary' }}>px</InputAdornment>
                                }}
                            />
                        </Box>
                        <Slider
                            value={settings.lnPageMargin}
                            min={0}
                            max={80}
                            step={4}
                            onChange={(_, v) => onUpdateSettings('lnPageMargin', v)}
                            sx={{ color: 'primary.main' }}
                        />
                    </Box>
                </Box>

                <Divider sx={{ my: 3, borderColor: 'divider' }} />

                {/* Features Section */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, opacity: 0.8 }}>
                        Features
                    </Typography>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={!!settings.lnDisableAnimations}
                                onChange={(e) => onUpdateSettings('lnDisableAnimations', e.target.checked)}
                                sx={{
                                    '& .MuiSwitch-switchBase.Mui-checked': { color: 'primary.main' },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: 'primary.main' },
                                }}
                            />
                        }
                        label={
                            <Box>
                                <Typography variant="body2">Disable Animations</Typography>
                                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                                    Instant page turns
                                </Typography>
                            </Box>
                        }
                        sx={{ mb: 1.5, width: '100%' }}
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.lnEnableFurigana}
                                onChange={(e) => onUpdateSettings('lnEnableFurigana', e.target.checked)}
                                sx={{
                                    '& .MuiSwitch-switchBase.Mui-checked': { color: 'primary.main' },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: 'primary.main' },
                                }}
                            />
                        }
                        label={
                            <Box>
                                <Typography variant="body2">Show Furigana</Typography>
                                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                                    Display reading aids above kanji
                                </Typography>
                            </Box>
                        }
                        sx={{ mb: 1.5, width: '100%' }}
                    />
                    <Box sx={{ mb: 3 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={settings.lnShowCharProgress ?? false}
                                    onChange={(e) => onUpdateSettings('lnShowCharProgress', e.target.checked)}
                                />
                        }
                        label="Show Character Progress"
                        sx={{ color: 'text.primary' }}
                    />
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7, color: 'text.secondary' }}>
                        Display character count and percentage instead of page numbers
                    </Typography>
                    </Box>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.enableYomitan}
                                onChange={(e) => onUpdateSettings('enableYomitan', e.target.checked)}
                                sx={{
                                    '& .MuiSwitch-switchBase.Mui-checked': { color: 'primary.main' },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: 'primary.main' },
                                }}
                            />
                        }
                        label={
                            <Box>
                                <Typography variant="body2">Dictionary Lookup</Typography>
                                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                                    {settings.interactionMode === 'hover' ? 'Hover over text to lookup' : 'Tap text to lookup'}
                                </Typography>
                            </Box>
                        }
                        sx={{ width: '100%' }}
                    />
                </Box>

                {onResetSettings && (
                    <>
                        <Divider sx={{ my: 3, borderColor: 'divider' }} />
                        <Button
                            variant="outlined"
                            color="inherit"
                            fullWidth
                            startIcon={<RestartAltIcon />}
                            onClick={onResetSettings}
                            sx={{ borderColor: 'divider', color: 'text.primary' }}
                        >
                            Reset Defaults
                        </Button>
                    </>
                )}
            </Box>
        </Drawer>
    );
};
