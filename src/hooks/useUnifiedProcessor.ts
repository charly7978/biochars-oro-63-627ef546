
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
  
  // Update result when lastResult changes
  useEffect(() => {
    if (lastResult) {
      // Get current feedback state
      const feedbackState = getGlobalFeedbackState();
      
      // Update signal quality in the feedback system
      const updatedFeedback = updateSignalQualityFeedback(
        feedbackState,
        {
          signalStrength: lastResult.quality / 100,
          noiseLevel: 1 - (lastResult.quality / 100),
          stabilityScore: lastResult.stability || 0.5,
          fingerDetectionConfidence: lastResult.fingerDetected ? 0.9 : 0.1
        }
      );
      
      // Update vital signs feedback
      const updatedVitalFeedback = updateVitalSignsFeedback(
        updatedFeedback,
        {
          spo2Quality: lastResult.vitalSigns.spo2 > 0 ? 0.8 : 0,
          pressureReliability: lastResult.vitalSigns.pressure !== "--/--" ? 0.7 : 0,
          arrhythmiaConfidence: lastResult.isArrhythmia ? 0.9 : 0.3
        }
      );
      
      // Update global state
      updateGlobalFeedbackState(updatedVitalFeedback);
      
      // Periodically log feedback state for debugging
      if (Math.random() < 0.05) {
        logFeedbackState(updatedVitalFeedback, "useUnifiedProcessor");
      }
      
      // Calculate feedback quality indicators
      const signalOptimization = (
        updatedVitalFeedback.signalQuality.stabilityScore * 0.4 +
        (1 - updatedVitalFeedback.signalQuality.noiseLevel) * 0.6
      ) * 100;
      
      const measurementReliability = (
        updatedVitalFeedback.heartRate.confidence * 0.4 +
        updatedVitalFeedback.vitalSigns.spo2Quality * 0.3 +
        updatedVitalFeedback.vitalSigns.pressureReliability * 0.3
      ) * 100;
      
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
  
  // Start processing
  const startMonitoring = useCallback(() => {
    // Reset feedback state
    updateGlobalFeedbackState(createInitialFeedbackState());
    
    startProcessing();
    toast.success("Medición iniciada");
  }, [startProcessing]);
  
  // Stop processing
  const stopMonitoring = useCallback(() => {
    stopCentralProcessing();
    toast.info("Medición detenida");
  }, [stopCentralProcessing]);
  
  // Reset everything
  const reset = useCallback(() => {
    resetCentralProcessor();
    
    // Reset feedback state
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
  
  return {
    // Results
    result,
    
    // Methods for signal processing
    processSignal,
    processFrame,
    
    // Control functions
    startMonitoring,
    stopMonitoring,
    reset,
    
    // Status
    isProcessing,
    elapsedTime
  };
}
