
import React, { memo } from 'react';

interface HeartRateDisplayProps {
  bpm: number;
  confidence: number;
}

const HeartRateDisplay = memo(({ bpm, confidence }: HeartRateDisplayProps) => {
  const isReliable = confidence > 0.5;
  
  const getValueClass = () => {
    if (!isReliable) return "text-gray-500";
    if (bpm > 100) return "value-warning";
    if (bpm < 60) return "value-warning";
    return "value-normal";
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 text-center will-change-transform">
      <h3 className="text-gray-400/90 text-sm mb-1 crisp-text">Heart Rate</h3>
      <div className="flex items-baseline justify-center gap-1">
        <span className={`text-2xl font-bold vital-display ${getValueClass()}`}>
          {bpm > 0 ? bpm : '--'}
        </span>
        <span className="text-gray-400/90 text-xs unit-text">BPM</span>
      </div>
    </div>
  );
});

HeartRateDisplay.displayName = 'HeartRateDisplay';

export default HeartRateDisplay;
