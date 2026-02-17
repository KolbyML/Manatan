

import React from 'react';
import { Settings } from '@/Manatan/types';

interface ChapterBlockProps {
    html: string | null;
    index: number;
    isLoading: boolean;
    isVertical: boolean;
    settings: Settings;
}

export const ChapterBlock: React.FC<ChapterBlockProps> = React.memo(
    ({ html, index, isLoading, isVertical, settings }) => {
        if (isLoading || !html) {
            return (
                <div
                    className={`chapter-loading ${isVertical ? 'vertical' : 'horizontal'}`}
                    data-chapter={index}
                >
                    <div className="loading-spinner" />
                    <span>Loading chapter {index + 1}...</span>
                </div>
            );
        }

        // Build font family with secondary font
        let fontFamily = settings.lnFontFamily || "'Noto Serif JP', serif";
        if (settings.lnSecondaryFontFamily) {
            fontFamily = `${fontFamily}, ${settings.lnSecondaryFontFamily}`;
        }

        return (
            <section
                className={`chapter-block ${isVertical ? 'vertical' : 'horizontal'} ${!settings.lnEnableFurigana ? 'furigana-hidden' : ''
                    }`}
                data-chapter={index}
                style={{
                    padding: `${settings.lnPageMargin || 20}px`,
                    maxWidth: !isVertical ? `${settings.lnPageWidth || 800}px` : undefined,
                    textAlign: (settings.lnTextAlign as any) || 'justify',
                    fontFamily,
                    fontWeight: settings.lnFontWeight || 400,
                }}
            >
                <div
                    className="chapter-content"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </section>
        );
    }
);

ChapterBlock.displayName = 'ChapterBlock';