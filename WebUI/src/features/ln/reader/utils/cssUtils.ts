/**
 * Strips all @font-face rules from CSS.
 * This allows reader font settings to take precedence over EPUB embedded fonts.
 */
export function stripFontFaces(css: string | null | undefined): string {
    if (!css) return '';
    
    let result = css;
    
    // Pattern 1: Simple @font-face blocks
    result = result.replace(/@font-face\s*\{[^}]*\}/gi, '');
    
    // Pattern 2: @font-face with nested braces (rare but possible)
    result = result.replace(/@font-face\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gi, '');
    
    // Clean up extra whitespace left behind
    result = result.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return result.trim();
}

/**
 * Strips font-family declarations that might override reader settings.
 */
export function stripFontFamilyDeclarations(css: string): string {
    return css.replace(/font-family\s*:[^;]+;/gi, '');
}

/**
 * Strips writing-mode declarations so reader's direction toggle works.
 */
export function stripWritingModeDeclarations(css: string): string {
    return css.replace(/(?:-webkit-|-epub-)?writing-mode\s*:[^;]+;/gi, '');
}

/**
 * Strips text-align declarations so reader's alignment setting works.
 */
export function stripTextAlignDeclarations(css: string): string {
    return css.replace(/text-align\s*:[^;]+;/gi, '');
}

/**
 * Full CSS sanitization for reader use.
 * Strips fonts, font-family, writing-mode, and text-align declarations
 * so reader settings take precedence.
 */
export function sanitizeEpubCss(css: string | null | undefined): string {
    if (!css) return '';
    
    let result = stripFontFaces(css);
    result = stripFontFamilyDeclarations(result);
    result = stripWritingModeDeclarations(result);
    result = stripTextAlignDeclarations(result);
    
    return result;
}
