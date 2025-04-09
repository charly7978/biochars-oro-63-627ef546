/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef, useCallback } from 'react';
import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';
import { VitalSignsProcessor } from '../../modules/vital-signs/VitalSignsProcessor';

/**
 * Hook for processing signal using the VitalSignsProcessor
 * Direct measurement only, no simulation
 */
export const useSignalProcessing = () => {
  // Reference for processor instance
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  // Signal quality enhancement parameters
  const signalSmoothingFactor = useRef<number>(0.4); // Increased smoothing for PPG waveform
  const lastSmoothedValue = useRef<number>(0);
  
  // Signal quality tracking
  const signalQualityTracker = useRef<number[]>([]);
  const MIN_SIGNAL_QUALITY_THRESHOLD = 20;
  const signalStartTime = useRef<number>(Date.now());
  const lastValidSignalTime = useRef<number>(Date.now());
  
  /**
   * Process PPG signal directly
   * No simulation or reference values
   */
  const processSignal = useCallback((
    value: number, 
    rrData?: { intervals: number[], lastPeakTime: number | null },
    isWeakSignal: boolean = false
  ): VitalSignsResult => {
    if (!processorRef.current) {
      console.log("useVitalSignsProcessor: Processor not initialized");
      return createEmptyResult();
    }
    
    // Validate input - NaN protection
    if (isNaN(value)) {
      console.warn("useVitalSignsProcessor: Received NaN value");
      return createEmptyResult();
    }
    
    processedSignals.current++;
    const now = Date.now();
    
    // Apply gentle smoothing for better waveform continuity
    const smoothingFactor = isWeakSignal ? 0.2 : signalSmoothingFactor.current;
    const smoothedValue = lastSmoothedValue.current * (1 - smoothingFactor) + 
                          value * smoothingFactor;
    lastSmoothedValue.current = smoothedValue;
    
    // Track signal quality over time
    trackSignalQuality(smoothedValue);
    const currentSignalQuality = calculateCurrentSignalQuality();
    
    // Debug log for signal quality
    if (processedSignals.current % 30 === 0) {
      console.log("Signal quality tracking:", { 
        currentQuality: currentSignalQuality,
        threshold: MIN_SIGNAL_QUALITY_THRESHOLD,
        signalAge: now - signalStartTime.current,
        timeSinceLastValidSignal: now - lastValidSignalTime.current
      });
    }
    
    // If signal is invalid or too weak, return empty results
    if (isWeakSignal || currentSignalQuality < MIN_SIGNAL_QUALITY_THRESHOLD) {
      const timeSinceStart = now - signalStartTime.current;
      const timeSinceLastValid = now - lastValidSignalTime.current;
      
      // Give more time at the beginning before rejecting signals
      const initialGracePeriod = 3000; // 3 seconds
      const ongoingGracePeriod = 5000; // 5 seconds
      
      // During startup, be more lenient
      if (timeSinceStart < initialGracePeriod) {
        // Allow processing even with weak signals during startup
        console.log("Initial grace period, processing signal despite low quality");
      } else if (timeSinceLastValid > ongoingGracePeriod) {
        // If we haven't had a good signal for too long, return empty result
        if (processedSignals.current % 30 === 0) {
          console.log("Signal too weak or invalid for too long", {
            timeSinceLastValid,
            qualityThreshold: MIN_SIGNAL_QUALITY_THRESHOLD,
            currentQuality: currentSignalQuality
          });
        }
        return createEmptyResult();
      }
    } else {
      // Update timestamp for last valid signal
      lastValidSignalTime.current = now;
    }
    
    // Logging for diagnostics
    if (processedSignals.current % 45 === 0) {
      console.log("useVitalSignsProcessor: Processing signal DIRECTLY", {
        inputValue: value,
        smoothedValue: smoothedValue,
        rrDataPresent: !!rrData,
        rrIntervals: rrData?.intervals.length || 0,
        arrhythmiaCount: processorRef.current.getArrhythmiaCounter(),
        signalNumber: processedSignals.current,
        signalQuality: currentSignalQuality
      });
    }
    
    // Process signal directly - no simulation
    let result = processorRef.current.processSignal(smoothedValue, rrData);
    
    // Store signal history for diagnostics
    if (processedSignals.current % 5 === 0) {
      signalLog.current.push({
        timestamp: Date.now(),
        value: smoothedValue,
        result: {
          arrhythmiaStatus: result.arrhythmiaStatus,
          spo2: result.spo2
        }
      });
      
      // Keep log size reasonable
      if (signalLog.current.length > 100) {
        signalLog.current.shift();
      }
    }
    
    return result;
  }, []);

  /**
   * Track signal quality over time
   */
  const trackSignalQuality = useCallback((value: number): void => {
    // Add to quality tracking buffer
    signalQualityTracker.current.push(value);
    
    // Keep buffer at reasonable size
    if (signalQualityTracker.current.length > 30) {
      signalQualityTracker.current.shift();
    }
  }, []);

  /**
   * Calculate current signal quality based on signal characteristics
   */
  const calculateCurrentSignalQuality = useCallback((): number => {
    if (signalQualityTracker.current.length < 10) {
      return 0;
    }
    
    // Calculate signal amplitude
    const min = Math.min(...signalQualityTracker.current);
    const max = Math.max(...signalQualityTracker.current);
    const amplitude = max - min;
    
    // Calculate standard deviation
    const mean = signalQualityTracker.current.reduce((sum, val) => sum + val, 0) / 
                 signalQualityTracker.current.length;
    
    let variance = 0;
    for (const val of signalQualityTracker.current) {
      variance += Math.pow(val - mean, 2);
    }
    variance /= signalQualityTracker.current.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Calculate signal-to-noise ratio (SNR)
    const snr = stdDev > 0 ? amplitude / stdDev : 0;
    
    // Calculate periodicity score
    let periodicityScore = 0;
    if (signalQualityTracker.current.length >= 20) {
      // Simple autocorrelation check for heartbeat periodicity
      let correlation = 0;
      for (let i = 0; i < 10; i++) {
        correlation += (signalQualityTracker.current[i] - mean) * 
                       (signalQualityTracker.current[i + 10] - mean);
      }
      periodicityScore = correlation > 0 ? Math.min(50, correlation * 5) : 0;
    }
    
    // Combine metrics into overall quality score
    const amplitudeScore = Math.min(50, amplitude * 200);
    const snrScore = Math.min(30, snr * 10);
    const qualityScore = amplitudeScore + snrScore + periodicityScore;
    
    return Math.min(100, Math.max(0, qualityScore));
  }, []);

  /**
   * Create an empty result object
   */
  const createEmptyResult = useCallback((): VitalSignsResult => {
    return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      }
    };
  }, []);

  /**
   * Initialize the processor
   * Direct measurement only
   */
  const initializeProcessor = useCallback(() => {
    console.log("useVitalSignsProcessor: Initializing processor for DIRECT MEASUREMENT ONLY", {
      timestamp: new Date().toISOString()
    });
    
    // Create new instances for direct measurement
    processorRef.current = new VitalSignsProcessor();
    
    // Reset enhancement parameters
    signalSmoothingFactor.current = 0.4;
    lastSmoothedValue.current = 0;
    signalQualityTracker.current = [];
    signalStartTime.current = Date.now();
    lastValidSignalTime.current = Date.now();
  }, []);

  /**
   * Reset the processor
   * No simulations or reference values
   */
  const reset = useCallback(() => {
    if (!processorRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reset initiated - DIRECT MEASUREMENT mode only");
    
    processorRef.current.reset();
    lastSmoothedValue.current = 0;
    signalQualityTracker.current = [];
    lastValidSignalTime.current = Date.now();
    
    console.log("useVitalSignsProcessor: Reset completed - all values at zero for direct measurement");
    return null;
  }, []);
  
  /**
   * Perform full reset - clear all data
   * No simulations or reference values
   */
  const fullReset = useCallback(() => {
    if (!processorRef.current) return;
    
    console.log("useVitalSignsProcessor: Full reset initiated - DIRECT MEASUREMENT mode only");
    
    processorRef.current.fullReset();
    processedSignals.current = 0;
    signalLog.current = [];
    lastSmoothedValue.current = 0;
    signalQualityTracker.current = [];
    signalStartTime.current = Date.now();
    lastValidSignalTime.current = Date.now();
    
    console.log("useVitalSignsProcessor: Full reset complete - direct measurement mode active");
  }, []);

  /**
   * Get the arrhythmia counter
   */
  const getArrhythmiaCounter = useCallback(() => {
    return processorRef.current?.getArrhythmiaCounter() || 0;
  }, []);

  /**
   * Get debug information about signal processing
   */
  const getDebugInfo = useCallback(() => {
    return {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10),
      smoothingFactor: signalSmoothingFactor.current,
      signalQuality: calculateCurrentSignalQuality(),
      timeSinceStart: Date.now() - signalStartTime.current,
      timeSinceLastValidSignal: Date.now() - lastValidSignalTime.current
    };
  }, [calculateCurrentSignalQuality]);

  return {
    processSignal,
    initializeProcessor,
    reset,
    fullReset,
    getArrhythmiaCounter,
    getDebugInfo,
    processorRef,
    processedSignals,
    signalLog,
    calculateSignalQuality: calculateCurrentSignalQuality
  };
};
