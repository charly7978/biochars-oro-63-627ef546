
import React, { memo, useEffect, useRef } from 'react';
import { optimizeElement } from '../utils/displayOptimizer';

interface GlucoseDisplayProps {
  value: number;
  confidence?: number;
}

const GlucoseDisplay = memo(({ value, confidence = 0 }: GlucoseDisplayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isReliable = confidence > 0.3;
  
  // Apply high-DPI optimizations after component mounts
  useEffect(() => {
    if (containerRef.current) {
      optimizeElement(containerRef.current);
    }
  }, []);
  
  const getValueClass = () => {
    if (!isReliable) return "text-gray-500";
    if (value > 126) return "text-[#ea384c]"; // Hiperglucemia
    if (value < 70) return "text-[#F97316]"; // Hipoglucemia
    return "text-white";
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
      <h3 className="text-gray-400/90 text-sm mb-1 crisp-text precision-text">Glucosa</h3>
      <div className="flex items-baseline justify-center gap-1">
        <span className={`text-2xl font-bold vital-display precision-number ${getValueClass()}`}>
          {value > 0 ? value : '--'}
        </span>
        <span className="text-gray-400/90 text-xs unit-text">mg/dL</span>
      </div>
    </div>
  );
});

GlucoseDisplay.displayName = 'GlucoseDisplay';

export default GlucoseDisplay;
