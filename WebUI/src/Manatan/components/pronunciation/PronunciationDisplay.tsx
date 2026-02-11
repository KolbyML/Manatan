import React, { useState, useEffect, useMemo } from 'react';
import { DictionaryResult } from '@/Manatan/types';

interface PitchInfo {
  position: number | string;
  nasal?: number[];
  devoice?: number[];
  tags?: string[];
}

interface PitchAccent {
  reading: string;
  pitches: PitchInfo[];
}

interface IpaTranscription {
  ipa: string;
  tags?: string[];
}

interface IpaData {
  reading: string;
  transcriptions: IpaTranscription[];
}

// Utility to split reading into morae
const getMorae = (reading: string): string[] => {
  const morae: string[] = [];
  let i = 0;
  while (i < reading.length) {
    const char = reading[i];
    const nextChar = reading[i + 1];
    
    // Handle small kana combinations (ゃ, ゅ, ょ, っ, etc.)
    if (nextChar && (nextChar === 'ゃ' || nextChar === 'ゅ' || nextChar === 'ょ' || nextChar === 'ゃ' || nextChar === 'ゅ' || nextChar === 'ょ')) {
      morae.push(char + nextChar);
      i += 2;
    } else if (char === 'っ' || char === 'ッ') {
      // Sokuon (geminate consonant)
      morae.push(char);
      i += 1;
    } else if (char === 'ー' || char === '〜') {
      // Long vowel marker
      morae.push(char);
      i += 1;
    } else {
      morae.push(char);
      i += 1;
    }
  }
  return morae;
};

// Check if mora is at high pitch
const isMoraPitchHigh = (index: number, pitchPosition: number | string): boolean => {
  if (typeof pitchPosition === 'number') {
    if (pitchPosition === 0) {
      // Heiban (平板): low at start, high after
      return index > 0;
    } else {
      // Atamadaka (頭高): high at start, low after pitchPosition
      // Nakadaka (中高): low at start, high until pitchPosition, low after
      // Odaka (尾高): low at start, high until pitchPosition, low after
      return index > 0 && index < pitchPosition;
    }
  } else {
    // HL pattern string
    const pattern = pitchPosition as string;
    const char = pattern[index] || pattern[pattern.length - 1];
    return char === 'H';
  }
};

// Pitch Text Component (inline text notation)
const PitchText: React.FC<{ morae: string[]; pitchPosition: number | string }> = ({ morae, pitchPosition }) => {
  return (
    <span className="pronunciation-text">
      {morae.map((mora, index) => {
        const isHigh = isMoraPitchHigh(index, pitchPosition);
        const isHighNext = isMoraPitchHigh(index + 1, pitchPosition);
        const hasDownstep = isHigh && !isHighNext && index < morae.length - 1;
        
        return (
          <span
            key={index}
            className="pronunciation-mora"
            data-pitch={isHigh ? 'high' : 'low'}
            data-pitch-next={isHighNext ? 'high' : 'low'}
            style={{
              display: 'inline-block',
              position: 'relative',
              marginRight: hasDownstep ? '0.1em' : undefined,
            }}
          >
            <span className="pronunciation-character">{mora}</span>
            {/* Overline for high pitch */}
            {isHigh && (
              <span
                className="pronunciation-mora-line"
                style={{
                  display: 'block',
                  position: 'absolute',
                  top: '-0.1em',
                  left: 0,
                  right: hasDownstep ? '-0.1em' : 0,
                  height: 0,
                  borderTopWidth: '0.1em',
                  borderTopStyle: 'solid',
                  borderColor: 'currentColor',
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* Downstep marker */}
            {hasDownstep && (
              <span
                style={{
                  display: 'block',
                  position: 'absolute',
                  top: '-0.1em',
                  right: '-0.15em',
                  height: '0.5em',
                  width: 0,
                  borderRightWidth: '0.1em',
                  borderRightStyle: 'solid',
                  borderColor: 'currentColor',
                  pointerEvents: 'none',
                }}
              />
            )}
          </span>
        );
      })}
    </span>
  );
};

// Pitch Graph Component (Yomitan-style SVG)
const PitchGraph: React.FC<{ morae: string[]; pitchPosition: number | string }> = ({ morae, pitchPosition }) => {
  const svgContent = useMemo(() => {
    if (morae.length === 0) return null;
    
    const stepWidth = 50;
    const svgWidth = (morae.length + 1) * stepWidth;
    const svgHeight = 100;
    
    // Calculate points for the line
    const points: { x: number; y: number; isDownstep: boolean }[] = [];
    for (let i = 0; i < morae.length; i++) {
      const isHigh = isMoraPitchHigh(i, pitchPosition);
      const isHighNext = isMoraPitchHigh(i + 1, pitchPosition);
      const x = i * stepWidth + 25;
      const y = isHigh ? 25 : 75;
      points.push({ x, y, isDownstep: isHigh && !isHighNext });
    }
    
    // Add final point (triangle)
    const lastHigh = isMoraPitchHigh(morae.length, pitchPosition);
    const finalX = morae.length * stepWidth + 25;
    const finalY = lastHigh ? 25 : 75;
    
    return {
      width: svgWidth,
      height: svgHeight,
      points,
      finalX,
      finalY,
      finalHigh: lastHigh,
    };
  }, [morae, pitchPosition]);
  
  if (!svgContent) return null;
  
  const { width, height, points, finalX, finalY } = svgContent;
  
  // Generate path string
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const tailD = points.length > 0 
    ? `M${points[points.length - 1].x} ${points[points.length - 1].y} L${finalX} ${finalY}`
    : '';
  
  return (
    <svg
      className="pronunciation-graph"
      width={(width * 0.6) + 'px'}
      height="50px"
      viewBox={`0 0 ${width} ${height}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    >
      {/* Main line */}
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
      />
      {/* Tail line (dashed) */}
      <path
        d={tailD}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeDasharray="5 5"
      />
      {/* Dots for each mora */}
      {points.map((p, i) => (
        <g key={i}>
          {p.isDownstep ? (
            // Downstep marker (hollow circle)
            <>
              <circle
                cx={p.x}
                cy={p.y}
                r="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
              />
              <circle
                cx={p.x}
                cy={p.y}
                r="5"
                fill="currentColor"
              />
            </>
          ) : (
            // Regular dot
            <circle
              cx={p.x}
              cy={p.y}
              r="15"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="5"
            />
          )}
        </g>
      ))}
      {/* Final triangle */}
      <path
        d={`M${finalX} ${finalY - 13} L${finalX + 15} ${finalY + 13} L${finalX - 15} ${finalY + 13} Z`}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
      />
    </svg>
  );
};

// IPA Display Component
const IpaDisplay: React.FC<{ transcriptions: IpaTranscription[] }> = ({ transcriptions }) => {
  return (
    <div className="ipa-transcriptions">
      {transcriptions.map((trans, idx) => (
        <div
          key={idx}
          style={{
            fontFamily: 'Lucida Sans Unicode, Arial Unicode MS, sans-serif',
            fontSize: '1.1em',
            marginBottom: '4px',
            color: 'inherit',
          }}
        >
          {trans.ipa}
          {trans.tags && trans.tags.length > 0 && (
            <span
              style={{
                fontSize: '0.7em',
                color: '#888',
                marginLeft: '8px',
              }}
            >
              ({trans.tags.join(', ')})
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

// Main Pronunciation Display Component
export const PronunciationDisplay: React.FC<{
  entry: DictionaryResult;
}> = ({ entry }) => {
  const [pitchAccents, setPitchAccents] = useState<PitchAccent[]>([]);
  const [ipaTranscriptions, setIpaTranscriptions] = useState<IpaData[]>([]);
  
  const { pitchData, ipaData, reading } = entry;
  
  // Parse pitch data
  useEffect(() => {
    if (pitchData && pitchData.length > 0) {
      const parsed = pitchData
        .map(data => {
          try {
            // Remove "Pitch: " prefix if present
            const jsonStr = data.replace(/^Pitch:\s*/, '');
            const obj = JSON.parse(jsonStr);
            if (obj.reading && obj.pitches) {
              return obj as PitchAccent;
            }
            return null;
          } catch {
            return null;
          }
        })
        .filter((p): p is PitchAccent => p !== null);
      setPitchAccents(parsed);
    } else {
      setPitchAccents([]);
    }
  }, [pitchData]);
  
  // Parse IPA data
  useEffect(() => {
    if (ipaData && ipaData.length > 0) {
      const parsed = ipaData
        .map(data => {
          try {
            // Remove "IPA: " prefix if present
            const jsonStr = data.replace(/^IPA:\s*/, '');
            const obj = JSON.parse(jsonStr);
            if (obj.reading && obj.transcriptions) {
              return obj as IpaData;
            }
            return null;
          } catch {
            return null;
          }
        })
        .filter((p): p is IpaData => p !== null);
      setIpaTranscriptions(parsed);
    } else {
      setIpaTranscriptions([]);
    }
  }, [ipaData]);
  
  // Don't render if no pronunciation data
  if (pitchAccents.length === 0 && ipaTranscriptions.length === 0) {
    return null;
  }
  
  const morae = getMorae(reading);
  
  return (
    <div
      className="pronunciation-display"
      style={{
        marginTop: '12px',
        padding: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Section Header */}
      <h4
        style={{
          margin: '0 0 10px 0',
          fontSize: '0.85em',
          color: '#aaa',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Pronunciation
      </h4>
      
      {/* Pitch Accent Section */}
      {pitchAccents.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <h5
            style={{
              margin: '0 0 8px 0',
              fontSize: '0.75em',
              color: '#888',
              fontWeight: '500',
            }}
          >
            Pitch Accent
          </h5>
          {pitchAccents.map((accent, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: '12px',
                padding: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '4px',
              }}
            >
              {accent.pitches.map((pitch, pIdx) => (
                <div key={pIdx} style={{ marginBottom: '8px' }}>
                  {/* Text notation */}
                  <div style={{ marginBottom: '6px', fontSize: '1.1em' }}>
                    <PitchText morae={morae} pitchPosition={pitch.position} />
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '0.8em',
                        color: '#666',
                      }}
                    >
                      [{typeof pitch.position === 'number' ? pitch.position : 'pattern'}]
                    </span>
                  </div>
                  {/* Graph */}
                  <PitchGraph morae={morae} pitchPosition={pitch.position} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      
      {/* IPA Section */}
      {ipaTranscriptions.length > 0 && (
        <div>
          <h5
            style={{
              margin: '0 0 8px 0',
              fontSize: '0.75em',
              color: '#888',
              fontWeight: '500',
            }}
          >
            IPA Transcription
          </h5>
          {ipaTranscriptions.map((ipa, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: '8px',
                padding: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '4px',
              }}
            >
              <IpaDisplay transcriptions={ipa.transcriptions} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
