import { forwardRef, ReactNode, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import { useMergedRef } from '@mantine/hooks';
import { useMobileZoomPan } from './useMobileZoomPan';
import { useReaderZoom } from './ReaderZoomContext';
import { ReadingMode, ReadingDirection } from '@/features/reader/Reader.types';
import { isContinuousVerticalReadingMode } from '@/features/reader/settings/ReaderSettings.utils';
import { useOCR } from '@/Manatan/context/OCRContext';

interface ReaderZoomWrapperProps {
    children: ReactNode;
    scrollContainerRef: React.RefObject<HTMLElement | null>;
    readingMode: ReadingMode;
    readingDirection: ReadingDirection;
    enabled?: boolean;
}

export const ReaderZoomWrapper = forwardRef<HTMLDivElement, ReaderZoomWrapperProps>(
    ({ children, scrollContainerRef, readingMode, readingDirection, enabled = true }, ref) => {
        const sizerRef = useRef<HTMLDivElement>(null);
        const contentRef = useRef<HTMLDivElement>(null);
        const mergedRef = useMergedRef(ref, contentRef);
        const { setScale } = useReaderZoom();
        const { settings } = useOCR();

        const isVertical = isContinuousVerticalReadingMode(readingMode);
        const isRTL = readingDirection === ReadingDirection.RTL;

        const { scale, isZoomed, isZooming } = useMobileZoomPan(
            scrollContainerRef,
            contentRef,
            sizerRef,
            {
                enabled,
                isVertical,
                isRTL,
                doubleTapZoomEnabled: settings.enableDoubleTapZoom,
                onScaleChange: setScale,
            }
        );

        useEffect(() => {
            if (isZoomed) {
                document.body.classList.add('reader-zoomed');
            } else {
                document.body.classList.remove('reader-zoomed');
            }
            return () => document.body.classList.remove('reader-zoomed');
        }, [isZoomed]);

        // Calculate sizer dimensions based on scroll direction
        const sizerSx = isVertical
            ? {
                width: scale > 1 ? `${scale * 100}%` : '100%',
                minHeight: '100%',
            }
            : {
                minWidth: '100%',
                height: scale > 1 ? `${scale * 100}%` : '100%',
            };

        // Calculate content dimensions (inverse of sizer scaling)
        const contentSx = isVertical
            ? {
                width: scale > 1 ? `${100 / scale}%` : '100%',
                minHeight: '100%',
            }
            : {
                minWidth: '100%',
                height: scale > 1 ? `${100 / scale}%` : '100%',
            };

        // Transform origin depends on reading direction for horizontal mode
        const transformOrigin = isVertical
            ? 'top left'
            : isRTL
                ? 'top right'
                : 'top left';

        return (
            <Box
                ref={sizerRef}
                className="zoom-sizer"
                sx={{
                    ...sizerSx,
                    display: 'flex',
                    flexDirection: isVertical ? 'column' : 'row',
                }}
            >
                <Box
                    ref={mergedRef}
                    className="zoom-content"
                    sx={{
                        ...contentSx,
                        transform: `scale(${scale})`,
                        transformOrigin,
                        transition: isZooming ? 'none' : 'transform 0.15s ease-out',
                        willChange: isZooming ? 'transform' : 'auto',
                        display: 'flex',
                        flexDirection: isVertical ? 'column' : 'row',
                    }}
                >
                    {children}
                </Box>
            </Box>
        );
    }
);

ReaderZoomWrapper.displayName = 'ReaderZoomWrapper';
