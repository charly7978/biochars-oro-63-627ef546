
/**
 * Central Signal Processing Hook
 * Unifies signal processing, heart beat detection, and vital signs monitoring
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useSignalCore } from './useSignalCore';
import { createSignalProcessor } from '../core/signal-processing';
import { VitalSignsProcessor } from '../modules/VitalSignsProcessor';
import { HeartBeatResult } from './heart-beat/types';
import { useTensorFlowModel } from './useTensorFlowModel';
import { TensorFlowModelRegistry } from '../core/neural/tensorflow/TensorFlowModelRegistry';

export interface SignalProcessingResult {
  // PPG Signal metrics
  value: number;
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  
  // Heart rate metrics
  heartRate: number;
  confidence: number;
  isArrhythmia: boolean;
  
  // Vital signs
  vitalSigns: {
    spo2: number;
    pressure: string;
    arrhythmiaStatus: string;
    glucose: number;
    lipids: {
      totalCholesterol: number;
      triglycerides: number;
    };
    hemoglobin: number;
  };
  
  // Arrhythmia data
  arrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  
  // RR intervals
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export function useCentralSignalProcessor() {
  // Core signal processing
  const { 
    signalState,
    startProcessing: startSignalProcessing,
    stopProcessing: stopSignalProcessing,
    processValue: processSignalValue,
    processFrame: processSignalFrame,
    reset: resetSignalCore
  } = useSignalCore();
  
  // TensorFlow model for heart rate
  const { isReady: tfModelReady, predict: predictHeartRate } = 
    useTensorFlowModel('heartRate', false);
  
  // Vital signs processor
  const vitalSignsProcessorRef = useRef<VitalSignsProcessor | null>(null);
  
  // Signal processing state
  const [lastResult, setLastResult] = useState<SignalProcessingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<any>(null);
  
  // Processing statistics
  const processedFramesRef = useRef(0);
  const lastHeartRateRef = useRef(0);
  const lastArrhythmiaCountRef = useRef(0);
  
  // Initialize processors
  useEffect(() => {
    if (!vitalSignsProcessorRef.current) {
      vitalSignsProcessorRef.current = new VitalSignsProcessor();
      console.log("Central Signal Processor: Initialized vital signs processor");
    }
    
    // Initialize TensorFlow
    const initTensorFlow = async () => {
      try {
        const registry = TensorFlowModelRegistry.getInstance();
        await registry.initialize();
      } catch (error) {
        console.error("Error initializing TensorFlow:", error);
      }
    };
    
    initTensorFlow();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Process PPG signal through all processors
  const processSignal = useCallback((value: number): SignalProcessingResult | null => {
    if (!isProcessing || !vitalSignsProcessorRef.current) return null;
    
    processedFramesRef.current++;
    
    // Process through core signal system
    const signalResult = processSignalValue(value);
    if (!signalResult) return null;
    
    // Extract quality and other metadata
    const signalQuality = signalResult.quality || 0;
    const heartbeatChannel = signalResult.channels.get('heartbeat');
    const lastValue = heartbeatChannel?.getLastValue() || 0;
    
    // Detect finger presence
    const fingerDetected = signalQuality > 30;
    
    // Skip processing if finger not detected
    if (!fingerDetected) {
      return {
        value,
        filteredValue: lastValue,
        quality: signalQuality,
        fingerDetected: false,
        heartRate: 0,
        confidence: 0,
        isArrhythmia: false,
        vitalSigns: {
          spo2: 0,
          pressure: "--/--",
          arrhythmiaStatus: "--",
          glucose: 0,
          lipids: {
            totalCholesterol: 0,
            triglycerides: 0
          },
          hemoglobin: 0
        }
      };
    }
    
    // Calculate heart rate - using RR data if available
    const rrIntervals = heartbeatChannel?.getMetadata('rrIntervals') as number[] || [];
    const lastPeakTime = heartbeatChannel?.getMetadata('lastPeakTime') as number | null;
    
    const rrData = {
      intervals: rrIntervals,
      lastPeakTime
    };
    
    // Determine heart rate
    let heartRate = heartbeatChannel?.getMetadata('heartRate') as number || 0;
    if (heartRate === 0 && lastHeartRateRef.current > 0) {
      heartRate = lastHeartRateRef.current;
    } else if (heartRate > 0) {
      lastHeartRateRef.current = heartRate;
    }
    
    // Calculate confidence
    const confidence = signalQuality / 100;
    
    // Process vital signs and await the result
    const processingPromise = async () => {
      try {
        const vitalSignsResult = await vitalSignsProcessorRef.current!.processSignal(lastValue, rrData);
        
        // Detect arrhythmia
        const isArrhythmia = vitalSignsResult.arrhythmiaStatus.includes("ARRITMIA");
        
        // Update arrhythmia count (for logging)
        const arrhythmiaCount = vitalSignsProcessorRef.current!.getArrhythmiaCounter();
        if (arrhythmiaCount > lastArrhythmiaCountRef.current) {
          console.log(`Central Signal Processor: Arrhythmia detected (${arrhythmiaCount} total)`);
          lastArrhythmiaCountRef.current = arrhythmiaCount;
        }
        
        // Create combined result
        const result: SignalProcessingResult = {
          value,
          filteredValue: lastValue,
          quality: signalQuality,
          fingerDetected,
          heartRate,
          confidence,
          isArrhythmia,
          vitalSigns: {
            spo2: vitalSignsResult.spo2,
            pressure: vitalSignsResult.pressure,
            arrhythmiaStatus: vitalSignsResult.arrhythmiaStatus,
            glucose: vitalSignsResult.glucose,
            lipids: vitalSignsResult.lipids,
            hemoglobin: vitalSignsResult.hemoglobin || 0
          },
          arrhythmiaData: vitalSignsResult.lastArrhythmiaData,
          rrData
        };
        
        // Update last result
        setLastResult(result);
        
        return result;
      } catch (error) {
        console.error("Error processing vital signs:", error);
        return null;
      }
    };
    
    // Start the async processing
    processingPromise();
    
    // Return the last known result while processing is happening
    return lastResult || {
      value,
      filteredValue: lastValue,
      quality: signalQuality,
      fingerDetected,
      heartRate,
      confidence,
      isArrhythmia: false,
      vitalSigns: {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hemoglobin: 0
      },
      rrData
    };
  }, [isProcessing, processSignalValue, lastResult]);
  
  // Process camera frame through the pipeline
  const processFrame = useCallback((imageData: ImageData): SignalProcessingResult | null => {
    if (!isProcessing) return null;
    
    const frameResult = processSignalFrame(imageData);
    if (!frameResult) return null;
    
    return processSignal(frameResult.lastValue || 0);
  }, [isProcessing, processSignal, processSignalFrame]);
  
  // Start signal processing
  const startProcessing = useCallback(() => {
    if (isProcessing) return;
    
    console.log("Central Signal Processor: Starting processing");
    
    // Reset all processors
    resetSignalCore();
    if (vitalSignsProcessorRef.current) {
      vitalSignsProcessorRef.current.reset();
    }
    
    // Start core signal processing
    startSignalProcessing();
    setIsProcessing(true);
    processedFramesRef.current = 0;
    lastHeartRateRef.current = 0;
    lastArrhythmiaCountRef.current = 0;
    
    // Start elapsed time tracking
    setElapsedTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
  }, [isProcessing, resetSignalCore, startSignalProcessing]);
  
  // Stop signal processing
  const stopProcessing = useCallback(() => {
    if (!isProcessing) return;
    
    console.log("Central Signal Processor: Stopping processing");
    
    // Stop core signal processing
    stopSignalProcessing();
    setIsProcessing(false);
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Log processing statistics
    console.log("Central Signal Processor: Processing statistics", {
      processedFrames: processedFramesRef.current,
      totalElapsedTime: elapsedTime,
      finalHeartRate: lastHeartRateRef.current,
      totalArrhythmias: lastArrhythmiaCountRef.current
    });
    
  }, [isProcessing, stopSignalProcessing, elapsedTime]);
  
  // Reset all processors
  const reset = useCallback(() => {
    // Stop processing
    stopProcessing();
    
    // Reset signal core
    resetSignalCore();
    
    // Reset vital signs processor
    if (vitalSignsProcessorRef.current) {
      vitalSignsProcessorRef.current.fullReset();
    }
    
    // Reset state
    setLastResult(null);
    setElapsedTime(0);
    processedFramesRef.current = 0;
    lastHeartRateRef.current = 0;
    lastArrhythmiaCountRef.current = 0;
    
    console.log("Central Signal Processor: Full reset complete");
  }, [resetSignalCore, stopProcessing]);
  
  return {
    processSignal,
    processFrame,
    startProcessing,
    stopProcessing,
    reset,
    lastResult,
    isProcessing,
    elapsedTime,
    arrhythmiaCount: lastArrhythmiaCountRef.current
  };
}
