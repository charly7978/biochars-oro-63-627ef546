
import React, { useCallback, memo } from 'react';
import { PPGSignalMeterProps } from './types';
import { useSignalQuality } from './useSignalQuality';
import { useSignalData } from './useSignalData';
import SignalDisplay from './SignalDisplay';
import QualityIndicator from './QualityIndicator';
import ControlButtons from './ControlButtons';

const PPGSignalMeter = memo(({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  preserveResults = false,
  isArrhythmia = false
}: PPGSignalMeterProps) => {
  const {
    getAverageQuality,
    getTrueFingerDetection,
    getQualityColor,
    getQualityText,
    updateSignalQuality,
    resetSignalQuality
  } = useSignalQuality();

  const {
    resetArrhythmiaData
  } = useSignalData();

  // Update signal quality on each render
  updateSignalQuality(value, quality, isFingerDetected, null, null);

  const handleReset = useCallback(() => {
    resetSignalQuality();
    resetArrhythmiaData();
    onReset();
  }, [onReset, resetSignalQuality, resetArrhythmiaData]);

  return (
    <div className="fixed inset-0 bg-black/5 backdrop-blur-[1px] flex flex-col transform-gpu will-change-transform">
      <SignalDisplay 
        value={value}
        isArrhythmia={isArrhythmia}
        isFingerDetected={isFingerDetected}
        preserveResults={preserveResults}
      />

      <QualityIndicator 
        quality={quality}
        getAverageQuality={getAverageQuality}
        getTrueFingerDetection={getTrueFingerDetection}
        getQualityColor={getQualityColor}
        getQualityText={getQualityText}
      />

      <ControlButtons 
        onStartMeasurement={onStartMeasurement}
        onReset={handleReset}
      />
    </div>
  );
});

PPGSignalMeter.displayName = 'PPGSignalMeter';

export default PPGSignalMeter;
