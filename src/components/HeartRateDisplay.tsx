
import React, { memo, useEffect, useRef } from 'react';
import { optimizeElement } from '../utils/displayOptimizer';

interface HeartRateDisplayProps {
  bpm: number;
  confidence: number;
}

/**
 * Componente para mostrar la frecuencia cardíaca 
 * procesada por el optimizador de señales principal
 */
const HeartRateDisplay = memo(({ bpm, confidence }: HeartRateDisplayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isReliable = confidence > 0.5;
  
  // Apply high-DPI optimizations after component mounts
  useEffect(() => {
    if (containerRef.current) {
      optimizeElement(containerRef.current);
    }
  }, []);
  
  const getValueClass = () => {
    if (!isReliable) return "text-gray-500";
    if (bpm > 100) return "value-warning";
    if (bpm < 60) return "value-warning";
    return "value-normal";
  };

  return (
    <div 
      ref={containerRef}
      className="bg-black/40 backdrop-blur-sm rounded-lg p-3 text-center will-change-transform performance-boost ppg-graph"
      style={{
        transform: 'translate3d(0, 0, 0)',
        backfaceVisibility: 'hidden',
        contain: 'layout paint style'
      }}
    >
      <h3 className="text-gray-400/90 text-sm mb-1 crisp-text precision-text">Heart Rate</h3>
      <div className="flex items-baseline justify-center gap-1">
        <span className={`text-2xl font-bold vital-display precision-number ${getValueClass()}`}>
          {bpm > 0 ? bpm : '--'}
        </span>
        <span className="text-gray-400/90 text-xs unit-text">BPM</span>
      </div>
    </div>
  );
});

HeartRateDisplay.displayName = 'HeartRateDisplay';

export default HeartRateDisplay;
