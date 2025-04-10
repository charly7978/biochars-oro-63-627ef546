
/**
 * Unified Processor Hook
 * Provides a single integration point for signal processing, vital signs, and heart rate
 * Enhanced with bidirectional feedback
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useCentralSignalProcessor } from './useCentralSignalProcessor';
import { SignalProcessingResult } from './useCentralSignalProcessor';
import { toast } from 'sonner';
import { 
  getGlobalFeedbackState, 
  updateGlobalFeedbackState 
} from './heart-beat/signal-processing/signal-quality';
import { 
  updateSignalQualityFeedback,
  updateVitalSignsFeedback,
  updateHeartRateFeedback,
  logFeedbackState,
  createInitialFeedbackState
} from './heart-beat/signal-processing/bidirectional-feedback';

export interface UnifiedProcessorResult {
  // Signal state
  lastSignal: {
    value: number;
    filteredValue: number;
    quality: number;
    fingerDetected: boolean;
  } | null;
  
  // Heart rate state
  heartRate: number;
  isArrhythmia: boolean;
  
  // Vital signs
  vitalSigns: {
    spo2: number;
    pressure: string;
    arrhythmiaStatus: string;
    arrhythmiaCount: number;
    glucose: number;
    lipids: {
      totalCholesterol: number;
      triglycerides: number;
    };
    hemoglobin: number;
  };
  
  // Status
  elapsedTime: number;
  isProcessing: boolean;
  
  // Arrhythmia data for visualization
  arrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  
  // Feedback quality indicators
  feedbackQuality?: {
    signalOptimization: number;
    measurementReliability: number;
  }
}

export function useUnifiedProcessor() {
  const {
    processSignal,
    processFrame,
    startProcessing,
    stopProcessing: stopCentralProcessing,
    reset: resetCentralProcessor,
    lastResult,
    isProcessing,
    elapsedTime,
    arrhythmiaCount
  } = useCentralSignalProcessor();
  
  const [result, setResult] = useState<UnifiedProcessorResult>({
    lastSignal: null,
    heartRate: 0,
    isArrhythmia: false,
    vitalSigns: {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      arrhythmiaCount: 0,
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      hemoglobin: 0
    },
    elapsedTime: 0,
    isProcessing: false,
    feedbackQuality: {
      signalOptimization: 0,
      measurementReliability: 0
    }
  });
  
  const lastFeedbackUpdateRef = useRef(Date.now());
  
  useEffect(() => {
    if (lastResult) {
      const feedbackState = getGlobalFeedbackState();
      const now = Date.now();
      
      // Log timestamp of processing
      console.log(`Processing signal at: ${new Date(now).toISOString()}`);
      
      // First, update signal quality feedback
      const updatedFeedback = updateSignalQualityFeedback(
        feedbackState,
        {
          signalStrength: lastResult.quality / 100,
          noiseLevel: 1 - (lastResult.quality / 100),
          stabilityScore: lastResult.quality ? lastResult.quality / 100 : 0.5,
          fingerDetectionConfidence: lastResult.fingerDetected ? 0.9 : 0.1
        }
      );
      
      // Then, update heart rate feedback
      // Use a null check for isPeak property since it might not exist in the result
      const isPeakValue = lastResult.hasOwnProperty('isPeak') ? (lastResult as any).isPeak : false;
      
      const updatedHeartRateFeedback = updateHeartRateFeedback(
        updatedFeedback,
        {
          currentBPM: lastResult.heartRate,
          confidence: lastResult.confidence || 0.1,
          peakStrength: 0.7,
          rhythmStability: lastResult.isArrhythmia ? 0.3 : 0.8,
          isPeak: isPeakValue
        }
      );
      
      // Get actual SPO2 quality based on real measurements
      const spo2Quality = lastResult.vitalSigns.spo2 > 0 ? 0.5 + (lastResult.quality / 200) : 0.1;
      
      // Calculate actual glucoseReliability based on real measurements
      const glucoseReliability = lastResult.vitalSigns.glucose > 0 ? 0.4 + (lastResult.quality / 250) : 0.1;
      
      // Calculate actual lipidsReliability based on real measurements
      const lipidReliability = (lastResult.vitalSigns.lipids.totalCholesterol > 0 || 
                          lastResult.vitalSigns.lipids.triglycerides > 0) ? 0.4 + (lastResult.quality / 250) : 0.1;
      
      // Finally, update vital signs feedback with REAL values only
      const updatedVitalFeedback = updateVitalSignsFeedback(
        updatedHeartRateFeedback,
        {
          spo2Quality: spo2Quality,
          pressureReliability: lastResult.vitalSigns.pressure !== "--/--" ? 0.7 : 0.1,
          arrhythmiaConfidence: lastResult.isArrhythmia ? 0.8 : 0.2,
          glucoseReliability: glucoseReliability,
          lipidsReliability: lipidReliability
        }
      );
      
      // Record time since last update
      console.log(`Time since last update: ${((now - lastFeedbackUpdateRef.current) / 1000).toFixed(2)}s`);
      lastFeedbackUpdateRef.current = now;
      
      // Update global feedback state
      updateGlobalFeedbackState(updatedVitalFeedback);
      
      // Log feedback state for debugging
      logFeedbackState(updatedVitalFeedback, "useUnifiedProcessor");
      console.log("Current signal processing result:", lastResult);
      
      // Calculate feedback quality indicators for UI display using REAL values
      const signalOptimization = (
        updatedVitalFeedback.signalQuality.stabilityScore * 0.4 +
        (1 - updatedVitalFeedback.signalQuality.noiseLevel) * 0.6
      ) * 100;
      
      const measurementReliability = (
        updatedVitalFeedback.heartRate.confidence * 0.4 +
        updatedVitalFeedback.vitalSigns.spo2Quality * 0.3 +
        updatedVitalFeedback.vitalSigns.pressureReliability * 0.3
      ) * 100;
      
      // Update the result state with all the data
      setResult({
        lastSignal: {
          value: lastResult.value,
          filteredValue: lastResult.filteredValue,
          quality: lastResult.quality,
          fingerDetected: lastResult.fingerDetected
        },
        heartRate: lastResult.heartRate,
        isArrhythmia: lastResult.isArrhythmia,
        vitalSigns: {
          ...lastResult.vitalSigns,
          arrhythmiaCount
        },
        elapsedTime,
        isProcessing,
        arrhythmiaData: lastResult.arrhythmiaData,
        feedbackQuality: {
          signalOptimization,
          measurementReliability
        }
      });
    }
  }, [lastResult, elapsedTime, isProcessing, arrhythmiaCount]);
  
  const startMonitoring = useCallback(() => {
    updateGlobalFeedbackState(createInitialFeedbackState());
    
    startProcessing();
    toast.success("Medición iniciada");
  }, [startProcessing]);
  
  const stopMonitoring = useCallback(() => {
    stopCentralProcessing();
    toast.info("Medición detenida");
  }, [stopCentralProcessing]);
  
  const reset = useCallback(() => {
    resetCentralProcessor();
    
    updateGlobalFeedbackState(createInitialFeedbackState());
    
    setResult({
      lastSignal: null,
      heartRate: 0,
      isArrhythmia: false,
      vitalSigns: {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        arrhythmiaCount: 0,
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hemoglobin: 0
      },
      elapsedTime: 0,
      isProcessing: false,
      feedbackQuality: {
        signalOptimization: 0,
        measurementReliability: 0
      }
    });
    
    toast.success("Medición reiniciada");
  }, [resetCentralProcessor]);
  
  // Versión compatible de processFrame para evitar el error de TypeScript
  const processFrameCompat = useCallback((imageData: any) => {
    // Creamos un objeto ImageData compatible
    const compatImageData = new ImageData(
      imageData.data, 
      imageData.width, 
      imageData.height
    );
    
    // Procesamos con el ImageData compatible
    return processFrame(compatImageData);
  }, [processFrame]);
  
  return {
    result,
    processSignal,
    processFrame: processFrameCompat,
    startMonitoring,
    stopMonitoring,
    reset,
    isProcessing,
    elapsedTime
  };
}
