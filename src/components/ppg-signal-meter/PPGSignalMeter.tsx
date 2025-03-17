
import React, { useCallback, memo, useState, useEffect, useRef } from 'react';
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
  isArrhythmia = false,
  arrhythmiaStatus = '--'
}: PPGSignalMeterProps) => {
  console.log("PPGSignalMeter: Render with props", { 
    value, 
    quality, 
    isFingerDetected, 
    preserveResults,
    isArrhythmia
  });
  
  // State for enhanced finger detection
  const [enhancedFingerDetected, setEnhancedFingerDetected] = useState(false);
  const [enhancedQuality, setEnhancedQuality] = useState(0);
  const [debugInfo, setDebugInfo] = useState({ 
    valueHistory: [] as number[],
    detectionConfidence: 0,
    patterns: { hasPattern: false, patternStrength: 0 }
  });
  
  // Refs for tracking signal characteristics
  const valueHistoryRef = useRef<number[]>([]);
  const qualityHistoryRef = useRef<number[]>([]);
  const initialCalibrationRef = useRef(false);
  const stabilizationCounterRef = useRef(0);
  
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

  const detectPatterns = useCallback((values: number[]) => {
    if (values.length < 10) return { hasPattern: false, patternStrength: 0 };
    
    // Count direction changes (increases followed by decreases and vice versa)
    let directionChanges = 0;
    let lastDirection = 0;
    
    for (let i = 1; i < values.length; i++) {
      const currentDirection = values[i] > values[i-1] ? 1 : values[i] < values[i-1] ? -1 : 0;
      if (currentDirection !== 0 && lastDirection !== 0 && currentDirection !== lastDirection) {
        directionChanges++;
      }
      if (currentDirection !== 0) {
        lastDirection = currentDirection;
      }
    }
    
    // Check for consistent amplitude (not too flat, not too spiky)
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const hasReasonableRange = range > 0.3 && range < 10;
    
    // Calculate pattern strength - higher is better
    const patternStrength = (directionChanges / values.length) * 100 * (hasReasonableRange ? 1.5 : 0.5);
    
    // Log pattern details occasionally
    if (Math.random() < 0.05) {
      console.log("PPGSignalMeter: Pattern detection", {
        directionChanges, 
        hasReasonableRange,
        range,
        avg,
        patternStrength,
        hasPattern: directionChanges >= 3 && hasReasonableRange
      });
    }
    
    return { 
      hasPattern: directionChanges >= 3 && hasReasonableRange, 
      patternStrength 
    };
  }, []);

  // Enhanced finger detection logic that combines multiple indicators
  const calculateFingerPresence = useCallback((
    rawDetection: boolean, 
    qualityValue: number, 
    signalValue: number, 
    patterns: { hasPattern: boolean, patternStrength: number }
  ) => {
    // Store signal value for pattern analysis
    valueHistoryRef.current.push(signalValue);
    if (valueHistoryRef.current.length > 30) {
      valueHistoryRef.current.shift();
    }
    
    // Store quality value
    qualityHistoryRef.current.push(qualityValue);
    if (qualityHistoryRef.current.length > 10) {
      qualityHistoryRef.current.shift();
    }
    
    // Calculate average quality
    const avgQuality = qualityHistoryRef.current.length > 0 
      ? qualityHistoryRef.current.reduce((sum, q) => sum + q, 0) / qualityHistoryRef.current.length 
      : 0;
    
    // Base detection - original detection OR high quality
    const baseDetection = rawDetection || qualityValue > 50;
    
    // Pattern-based detection
    const patternDetection = patterns.hasPattern && patterns.patternStrength > 30;
    
    // Signal strength detection
    const hasNonZeroSignal = Math.abs(signalValue) > 0.2;
    const hasStrongSignal = Math.abs(signalValue) > 0.8;
    
    // Combined detection logic - require a minimum quality threshold
    // OR a combination of good patterns and reasonable signal strength
    const detectionConfidence = (
      (baseDetection ? 40 : 0) + 
      (patternDetection ? 30 : 0) + 
      (hasStrongSignal ? 20 : 0) +
      (hasNonZeroSignal ? 10 : 0) +
      Math.min(30, avgQuality / 3)
    ) / 100;
    
    // Stabilization logic to prevent rapid on/off switching
    if (detectionConfidence > 0.5) {
      stabilizationCounterRef.current = Math.min(10, stabilizationCounterRef.current + 1);
    } else {
      stabilizationCounterRef.current = Math.max(0, stabilizationCounterRef.current - 0.5);
    }
    
    const isStableDetection = stabilizationCounterRef.current >= 3;
    
    return {
      isFingerDetected: isStableDetection,
      confidence: detectionConfidence,
      avgQuality
    };
  }, []);

  // Update signal quality on each render with enhanced parameters
  useEffect(() => {
    // Skip initial processing during calibration phase
    if (!initialCalibrationRef.current && qualityHistoryRef.current.length < 5) {
      // During initial calibration, use the original detection values
      updateSignalQuality(value, quality, isFingerDetected, null, null);
      
      if (qualityHistoryRef.current.length === 0) {
        // Use this first value to initialize the quality history
        qualityHistoryRef.current = Array(5).fill(quality);
        console.log("PPGSignalMeter: Initial calibration phase", { quality });
      }
      
      // When we have enough samples, mark calibration as complete
      if (qualityHistoryRef.current.length >= 5) {
        initialCalibrationRef.current = true;
        console.log("PPGSignalMeter: Initial calibration complete");
      }
      
      // During calibration, pass through the original values
      setEnhancedFingerDetected(isFingerDetected);
      setEnhancedQuality(quality);
      return;
    }
    
    // Process signal with more weight on history
    const baseQuality = quality < 25 && value > 0.5 ? quality * 1.4 : quality;
    const baseDetection = isFingerDetected || baseQuality > 40;
    
    // Update the signal quality system
    updateSignalQuality(value, baseQuality, baseDetection, null, null);
    
    // Get values from the signal quality system
    const trueDetection = getTrueFingerDetection();
    const avgQuality = getAverageQuality();
    
    // Detect patterns in the signal value history
    const patterns = detectPatterns(valueHistoryRef.current);
    
    // Enhanced finger detection that combines multiple indicators
    const { isFingerDetected: enhancedDetection, confidence, avgQuality: calculatedAvgQuality } = 
      calculateFingerPresence(trueDetection, avgQuality, value, patterns);
    
    // Adjust quality based on finger detection state
    const adjustedQuality = enhancedDetection 
      ? Math.max(baseQuality, avgQuality * 0.9) 
      : Math.min(baseQuality, avgQuality);
    
    // Update state for rendering
    setEnhancedFingerDetected(enhancedDetection);
    setEnhancedQuality(adjustedQuality);
    setDebugInfo({
      valueHistory: [...valueHistoryRef.current],
      detectionConfidence: confidence,
      patterns
    });
    
    // Log detailed info for debugging
    if (Math.random() < 0.02) {
      console.log("PPGSignalMeter: Enhanced detection", {
        originalIsFingerDetected: isFingerDetected,
        originalQuality: quality,
        value,
        avgQuality,
        baseDetection,
        trueDetection,
        enhancedDetection,
        stabilityCounter: stabilizationCounterRef.current,
        confidence,
        patterns,
        adjustedQuality
      });
    }
  }, [value, quality, isFingerDetected, updateSignalQuality, getTrueFingerDetection, getAverageQuality, detectPatterns, calculateFingerPresence]);

  const handleReset = useCallback(() => {
    console.log("PPGSignalMeter: Reset requested");
    resetSignalQuality();
    resetArrhythmiaData();
    valueHistoryRef.current = [];
    qualityHistoryRef.current = [];
    stabilizationCounterRef.current = 0;
    initialCalibrationRef.current = false;
    onReset();
  }, [onReset, resetSignalQuality, resetArrhythmiaData]);

  const handleStartMeasurement = useCallback(() => {
    console.log("PPGSignalMeter: Start measurement requested");
    onStartMeasurement();
  }, [onStartMeasurement]);

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

      {/* Debug info overlay - could be hidden in production */}
      <div className="absolute top-2 right-2 z-50 bg-black/50 text-white text-xs rounded p-1" style={{ fontSize: '8px' }}>
        {arrhythmiaStatus !== '--' && (
          <div>ARR: {arrhythmiaStatus}</div>
        )}
        <div>Q: {enhancedQuality.toFixed(0)}</div>
        <div>FD: {enhancedFingerDetected ? 'Y' : 'N'}</div>
        <div>CNF: {(debugInfo.detectionConfidence * 100).toFixed(0)}%</div>
        <div>PTN: {debugInfo.patterns.patternStrength.toFixed(0)}</div>
        <div>VAL: {value.toFixed(2)}</div>
      </div>

      <ControlButtons 
        onStartMeasurement={handleStartMeasurement}
        onReset={handleReset}
      />
    </div>
  );
});

PPGSignalMeter.displayName = 'PPGSignalMeter';

export default PPGSignalMeter;
