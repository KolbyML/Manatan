import { Settings } from '@/Manatan/types';
import { CSSProperties } from 'react';

export function buildTypographyStyles(settings: Settings, isVertical: boolean): CSSProperties {
    const textAlign = (settings.lnTextAlign as any) || 'justify';
    
    return {
        fontFamily: settings.lnFontFamily || "'Noto Serif JP', serif",
        fontSize: `${settings.lnFontSize || 18}px`,
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