
import React, { memo, useEffect, useRef } from 'react';
import { optimizeElement } from '../utils/displayOptimizer';

interface HeartRateDisplayProps {
  bpm: number;
  confidence: number;
}

const HeartRateDisplay = memo(({ bpm, confidence }: HeartRateDisplayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isReliable = confidence > 0.5;
  
  // Apply high-DPI optimizations after component mounts
  useEffect(() => {
    // Only optimize when the component is visible and mounted
    if (containerRef.current) {
      optimizeElement(containerRef.current);
    }
    
    // Clean up function to improve memory management
    return () => {
      // No specific cleanup needed for this component,
      // but this is where you would clean up any subscriptions or timers
    };
  }, []); // Only run once on mount
  
  const getValueClass = () => {
    if (!isReliable) return "text-gray-500";
    if (bpm > 100) return "value-warning";
    if (bpm < 60) return "value-warning";
    return "value-normal";
  };

  return (
    <div 
      ref={containerRef}
      className="bg-black/40 backdrop-blur-sm rounded-lg p-3 text-center ppg-graph"
      // Remove inline styles that would trigger unnecessary style recalculations
      // Let the optimizeElement function handle these properties
    >
      <h3 className="text-gray-400/90 text-sm mb-1 precision-text">Heart Rate</h3>
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
