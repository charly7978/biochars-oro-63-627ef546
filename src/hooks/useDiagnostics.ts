
/**
 * Hook for gathering system diagnostics data
 */
import { useState, useEffect, useCallback } from 'react';
import { useSignalProcessing } from './useSignalProcessing';
import { useVitalSignsProcessor } from './useVitalSignsProcessor';
import { useVitalSignsWithProcessing } from './useVitalSignsWithProcessing';
import { usePPGExtraction } from './usePPGExtraction';

export function useDiagnostics() {
  // Get access to all the system hooks
  const signalProcessing = useSignalProcessing();
  const vitalSigns = useVitalSignsProcessor();
  const integratedProcessing = useVitalSignsWithProcessing();
  const signalExtraction = usePPGExtraction();
  
  // State for diagnostics data
  const [diagnosticsData, setDiagnosticsData] = useState({
    signalQuality: {
      current: 0,
      history: [] as number[],
      status: 'unknown' as 'good' | 'moderate' | 'poor' | 'unknown'
    },
    calibration: {
      active: false,
      status: 'not_calibrated' as 'calibrating' | 'calibrated' | 'not_calibrated',
      progress: 0,
      lastCalibrated: null as Date | null
    },
    channels: {
      cardiac: { quality: 0, active: false },
      spo2: { quality: 0, active: false },
      glucose: { quality: 0, active: false },
      lipids: { quality: 0, active: false },
      bloodPressure: { quality: 0, active: false }
    },
    signalMetrics: {
      rawAmplitude: 0,
      filteredAmplitude: 0,
      noiseLevel: 0,
      stabilityScore: 0
    },
    processingPipeline: {
      framesProcessed: 0,
      framesPerSecond: 0,
      lastProcessTime: 0,
      activeProcessors: [] as string[]
    },
    heartbeatMetrics: {
      currentBPM: 0,
      confidence: 0,
      arrhythmiaDetected: false,
      signalStrength: 'unknown' as 'strong' | 'moderate' | 'weak' | 'unknown',
      rrIntervalQuality: 0
    },
    systemStatus: {
      isMonitoring: false,
      fingerDetected: false,
      errors: [] as string[],
      warnings: [] as string[]
    },
    networkStatus: {
      active: false,
      trainingProgress: 0,
      lastTrainingDate: null as Date | null,
      accuracy: 0
    },
    feedbackSystem: {
      bidirectionalActive: false,
      lastFeedbackTime: null as Date | null,
      feedbackQueue: 0,
      adaptations: [] as {component: string, timestamp: Date, adaptation: string}[]
    },
    signalHistory: {
      raw: [] as {time: number, value: number}[],
      filtered: [] as {time: number, value: number}[],
      amplified: [] as {time: number, value: number}[]
    }
  });
  
  // Update diagnostics data periodically
  useEffect(() => {
    const updateInterval = setInterval(() => {
      updateDiagnosticsData();
    }, 1000);
    
    return () => clearInterval(updateInterval);
  }, []);
  
  // Function to update diagnostics data
  const updateDiagnosticsData = useCallback(() => {
    // Get the latest data from all sources
    const signalQualityValue = Math.max(
      signalProcessing.signalQuality || 0,
      signalExtraction.signalQuality || 0
    );
    
    const heartRate = signalProcessing.heartRate || 0;
    const fingerDetected = signalProcessing.fingerDetected || false;
    
    // Get signal processing details
    const lastResult = signalProcessing.lastResult;
    
    // Get diagnostics from vital signs processor
    const vitalSignsDiagnostics = vitalSigns.getPeakDetectionDiagnostics?.() || [];
    const arrhythmiaCount = vitalSigns.arrhythmiaCounter || 0;
    
    // Get debug info
    const vitalSignsDebug = vitalSigns.debugInfo;
    
    // Determine signal quality status
    let qualityStatus: 'good' | 'moderate' | 'poor' | 'unknown' = 'unknown';
    if (signalQualityValue >= 70) qualityStatus = 'good';
    else if (signalQualityValue >= 40) qualityStatus = 'moderate';
    else if (signalQualityValue > 0) qualityStatus = 'poor';
    
    // Determine heart signal strength
    let heartSignalStrength: 'strong' | 'moderate' | 'weak' | 'unknown' = 'unknown';
    const signalStrength = lastResult?.signalStrength || 0;
    if (signalStrength >= 0.7) heartSignalStrength = 'strong';
    else if (signalStrength >= 0.4) heartSignalStrength = 'moderate';
    else if (signalStrength > 0) heartSignalStrength = 'weak';

    // Determine active processors
    const activeProcessors: string[] = [];
    if (signalProcessing.isProcessing) activeProcessors.push('PPG Signal Processor');
    if (integratedProcessing.isMonitoring) activeProcessors.push('Integrated Vital Signs');
    if (signalExtraction.isProcessing) activeProcessors.push('Signal Extraction');
    
    // Get signal metrics
    const rawValue = lastResult?.rawValue || 0;
    const filteredValue = lastResult?.filteredValue || 0;
    
    // Calculate noise and stability
    const noiseLevel = Math.abs(rawValue - filteredValue);
    const stabilityScore = lastResult ? Math.min(100, 100 - (noiseLevel * 200)) : 0;
    
    // Update all diagnostic data
    setDiagnosticsData(prevData => {
      // Update signal history
      const now = Date.now();
      const newRaw = [...prevData.signalHistory.raw, {time: now, value: rawValue}].slice(-50);
      const newFiltered = [...prevData.signalHistory.filtered, {time: now, value: filteredValue}].slice(-50);
      const newAmplified = [...prevData.signalHistory.amplified, {time: now, value: lastResult?.amplifiedValue || 0}].slice(-50);
      
      // Calculate amplitudes
      const rawAmplitude = calculateAmplitude(newRaw.map(d => d.value));
      const filteredAmplitude = calculateAmplitude(newFiltered.map(d => d.value));
      
      // Calculate frames per second
      const fps = calculateFPS(
        signalProcessing.processedFrames || 0, 
        prevData.processingPipeline.framesProcessed || 0
      );
      
      return {
        ...prevData,
        signalQuality: {
          current: signalQualityValue,
          history: [...prevData.signalQuality.history, signalQualityValue].slice(-50),
          status: qualityStatus
        },
        calibration: {
          ...prevData.calibration,
          active: isCalibrationActive(vitalSignsDebug),
          status: determineCalibrationStatus(vitalSignsDebug)
        },
        channels: {
          cardiac: { 
            quality: estimateChannelQuality('cardiac', lastResult), 
            active: activeProcessors.length > 0 
          },
          spo2: { 
            quality: estimateChannelQuality('spo2', lastResult), 
            active: activeProcessors.length > 0 
          },
          glucose: { 
            quality: estimateChannelQuality('glucose', lastResult), 
            active: activeProcessors.length > 0 
          },
          lipids: { 
            quality: estimateChannelQuality('lipids', lastResult), 
            active: activeProcessors.length > 0 
          },
          bloodPressure: { 
            quality: estimateChannelQuality('bloodPressure', lastResult), 
            active: activeProcessors.length > 0 
          },
        },
        signalMetrics: {
          rawAmplitude,
          filteredAmplitude,
          noiseLevel,
          stabilityScore
        },
        processingPipeline: {
          framesProcessed: signalProcessing.processedFrames || 0,
          framesPerSecond: fps,
          lastProcessTime: now,
          activeProcessors
        },
        heartbeatMetrics: {
          currentBPM: heartRate,
          confidence: lastResult?.peakConfidence || 0,
          arrhythmiaDetected: arrhythmiaCount > 0,
          signalStrength: heartSignalStrength,
          rrIntervalQuality: calculateRRQuality(lastResult)
        },
        systemStatus: {
          isMonitoring: integratedProcessing.isMonitoring || signalProcessing.isProcessing,
          fingerDetected,
          errors: [], // Would be populated from error states
          warnings: [] // Would be populated from warning states
        },
        networkStatus: {
          ...prevData.networkStatus,
          active: isNeuralNetworkActive(vitalSignsDebug),
        },
        feedbackSystem: {
          ...prevData.feedbackSystem,
          bidirectionalActive: isBidirectionalFeedbackActive(vitalSignsDebug),
          lastFeedbackTime: vitalSignsDebug?.performanceMetrics?.avgProcessTime ? new Date() : prevData.feedbackSystem.lastFeedbackTime,
        },
        signalHistory: {
          raw: newRaw,
          filtered: newFiltered,
          amplified: newAmplified
        }
      };
    });
  }, [signalProcessing, vitalSigns, integratedProcessing, signalExtraction]);
  
  // Helper functions
  const calculateAmplitude = (values: number[]): number => {
    if (values.length < 2) return 0;
    return Math.max(...values) - Math.min(...values);
  };
  
  const calculateFPS = (currentFrames: number, previousFrames: number): number => {
    const frameDiff = currentFrames - previousFrames;
    return frameDiff; // Since we update every second
  };
  
  const estimateChannelQuality = (channel: string, result: any): number => {
    if (!result) return 0;
    
    // Estimate quality based on available metrics
    // This is a placeholder - in a real implementation, each channel would have its own quality metrics
    switch (channel) {
      case 'cardiac':
        return result.peakConfidence ? result.peakConfidence * 100 : 0;
      case 'spo2':
        return result.quality ? result.quality * 0.9 : 0; // Slightly less than overall quality
      case 'glucose':
        return result.quality ? result.quality * 0.7 : 0; // More affected by noise
      case 'lipids':
        return result.quality ? result.quality * 0.6 : 0; // More affected by noise
      case 'bloodPressure':
        return result.quality ? result.quality * 0.8 : 0; // Less affected by noise
      default:
        return 0;
    }
  };
  
  const calculateRRQuality = (result: any): number => {
    if (!result || !result.rrInterval) return 0;
    // Higher confidence in RR intervals with higher peak confidence
    return result.peakConfidence ? result.peakConfidence * 100 : 0;
  };
  
  const isCalibrationActive = (debugInfo: any): boolean => {
    // In a real implementation, this would check if calibration is currently active
    return debugInfo?.processedSignals > 0;
  };
  
  const determineCalibrationStatus = (debugInfo: any): 'calibrating' | 'calibrated' | 'not_calibrated' => {
    if (!debugInfo) return 'not_calibrated';
    
    if (debugInfo.processedSignals < 10) return 'not_calibrated';
    if (debugInfo.processedSignals < 50) return 'calibrating';
    return 'calibrated';
  };
  
  const isNeuralNetworkActive = (debugInfo: any): boolean => {
    // In a real implementation, this would check if neural network processing is active
    return debugInfo?.performanceMetrics?.avgProcessTime > 0;
  };
  
  const isBidirectionalFeedbackActive = (debugInfo: any): boolean => {
    // In a real implementation, this would check if bidirectional feedback is active
    return debugInfo?.signalLog?.length > 0;
  };
  
  return {
    diagnosticsData,
    updateDiagnosticsData
  };
}
