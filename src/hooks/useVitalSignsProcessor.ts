
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useRef, useEffect } from 'react';
import { VitalSignsResult } from '../modules/vital-signs/types/vital-signs-result';
import { useArrhythmiaVisualization } from './vital-signs/use-arrhythmia-visualization';
import { useSignalProcessing } from './vital-signs/use-signal-processing';
import { useVitalSignsLogging } from './vital-signs/use-vital-signs-logging';
import { UseVitalSignsProcessorReturn } from './vital-signs/types';

/**
 * Hook for processing vital signs with DIRECT ALGORITHMS ONLY
 * NO SIMULATION OR REFERENCE VALUES WHATSOEVER
 * Drastically improved false positive prevention
 */
export const useVitalSignsProcessor = (): UseVitalSignsProcessorReturn => {
  // State management - only direct measurement, NO SIMULATION WHATSOEVER
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Session tracking
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Signal quality tracking - drastically improved thresholds
  const weakSignalsCountRef = useRef<number>(0);
  const LOW_SIGNAL_THRESHOLD = 0.45; // Drastically increased from 0.40
  const MAX_WEAK_SIGNALS = 3; // Reduced for faster finger removal detection
  
  // Track minimum required signals for physiological validation
  const validSignalsCountRef = useRef<number>(0);
  const REQUIRED_VALID_SIGNALS = 35; // Increased from 30
  const signalBufferRef = useRef<number[]>([]);
  
  const { 
    arrhythmiaWindows, 
    addArrhythmiaWindow, 
    clearArrhythmiaWindows 
  } = useArrhythmiaVisualization();
  
  const { 
    processSignal: processVitalSignal, 
    initializeProcessor,
    reset: resetProcessor, 
    fullReset: fullResetProcessor,
    getArrhythmiaCounter,
    getDebugInfo,
    processedSignals
  } = useSignalProcessing();
  
  const { 
    logSignalData, 
    clearLog 
  } = useVitalSignsLogging();
  
  // Initialize processor components - direct measurement only, NO SIMULATION
  useEffect(() => {
    console.log("useVitalSignsProcessor: Initializing processor for DIRECT MEASUREMENT ONLY", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Create new instances for direct measurement ONLY
    initializeProcessor();
    
    return () => {
      console.log("useVitalSignsProcessor: Processor cleanup", {
        sessionId: sessionId.current,
        totalArrhythmias: getArrhythmiaCounter(),
        processedSignals: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, [initializeProcessor, getArrhythmiaCounter, processedSignals]);
  
  /**
   * Process PPG signal directly - NO SIMULATION WHATSOEVER
   * Drastically improved false positive prevention
   */
  const processSignal = (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }): VitalSignsResult => {
    const now = Date.now();
    
    // Add to signal buffer for physiological validation
    signalBufferRef.current.push(value);
    if (signalBufferRef.current.length > 20) {
      signalBufferRef.current.shift();
    }
    
    // Perform physiological validation - absolutely critical for false positive prevention
    const isPhysiologicalSignal = validatePhysiologicalSignal(signalBufferRef.current);
    
    if (isPhysiologicalSignal) {
      validSignalsCountRef.current = Math.min(REQUIRED_VALID_SIGNALS * 2, validSignalsCountRef.current + 1);
    } else {
      // Faster decrease to eliminate false positives
      validSignalsCountRef.current = Math.max(0, validSignalsCountRef.current - 3);
    }
    
    // Only consider signal valid after seeing many consecutive physiological signals
    const hasValidatedPhysiology = validSignalsCountRef.current >= REQUIRED_VALID_SIGNALS;
    
    // Check for weak signal to detect finger removal - much stricter threshold
    if (Math.abs(value) < LOW_SIGNAL_THRESHOLD) {
      weakSignalsCountRef.current++;
    } else {
      // Faster recovery once we have a strong signal
      weakSignalsCountRef.current = Math.max(0, weakSignalsCountRef.current - 2);
    }
    
    const isWeakSignal = weakSignalsCountRef.current >= MAX_WEAK_SIGNALS;
    
    // Reset physiological validation on weak signal
    if (isWeakSignal) {
      validSignalsCountRef.current = Math.max(0, validSignalsCountRef.current - 5);
    }
    
    // Process signal directly - NO SIMULATION WHATSOEVER
    // Only process if we have physiological validation
    let result: VitalSignsResult = isWeakSignal || !hasValidatedPhysiology ? 
      { 
        // Empty result - nothing is simulated
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: { totalCholesterol: 0, triglycerides: 0 },
        confidence: {
          glucose: 0,
          lipids: 0,
          overall: 0
        }
      } : 
      processVitalSignal(value, rrData, isWeakSignal);
    
    // If arrhythmia is detected in real data, register visualization window
    if (result.arrhythmiaStatus && result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") && result.lastArrhythmiaData) {
      const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
      
      // Window based on real heart rate
      let windowWidth = 400;
      
      // Adjust based on real RR intervals
      if (rrData && rrData.intervals.length > 0) {
        const lastIntervals = rrData.intervals.slice(-4);
        const avgInterval = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
        windowWidth = Math.max(300, Math.min(1000, avgInterval * 1.1));
      }
      
      addArrhythmiaWindow(arrhythmiaTime - windowWidth/2, arrhythmiaTime + windowWidth/2);
    }
    
    // Log processed signals
    logSignalData(value, result, processedSignals.current);
    
    // Add physiological validation info
    const finalResult: VitalSignsResult = {
      ...result,
      physiologicalValidation: {
        isValid: hasValidatedPhysiology,
        validCount: validSignalsCountRef.current,
        required: REQUIRED_VALID_SIGNALS
      }
    };
    
    // Log validation status occasionally
    if (processedSignals.current % 50 === 0) {
      console.log("Signal validation status:", {
        isWeakSignal,
        hasValidatedPhysiology,
        validSignalsCount: validSignalsCountRef.current,
        weakSignalsCount: weakSignalsCountRef.current,
        signalValue: value,
        threshold: LOW_SIGNAL_THRESHOLD
      });
    }
    
    // Always return real result
    return finalResult;
  };
  
  /**
   * Validate if a signal pattern is physiologically plausible
   * Critical for false positive prevention - UMBRALES DRÁSTICAMENTE MEJORADOS
   */
  const validatePhysiologicalSignal = (signalBuffer: number[]): boolean => {
    if (signalBuffer.length < 15) return false; // Increased from 10
    
    // Get recent values to analyze
    const values = signalBuffer.slice(-15); // Increased from 10
    
    // Check amplitude (real fingers have significant amplitude)
    const min = Math.min(...values);
    const max = Math.max(...values);
    const amplitude = max - min;
    
    if (amplitude < 0.35) return false; // Drastically increased from 0.20
    
    // Calculate first derivative to check for heartbeat-like patterns
    const derivatives: number[] = [];
    for (let i = 1; i < values.length; i++) {
      derivatives.push(values[i] - values[i-1]);
    }
    
    // Check if derivatives show sign changes (indicating oscillation)
    let signChanges = 0;
    for (let i = 1; i < derivatives.length; i++) {
      if ((derivatives[i] > 0 && derivatives[i-1] < 0) ||
          (derivatives[i] < 0 && derivatives[i-1] > 0)) {
        signChanges++;
      }
    }
    
    // Require more sign changes (oscilaciones) for physiological signals
    if (signChanges < 4) return false; // Increased from 3 to 4
    
    // Calculate statistical properties to check for physiological patterns
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const normalizedVariance = variance / (mean * mean);
    
    // Comprobar la tasa de cambio máxima - los latidos reales tienen cambios graduales
    let maxRateOfChange = 0;
    for (let i = 0; i < derivatives.length; i++) {
      maxRateOfChange = Math.max(maxRateOfChange, Math.abs(derivatives[i]));
    }
    
    // Limitar la tasa máxima de cambio - los falsos positivos suelen tener saltos bruscos
    if (maxRateOfChange > 0.4) return false; // Los dedos reales tienen cambios más graduales
    
    // Physiological signals have characteristic variance range - narrower range for higher precision
    return normalizedVariance > 0.12 && normalizedVariance < 0.35;
  };

  /**
   * Perform complete reset - start from zero
   * No simulations or reference values
   */
  const reset = () => {
    resetProcessor();
    clearArrhythmiaWindows();
    setLastValidResults(null);
    weakSignalsCountRef.current = 0;
    validSignalsCountRef.current = 0;
    signalBufferRef.current = [];
    
    return null;
  };
  
  /**
   * Perform full reset - clear all data
   * No simulations or reference values
   */
  const fullReset = () => {
    fullResetProcessor();
    setLastValidResults(null);
    clearArrhythmiaWindows();
    weakSignalsCountRef.current = 0;
    validSignalsCountRef.current = 0;
    signalBufferRef.current = [];
    clearLog();
  };

  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter: getArrhythmiaCounter(),
    lastValidResults,
    arrhythmiaWindows,
    debugInfo: getDebugInfo()
  };
};
