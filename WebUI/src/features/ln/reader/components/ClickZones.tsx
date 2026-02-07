import React from 'react';
import './ClickZones.css';

export type ZonePosition = 'full' | 'start' | 'center' | 'end';
export type ZonePlacement = 'horizontal' | 'vertical';

interface ClickZonesProps {
    isVertical: boolean;
    canGoNext: boolean;
    canGoPrev: boolean;
    /** Zone thickness as percentage (10-50) */
    zoneSize?: number;
    /** Position along the edge */
    zonePosition?: ZonePosition;
    /** How much of the edge to cover when not 'full' (30-100) */
    zoneCoverage?: number;
    /** Zone placement: horizontal (top/bottom), vertical (left/right) */
    zonePlacement?: ZonePlacement;
    /** Show zones faintly when UI is visible */
    visible?: boolean;
    /** Show zones clearly in debug mode */
    debugMode?: boolean;
}

/**
 * Visual debug component for click zones.
 */
export const ClickZones: React.FC<ClickZonesProps> = ({
    isVertical,
    canGoNext,
    canGoPrev,
    zoneSize = 10,
    zonePosition = 'full',
    zoneCoverage = 60,
    zonePlacement = 'vertical',
    visible = false,
    debugMode = false,
}) => {
    // Render when visible OR debug mode is on
    if (!visible && !debugMode) return null;

    // Determine actual zone orientation based on placement setting
    const zonesAreVertical = zonePlacement === 'horizontal' ? false : true;

    const thickness = `${Math.min(Math.max(zoneSize, 0), 50)}%`;

    // Calculate position offset for zones
    const getPositionStyle = (isPrev: boolean): React.CSSProperties => {
        const coverageNum = Math.min(Math.max(zoneCoverage, 30), 100);
        const offset = (100 - coverageNum) / 2;

        if (zonesAreVertical) {
            // Vertical zones: prev on right, next on left
            const baseStyle: React.CSSProperties = isPrev 
                ? { right: 0 } 
                : { left: 0 };

            if (zonePosition === 'full') {
                // Full edge: span entire height
                return { ...baseStyle, top: 0, bottom: 0 };
            }

            switch (zonePosition) {
                case 'start':
                    return { ...baseStyle, top: 0, height: `${coverageNum}%` };
                case 'end':
                    return { ...baseStyle, bottom: 0, height: `${coverageNum}%` };
                case 'center':
                default:
                    return { ...baseStyle, top: `${offset}%`, height: `${coverageNum}%` };
            }
        } else {
            // Horizontal zones: prev on top, next on bottom
            const baseStyle: React.CSSProperties = isPrev 
                ? { top: 0 } 
                : { bottom: 0 };

            if (zonePosition === 'full') {
                // Full edge: span entire width
                return { ...baseStyle, left: 0, right: 0 };
            }

            switch (zonePosition) {
                case 'start':
                    return { ...baseStyle, left: 0, width: `${coverageNum}%` };
                case 'end':
                    return { ...baseStyle, right: 0, width: `${coverageNum}%` };
                case 'center':
                default:
                    return { ...baseStyle, left: `${offset}%`, width: `${coverageNum}%` };
            }
        }
    };

    const prevPositionStyle = getPositionStyle(true);
    const nextPositionStyle = getPositionStyle(false);

    const visualClass = debugMode ? 'debug' : 'faint';

    return (
        <>
            {/* Previous zone - visual only */}
            <div
                className={`click-zone-visual ${zonesAreVertical ? 'vertical' : 'horizontal'} prev ${visualClass} ${!canGoPrev ? 'disabled' : ''}`}
                style={{
                    [zonesAreVertical ? 'width' : 'height']: thickness,
                    ...prevPositionStyle,
                }}
                aria-label="Previous page zone"
            />
            
            {/* Next zone - visual only */}
            <div
                className={`click-zone-visual ${zonesAreVertical ? 'vertical' : 'horizontal'} next ${visualClass} ${!canGoNext ? 'disabled' : ''}`}
                style={{
                    [zonesAreVertical ? 'width' : 'height']: thickness,
                    ...nextPositionStyle,
                }}
                aria-label="Next page zone"
            />
        </>
    );
};


export function getClickZone(
    clientX: number,
    clientY: number,
    containerRect: DOMRect,
    isVertical: boolean,
    zonePlacement: ZonePlacement,
    zoneSize: number,
    zonePosition: ZonePosition,
    zoneCoverage: number
): 'prev' | 'next' | null {
    const zonesAreVertical = zonePlacement === 'horizontal' ? false : true;
    const size = Math.min(Math.max(zoneSize, 0), 50) / 100;
    const coverage = Math.min(Math.max(zoneCoverage, 30), 100) / 100;

    const relX = (clientX - containerRect.left) / containerRect.width;
    const relY = (clientY - containerRect.top) / containerRect.height;

    if (zonesAreVertical) {
        let zoneStartY = 0;
        let zoneEndY = 1;

        if (zonePosition !== 'full') {
            const zoneHeight = coverage;
            const zoneOffset = (1 - zoneHeight) / 2;
            
            switch (zonePosition) {
                case 'start':
                    zoneStartY = 0;
                    zoneEndY = zoneHeight;
                    break;
                case 'end':
                    zoneStartY = 1 - zoneHeight;
                    zoneEndY = 1;
                    break;
                case 'center':
                default:
                    zoneStartY = zoneOffset;
                    zoneEndY = zoneOffset + zoneHeight;
                    break;
            }
        }

        const inZoneY = relY >= zoneStartY && relY <= zoneEndY;
        if (!inZoneY) return null;

        if (relX <= size) return 'next';
        if (relX >= 1 - size) return 'prev';
    } else {
       
        let zoneStartX = 0;
        let zoneEndX = 1;

        if (zonePosition !== 'full') {
            const zoneWidth = coverage;
            const zoneOffset = (1 - zoneWidth) / 2;
            
            switch (zonePosition) {
                case 'start':
                    zoneStartX = 0;
                    zoneEndX = zoneWidth;
                    break;
                case 'end':
                    zoneStartX = 1 - zoneWidth;
                    zoneEndX = 1;
                    break;
                case 'center':
                default:
                    zoneStartX = zoneOffset;
                    zoneEndX = zoneOffset + zoneWidth;
                    break;
            }
        }

        const inZoneX = relX >= zoneStartX && relX <= zoneEndX;
        if (!inZoneX) return null;

        if (relY <= size) return 'prev';
        if (relY >= 1 - size) return 'next';
    }

    return null;
}