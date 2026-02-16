import React, { useState } from 'react';
import {
    Drawer, Box, Typography, Slider, Select, MenuItem,
    FormControl, InputLabel, IconButton, Divider, Switch,
    FormControlLabel, ToggleButtonGroup, ToggleButton,
    SelectChangeEvent, Button, InputAdornment, TextField,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ClearIcon from '@mui/icons-material/Clear';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import { Settings } from '@/Manatan/types';
import { importFontFile, saveCustomFont, loadCustomFonts, CustomFont, deleteCustomFont } from '../utils/fontUtils';

const THEMES = {
    light: { name: 'Light', bg: '#FFFFFF', fg: '#1a1a1a', preview: '#FFFFFF' },
    sepia: { name: 'Sepia', bg: '#F4ECD8', fg: '#5C4B37', preview: '#F4ECD8' },
    dark: { name: 'Dark', bg: '#2B2B2B', fg: '#E0E0E0', preview: '#2B2B2B' },
    black: { name: 'Black', bg: '#000000', fg: '#CCCCCC', preview: '#000000' },
} as const;

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


interface Props {
    open: boolean;
    onClose: () => void;
    settings: Settings;
    onUpdateSettings: (key: keyof Settings, value: any) => void;
    onResetSettings?: () => void;
    theme: { bg: string; fg: string };
}

const getMenuProps = (theme: { bg: string; fg: string }) => ({
    sx: { zIndex: 2100 },
    PaperProps: {
        sx: {
            bgcolor: theme.bg,
            color: theme.fg,
            border: `1px solid ${theme.fg}22`,
            boxShadow: 3,
            '& .MuiMenuItem-root': {
                '&:hover': { bgcolor: `${theme.fg}11` },
                '&.Mui-selected': {
                    bgcolor: `${theme.fg}22`,
                    '&:hover': { bgcolor: `${theme.fg}33` },
                },
            },
        },
    },
    keepMounted: true,
});

const getSelectStyles = (theme: { bg: string; fg: string }) => ({
    color: theme.fg,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: `${theme.fg}44` },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: `${theme.fg}66` },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.fg },
    '& .MuiSvgIcon-root': { color: theme.fg },
    '& .MuiInputBase-input': { color: theme.fg },
    '& .MuiSelect-select': { color: theme.fg },
    '& .MuiInputLabel-root': { color: `${theme.fg}aa` },
    '& .MuiInputLabel-root.Mui-focused': { color: theme.fg },
    '& .MuiFormHelperText-root': { color: `${theme.fg}aa` },
});

const getInputStyles = (theme: { bg: string; fg: string }) => ({
    width: '100px',
    '& input': {
        textAlign: 'center',
        padding: '6px 8px',
        fontSize: '0.875rem',
        color: theme.fg,
        fontWeight: 600,
    },
    '& .MuiOutlinedInput-root': {
        '& fieldset': { borderColor: `${theme.fg}44` },
        '&:hover fieldset': { borderColor: `${theme.fg}66` },
        '&.Mui-focused fieldset': { borderColor: theme.fg },
    },
});

export const ReaderControls: React.FC<Props> = ({
    open,
    onClose,
    settings,
    onUpdateSettings,
    onResetSettings,
    theme,
}) => {
    const menuProps = getMenuProps(theme);
    const selectStyles = getSelectStyles(theme);

    // Local state for manual inputs
    const [fontSizeInput, setFontSizeInput] = useState(settings.lnFontSize.toString());
    const [lineHeightInput, setLineHeightInput] = useState(settings.lnLineHeight.toFixed(1));
    const [letterSpacingInput, setLetterSpacingInput] = useState(settings.lnLetterSpacing.toString());
    const [pageMarginInput, setPageMarginInput] = useState(settings.lnPageMargin.toString());
    
    // Custom fonts state
    const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Load custom fonts on mount
    React.useEffect(() => {
        loadCustomFonts().then(fonts => {
            setCustomFonts(fonts);
        });
    }, []);

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

    const handleImportFont = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        
        const font = await importFontFile(file);
        
        
        
        // Check for duplicate
        if (customFonts.some(f => f.family === font.family)) {
            alert(`Font "${font.family}" is already imported.`);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }
        
        await saveCustomFont(font);
        
        const updatedFonts = [...customFonts, font];
        setCustomFonts(updatedFonts);
        
        const fontFamilyWithFallback = `"${font.family}", sans-serif`;
        onUpdateSettings('lnFontFamily', fontFamilyWithFallback);
        
        
    } catch (error) {
        alert('Failed to import font: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
    
    // Reset input
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
};

    const handleDeleteFont = async (font: CustomFont) => {
        if (!confirm(`Delete font "${font.name.replace(/\.(ttf|otf|woff|woff2)$/i, '')}"?`)) return;
        
        try {
            await deleteCustomFont(font.family);
            const updatedFonts = customFonts.filter(f => f.family !== font.family);
            setCustomFonts(updatedFonts);
            
            // Reset to default if current font was deleted
            const currentPrimaryFont = settings.lnFontFamily.split(',')[0].trim().replace(/['"]/g, '');
            if (currentPrimaryFont === font.family) {
                onUpdateSettings('lnFontFamily', FONT_PRESETS[0].value);
            }
        } catch (error) {
            console.error('[ReaderControls] Failed to delete font:', error);
            alert('Failed to delete font');
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
                    bgcolor: theme.bg,
                    color: theme.fg,
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
                    <IconButton onClick={onClose} sx={{ color: theme.fg }}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Theme Selection */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, opacity: 0.8 }}>
                        Theme
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                        {Object.entries(THEMES).map(([key, t]) => (
                            <Box
                                key={key}
                                onClick={() => onUpdateSettings('lnTheme', key)}
                                sx={{
                                    flex: 1,
                                    height: 60,
                                    borderRadius: 2,
                                    bgcolor: t.preview,
                                    border: settings.lnTheme === key
                                        ? '3px solid #4890ff'
                                        : `2px solid ${theme.fg}44`,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 0.5,
                                    transition: 'all 0.2s',
                                    '&:hover': { transform: 'scale(1.05)', boxShadow: 2 },
                                }}
                            >
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: t.fg }}>
                                    {t.name}
                                </Typography>
                                <Typography sx={{ fontSize: '1.2rem', fontWeight: 600, color: t.fg }}>
                                    Aa
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>

                <Divider sx={{ my: 3, borderColor: `${theme.fg}22` }} />

                {/* Typography Section */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, opacity: 0.8 }}>
                        Typography
                    </Typography>

                    {/* Font Family */}
                    {/* Font Family */}
<Box sx={{ mb: 2 }}>
    <FormControl fullWidth size="small" sx={{ mb: 1 }}>
        <InputLabel sx={{ color: theme.fg, '&.Mui-focused': { color: theme.fg } }}>
            Font Family
        </InputLabel>
        <Select
            value={(() => {
                const currentFont = settings.lnFontFamily;
                const primaryFont = currentFont.split(',')[0].trim().replace(/['"]/g, '');
                
                // Check if it's a custom font
                const customFont = customFonts.find(f => f.family === primaryFont);
                if (customFont) {
                    return customFont.family;
                }
                
                // Check if it's a preset (exact match)
                const matchingPreset = FONT_PRESETS.find(p => p.value === currentFont);
                if (matchingPreset) {
                    return matchingPreset.value;
                }
                
                // Fallback to first preset
                return FONT_PRESETS[0].value;
            })()}
            label="Font Family"
           onChange={(e: SelectChangeEvent) => {
    const v = e.target.value;
    
    const selectedCustomFont = customFonts.find(f => f.family === v);
    
    if (selectedCustomFont) {
        const currentFont = settings.lnFontFamily;
        const currentPrimary = currentFont.split(',')[0].trim().replace(/['"]/g, '');
        
        if (currentPrimary === v && currentFont.includes('sans-serif')) {
            return;
        }
        
        const fontStack = `"${v}", sans-serif`; 
        onUpdateSettings('lnFontFamily', fontStack);
    } else {
        onUpdateSettings('lnFontFamily', v);
    }
}}
            sx={selectStyles}
            MenuProps={menuProps}
        >
            {/* Presets */}
            {FONT_PRESETS.map(p => (
                <MenuItem key={p.label} value={p.value}>
                    <span style={{ fontFamily: p.value }}>{p.label}</span>
                </MenuItem>
            ))}
            
            {/* Divider - only if custom fonts exist */}
            {customFonts.length > 0 && (
                <Divider key="custom-divider" sx={{ my: 1, borderColor: `${theme.fg}22` }} />
            )}
            
            {/* Custom fonts */}
            {customFonts.map(font => (
                <MenuItem 
                    key={`custom-${font.family}`} 
                    value={font.family}
                >
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        width: '100%', 
                        justifyContent: 'space-between' 
                    }}>
                        <span style={{ fontFamily: `"${font.family}", serif` }}>
                            {font.name.replace(/\.(ttf|otf|woff|woff2)$/i, '')}
                        </span>
                        <IconButton
                            size="small"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleDeleteFont(font);
                            }}
                            sx={{ color: theme.fg, opacity: 0.6, ml: 1 }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </MenuItem>
            ))}
        </Select>
    </FormControl>

    {/* Import Font Button */}
    <Button
        variant="outlined"
        size="small"
        fullWidth
        startIcon={<UploadFileIcon />}
        onClick={() => fileInputRef.current?.click()}
        sx={{ 
            mb: 1, 
            borderColor: `${theme.fg}44`, 
            color: theme.fg,
            '&:hover': { borderColor: theme.fg, bgcolor: `${theme.fg}11` }
        }}
    >
        Import Font File
    </Button>
    <input
        ref={fileInputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        style={{ display: 'none' }}
        onChange={handleImportFont}
    />
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
                                sx={getInputStyles(theme)}
                                InputProps={{
                                    endAdornment: <InputAdornment position="end" sx={{ color: theme.fg }}>px</InputAdornment>
                                }}
                            />
                        </Box>
                        <Slider
                            value={settings.lnFontSize}
                            min={12}
                            max={50}
                            step={1}
                            onChange={(_, v) => onUpdateSettings('lnFontSize', v)}
                            sx={{ color: theme.fg }}
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
                                sx={getInputStyles(theme)}
                            />
                        </Box>
                        <Slider
                            value={settings.lnLineHeight}
                            min={1.2}
                            max={2.5}
                            step={0.1}
                            onChange={(_, v) => onUpdateSettings('lnLineHeight', v)}
                            sx={{ color: theme.fg }}
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
                                sx={getInputStyles(theme)}
                                InputProps={{
                                    endAdornment: <InputAdornment position="end" sx={{ color: theme.fg }}>px</InputAdornment>
                                }}
                            />
                        </Box>
                        <Slider
                            value={settings.lnLetterSpacing}
                            min={-2}
                            max={5}
                            step={0.5}
                            onChange={(_, v) => onUpdateSettings('lnLetterSpacing', v)}
                            sx={{ color: theme.fg }}
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
                                    color: theme.fg,
                                    borderColor: `${theme.fg}44`,
                                    '&.Mui-selected': { bgcolor: `${theme.fg}22`, color: theme.fg },
                                },
                            }}
                        >
                            <ToggleButton value="left"><FormatAlignLeftIcon sx={{ mr: 0.5 }} />Left</ToggleButton>
                            <ToggleButton value="center"><FormatAlignCenterIcon sx={{ mr: 0.5 }} />Center</ToggleButton>
                            <ToggleButton value="justify"><FormatAlignJustifyIcon sx={{ mr: 0.5 }} />Justify</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                </Box>

                <Divider sx={{ my: 3, borderColor: `${theme.fg}22` }} />

                {/* Layout Section */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, opacity: 0.8 }}>
                        Layout
                    </Typography>

                    {/* Reading Direction */}
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel sx={{ color: theme.fg, '&.Mui-focused': { color: theme.fg } }}>
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
                        <InputLabel sx={{ color: theme.fg, '&.Mui-focused': { color: theme.fg } }}>
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
                                sx={getInputStyles(theme)}
                                InputProps={{
                                    endAdornment: <InputAdornment position="end" sx={{ color: theme.fg }}>px</InputAdornment>
                                }}
                            />
                        </Box>
                        <Slider
                            value={settings.lnPageMargin}
                            min={0}
                            max={80}
                            step={4}
                            onChange={(_, v) => onUpdateSettings('lnPageMargin', v)}
                            sx={{ color: theme.fg }}
                        />
                    </Box>
                </Box>

                <Divider sx={{ my: 3, borderColor: `${theme.fg}22` }} />

{/* Bookmarking Section */}
<Box sx={{ mb: 3 }}>
    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, opacity: 0.8 }}>
        Bookmarking
    </Typography>

    <FormControlLabel
        control={
            <Switch
                checked={settings.lnAutoBookmark ?? true}
                onChange={(e) => onUpdateSettings('lnAutoBookmark', e.target.checked)}
                sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: theme.fg },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: theme.fg },
                }}
            />
        }
        label={
            <Box>
                <Typography variant="body2">Auto-Bookmark</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    Automatically save position after delay
                </Typography>
            </Box>
        }
        sx={{ mb: 2, width: '100%' }}
    />

    {(settings.lnAutoBookmark ?? true) && (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Auto-Bookmark Delay
                </Typography>
                <TextField
                    size="small"
                    value={settings.lnBookmarkDelay ?? 5}
                    onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 0 && val <= 60) {
                            onUpdateSettings('lnBookmarkDelay', val);
                        }
                    }}
                    type="number"
                    inputProps={{ min: 0, max: 60, step: 1 }}
                    sx={getInputStyles(theme)}
                    InputProps={{
                        endAdornment: <InputAdornment position="end" sx={{ color: theme.fg }}>sec</InputAdornment>
                    }}
                />
            </Box>
            <Slider
                value={settings.lnBookmarkDelay ?? 5}
                min={0}
                max={60}
                step={1}
                marks={[
                    { value: 0, label: 'Off' },
                    { value: 5, label: '5s' },
                    { value: 15, label: '15s' },
                    { value: 30, label: '30s' },
                    { value: 60, label: '1m' },
                ]}
                onChange={(_, v) => onUpdateSettings('lnBookmarkDelay', v as number)}
                sx={{ 
                    color: theme.fg,
                    '& .MuiSlider-markLabel': { color: theme.fg, fontSize: '0.7rem' }
                }}
            />
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}>
                {(settings.lnBookmarkDelay ?? 5) === 0 
                    ? 'Auto-bookmarking disabled (use manual bookmark only)' 
                    : `Auto-bookmark after staying on a page for ${settings.lnBookmarkDelay ?? 5} seconds`}
            </Typography>
        </Box>
    )}
</Box>
<Divider sx={{ my: 3, borderColor: `${theme.fg}22` }} />

{/* Navigation Section */}
<Box sx={{ mb: 3 }}>
    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, opacity: 0.8 }}>
        Navigation
    </Typography>

    {/* Show/Hide Nav Buttons */}
    <FormControlLabel
        control={
            <Switch
                checked={!(settings.lnHideNavButtons ?? false)}
                onChange={(e) => onUpdateSettings('lnHideNavButtons', !e.target.checked)}
                sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: theme.fg },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: theme.fg },
                }}
            />
        }
        label={
            <Box>
                <Typography variant="body2">Navigation Buttons</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    Show prev/next arrows on screen
                </Typography>
            </Box>
        }
        sx={{ mb: 2, width: '100%' }}
    />

    {/* Enable Swipe */}
    <FormControlLabel
        control={
            <Switch
                checked={settings.lnEnableSwipe ?? true}
                onChange={(e) => onUpdateSettings('lnEnableSwipe', e.target.checked)}
                sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: theme.fg },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: theme.fg },
                }}
            />
        }
        label={
            <Box>
                <Typography variant="body2">Swipe Navigation</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    Swipe to turn pages (touch devices)
                </Typography>
            </Box>
        }
        sx={{ mb: 2, width: '100%' }}
    />

    {/* Drag Threshold */}
    <Box sx={{ mb: 3, width: '100%' }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
            Drag Threshold: {settings.lnDragThreshold ?? 10}px
        </Typography>
        <Slider
            value={settings.lnDragThreshold ?? 10}
            min={1}
            max={50}
            step={1}
            onChange={(_, v) => onUpdateSettings('lnDragThreshold', v as number)}
            sx={{ color: theme.fg }}
        />
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
            Higher = requires more movement to detect drag
        </Typography>
    </Box>

    {/* Click Zones - Only show in paginated mode */}
    {settings.lnPaginationMode === 'paginated' && (
        <>
            <FormControlLabel
                control={
                    <Switch
                        checked={settings.lnEnableClickZones ?? true}
                        onChange={(e) => onUpdateSettings('lnEnableClickZones', e.target.checked)}
                        sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: theme.fg },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: theme.fg },
                        }}
                    />
                }
                label={
                    <Box>
                        <Typography variant="body2">Click/Touch Zones</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.6 }}>
                            Tap screen edges to navigate
                        </Typography>
                    </Box>
                }
                sx={{ mb: 2, width: '100%' }}
            />

            {(settings.lnEnableClickZones ?? true) && (
                <>
                    {/* Zone Size */}
                    <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>Zone Size</Typography>
                            <TextField
                                size="small"
                                value={settings.lnClickZoneSize ?? 10}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val) && val >= 0 && val <= 50) {
                                        onUpdateSettings('lnClickZoneSize', val);
                                    }
                                }}
                                type="number"
                                inputProps={{ min: 0, max: 50, step: 5 }}
                                sx={getInputStyles(theme)}
                                InputProps={{
                                    endAdornment: <InputAdornment position="end" sx={{ color: theme.fg }}>%</InputAdornment>
                                }}
                            />
                        </Box>
                        <Slider
                            value={settings.lnClickZoneSize ?? 10}
                            min={0}
                            max={50}
                            step={5}
                            onChange={(_, v) => onUpdateSettings('lnClickZoneSize', v as number)}
                            sx={{ color: theme.fg }}
                        />
                    </Box>

                    {/* Zone Placement */}
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel sx={{ color: theme.fg, '&.Mui-focused': { color: theme.fg } }}>
                            Zone Placement
                        </InputLabel>
                        <Select
                            value={settings.lnClickZonePlacement ?? 'vertical'}
                            label="Zone Placement"
                            onChange={(e) => onUpdateSettings('lnClickZonePlacement', e.target.value)}
                            sx={selectStyles}
                            MenuProps={menuProps}
                        >
                            <MenuItem value="horizontal">Horizontal</MenuItem>
                            <MenuItem value="vertical">Vertical</MenuItem>
                        </Select>
                    </FormControl>

                    {/* Zone Position */}
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel sx={{ color: theme.fg, '&.Mui-focused': { color: theme.fg } }}>
                            Zone Position
                        </InputLabel>
                        <Select
                            value={settings.lnClickZonePosition ?? 'full'}
                            label="Zone Position"
                            onChange={(e) => onUpdateSettings('lnClickZonePosition', e.target.value)}
                            sx={selectStyles}
                            MenuProps={menuProps}
                        >
                            <MenuItem value="full">Full Edge</MenuItem>
                            <MenuItem value="start">Start</MenuItem>
                            <MenuItem value="center">Center</MenuItem>
                            <MenuItem value="end">End</MenuItem>
                        </Select>
                    </FormControl>

                    {/* Zone Coverage (only if not full) */}
                    {(settings.lnClickZonePosition ?? 'full') !== 'full' && (
                        <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="caption" sx={{ opacity: 0.8 }}>Zone Coverage</Typography>
                                <TextField
                                    size="small"
                                    value={settings.lnClickZoneCoverage ?? 60}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        if (!isNaN(val) && val >= 30 && val <= 100) {
                                            onUpdateSettings('lnClickZoneCoverage', val);
                                        }
                                    }}
                                    type="number"
                                    inputProps={{ min: 30, max: 100, step: 10 }}
                                    sx={getInputStyles(theme)}
                                    InputProps={{
                                        endAdornment: <InputAdornment position="end" sx={{ color: theme.fg }}>%</InputAdornment>
                                    }}
                                />
                            </Box>
                            <Slider
                                value={settings.lnClickZoneCoverage ?? 60}
                                min={30}
                                max={100}
                                step={10}
                                onChange={(_, v) => onUpdateSettings('lnClickZoneCoverage', v as number)}
                                sx={{ color: theme.fg }}
                            />
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}>
                                How much of the edge the zone covers
                            </Typography>
                        </Box>
                    )}
                </>
            )}
        </>
    )}
</Box>
<Divider sx={{ my: 3, borderColor: `${theme.fg}22` }} />

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
                                    '& .MuiSwitch-switchBase.Mui-checked': { color: theme.fg },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: theme.fg },
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
                                    '& .MuiSwitch-switchBase.Mui-checked': { color: theme.fg },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: theme.fg },
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
                            sx={{ color: theme.fg }}
                        />
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7, color: theme.fg }}>
                            Display character count and percentage instead of page numbers
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.enableYomitan}
                                onChange={(e) => onUpdateSettings('enableYomitan', e.target.checked)}
                                sx={{
                                    '& .MuiSwitch-switchBase.Mui-checked': { color: theme.fg },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: theme.fg },
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
                        <Divider sx={{ my: 3, borderColor: `${theme.fg}22` }} />
                        <Button
                            variant="outlined"
                            color="inherit"
                            fullWidth
                            startIcon={<RestartAltIcon />}
                            onClick={onResetSettings}
                            sx={{ borderColor: `${theme.fg}44`, color: theme.fg }}
                        >
                            Reset Defaults
                        </Button>
                    </>
                )}
            </Box>
        </Drawer>
    );
};