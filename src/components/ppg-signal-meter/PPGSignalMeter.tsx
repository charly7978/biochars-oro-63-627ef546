
import React, { useCallback, memo, useState, useEffect } from 'react';
import { PPGSignalMeterProps } from './types';
import { useSignalQuality } from './useSignalQuality';
import { useSignalData } from './useSignalData';
import SignalDisplay from './SignalDisplay';
import QualityIndicator from './QualityIndicator';
import ControlButtons from './ControlButtons';

// Enhanced PPGSignalMeter with centralized signal processing
const PPGSignalMeter = memo(({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  preserveResults = false,
  isArrhythmia = false
}: PPGSignalMeterProps) => {
  // State for enhanced finger detection
  const [enhancedFingerDetected, setEnhancedFingerDetected] = useState(false);
  const [enhancedQuality, setEnhancedQuality] = useState(0);
  
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

  // Update signal quality on each render with enhanced parameters
  useEffect(() => {
    // Process signal with more weight on history
    const baseQuality = quality < 25 && value > 1 ? quality * 1.3 : quality;
    const baseDetection = isFingerDetected || baseQuality > 35;
    
    updateSignalQuality(value, baseQuality, baseDetection, null, null);
    
    // Use the signal quality hooks to get enhanced detection
    const trueDetection = getTrueFingerDetection();
    const avgQuality = getAverageQuality();
    
    // Apply additional heuristics for signal detection
    const signalStrengthBasedDetection = 
      Math.abs(value) > 0.8 || // Strong signal
      (Math.abs(value) > 0.3 && avgQuality > 30); // Moderate signal with decent quality
    
    // Combine various detection methods
    const finalDetection = trueDetection || (baseDetection && avgQuality > 25) || signalStrengthBasedDetection;
    
    // Adjust quality based on finger detection state
    const adjustedQuality = finalDetection ? Math.max(quality, avgQuality * 0.9) : Math.min(quality, avgQuality);
    
    // Update state for rendering
    setEnhancedFingerDetected(finalDetection);
    setEnhancedQuality(adjustedQuality);
    
    // Log detailed info for debugging
    if (Math.random() < 0.02) {
      console.log("PPGSignalMeter: Enhanced detection", {
        originalIsFingerDetected: isFingerDetected,
        originalQuality: quality,
        value,
        avgQuality,
        trueDetection,
        signalStrengthBasedDetection,
        finalDetection,
        adjustedQuality
      });
    }
  }, [value, quality, isFingerDetected, updateSignalQuality, getTrueFingerDetection, getAverageQuality]);

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
        isFingerDetected={enhancedFingerDetected}
        preserveResults={preserveResults}
      />

      <QualityIndicator 
        quality={enhancedQuality}
        getAverageQuality={getAverageQuality}
        getTrueFingerDetection={() => enhancedFingerDetected}
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
