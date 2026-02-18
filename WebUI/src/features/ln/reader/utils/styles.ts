import { Settings } from '@/Manatan/types';
import { CSSProperties } from 'react';

export function buildTypographyStyles(settings: Settings, isVertical: boolean): CSSProperties {
    const textAlign = (settings.lnTextAlign as any) || 'justify';
    const fontWeight = settings.lnFontWeight || 400;
    
    // Build font family with secondary font
    let fontFamily = settings.lnFontFamily || "'Noto Serif JP', serif";
    if (settings.lnSecondaryFontFamily) {
        fontFamily = `${fontFamily}, ${settings.lnSecondaryFontFamily}`;
    }
    
    return {
        fontFamily,
        fontSize: `${settings.lnFontSize || 18}px`,
        fontWeight,
        lineHeight: settings.lnLineHeight || 1.8,
        letterSpacing: `${settings.lnLetterSpacing || 0}px`,
        textAlign: textAlign,
        textAlignLast: textAlign === 'justify' ? 'start' : textAlign,
        writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
        textOrientation: isVertical ? 'mixed' : undefined,
    };
}

export function buildContainerStyles(
    settings: Settings,
    isVertical: boolean,
    isRTL: boolean
): CSSProperties {
    return {
        ...buildTypographyStyles(settings, isVertical),
        direction: isVertical ? (isRTL ? 'rtl' : 'ltr') : 'ltr',
        scrollBehavior: isVertical ? 'auto' : 'smooth',
    };
}