
import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { updateSignalLog } from '../utils/signalLogUtils';
import { ArrhythmiaAnalyzer, ArrhythmiaConfig } from './arrhythmia/arrhythmiaAnalysis';

interface ArrhythmiaWindow {
  start: number;
  end: number;
}

/**
 * Advanced hook for processing vital signs with cutting-edge algorithms
 * Implements state-of-the-art signal processing and arrhythmia detection
 */
export const useVitalSignsProcessor = () => {
  // State management
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  
  // References for internal state
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const arrhythmiaAnalyzerRef = useRef<ArrhythmiaAnalyzer | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  // Advanced configuration with optimized parameters for reducir falsos positivos
  const arrhythmiaConfig = useRef<ArrhythmiaConfig>({
    // Parámetros optimizados para sincronización precisa con beeps
    MIN_TIME_BETWEEN_ARRHYTHMIAS: 15000, // 15 segundos entre arritmias
    MAX_ARRHYTHMIAS_PER_SESSION: 5,     // Máximo 5 por sesión
    SIGNAL_QUALITY_THRESHOLD: 0.75,     // Umbral de calidad reducido
    SEQUENTIAL_DETECTION_THRESHOLD: 0.55, // Umbral para detección secuencial ajustado
    SPECTRAL_FREQUENCY_THRESHOLD: 0.40   // Umbral para validación de frecuencia ajustado
  });
  
  // Initialize processor components
  useEffect(() => {
    processorRef.current = new VitalSignsProcessor();
    arrhythmiaAnalyzerRef.current = new ArrhythmiaAnalyzer(arrhythmiaConfig.current);
    
    console.log("useVitalSignsProcessor: Advanced processor initialized", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString(),
      parameters: { ...arrhythmiaConfig.current }
    });
    
    return () => {
      console.log("useVitalSignsProcessor: Advanced processor destroyed", {
        sessionId: sessionId.current,
        totalArrhythmias: arrhythmiaAnalyzerRef.current?.getArrhythmiaCounter() || 0,
        processedSignals: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  /**
   * Register a new arrhythmia window with advanced visualization parameters
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    // Limit to most recent arrhythmia windows (up to 3) for visualization
    setArrhythmiaWindows(prev => {
      const newWindows = [...prev, { start, end }];
      return newWindows.slice(-3);
    });
  }, []);
  
  /**
   * Process PPG signal using advanced algorithms for vital signs extraction
   * and arrhythmia detection with multi-parameter classification
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      }
    };
    
    processedSignals.current++;
    
    // Log detailed processing information for diagnostics
    console.log("useVitalSignsProcessor: Processing signal", {
      inputValue: value,
      rrDataPresent: !!rrData,
      rrIntervals: rrData?.intervals.length || 0,
      lastIntervals: rrData?.intervals.slice(-3) || [],
      arrhythmiaCount: arrhythmiaAnalyzerRef.current.getArrhythmiaCounter(),
      signalNumber: processedSignals.current,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Process signal through vital signs processor
    let result = processorRef.current.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Procesar arritmias solo si hay suficientes datos
    if (rrData && rrData.intervals.length >= 8) {
      // Process arrhythmia data with advanced algorithms
      result = arrhythmiaAnalyzerRef.current.processArrhythmiaData(rrData, result);
      
      // If arrhythmia detected, register visualization window
      if (result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") && result.lastArrhythmiaData) {
        const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
        
        // Create window centered on arrhythmia with dynamic width based on heart rate
        // Para sincronización con beeps, usamos ventana más precisa
        let windowWidth = 800; // 800ms ventana por defecto
        
        // Ajustar ancho según intervalos RR si disponibles
        if (rrData.intervals.length > 0) {
          const lastIntervals = rrData.intervals.slice(-5);
          const avgInterval = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
          // Ventana de 1.5x el intervalo RR promedio
          windowWidth = Math.max(500, Math.min(1200, avgInterval * 1.5));
        }
        
        addArrhythmiaWindow(arrhythmiaTime - windowWidth/2, arrhythmiaTime + windowWidth/2);
      }
    }
    
    // Update signal log with complete information
    signalLog.current = updateSignalLog(signalLog.current, currentTime, value, result, processedSignals.current);
    
    // Store valid results with comprehensive metrics
    if (result.spo2 > 0 && result.glucose > 0 && result.lipids.totalCholesterol > 0) {
      console.log("useVitalSignsProcessor: Valid result detected", {
        spo2: result.spo2,
        pressure: result.pressure,
        glucose: result.glucose,
        lipids: result.lipids,
        timestamp: new Date().toISOString()
      });
      setLastValidResults(result);
    }
    
    return result;
  }, [addArrhythmiaWindow]);

  /**
   * Perform soft reset - maintain results but reinitialize processors
   */
  const reset = useCallback(() => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return null;
    
    console.log("useVitalSignsProcessor: Soft reset initiated", {
      previousState: {
        arrhythmias: arrhythmiaAnalyzerRef.current.getArrhythmiaCounter(),
        lastResults: lastValidResults ? {
          spo2: lastValidResults.spo2,
          pressure: lastValidResults.pressure
        } : null
      },
      timestamp: new Date().toISOString()
    });
    
    const savedResults = processorRef.current.reset();
    arrhythmiaAnalyzerRef.current.reset();
    setArrhythmiaWindows([]);
    
    if (savedResults) {
      console.log("useVitalSignsProcessor: Preserving results after reset", {
        savedResults: {
          spo2: savedResults.spo2,
          pressure: savedResults.pressure,
          arrhythmiaStatus: savedResults.arrhythmiaStatus
        },
        timestamp: new Date().toISOString()
      });
      
      setLastValidResults(savedResults);
    } else {
      console.log("useVitalSignsProcessor: No results to preserve after reset", {
        timestamp: new Date().toISOString()
      });
    }
    
    console.log("Soft reset completed - preserving results");
    return savedResults;
  }, [lastValidResults]);
  
  /**
   * Perform full reset - clear all data and reinitialize processors
   */
  const fullReset = useCallback(() => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return;
    
    console.log("useVitalSignsProcessor: Full reset initiated", {
      previousState: {
        arrhythmias: arrhythmiaAnalyzerRef.current.getArrhythmiaCounter(),
        lastResults: lastValidResults ? {
          spo2: lastValidResults.spo2,
          pressure: lastValidResults.pressure
        } : null,
        processedSignals: processedSignals.current
      },
      timestamp: new Date().toISOString()
    });
    
    processorRef.current.fullReset();
    arrhythmiaAnalyzerRef.current.reset();
    setLastValidResults(null);
    setArrhythmiaWindows([]);
    processedSignals.current = 0;
    signalLog.current = [];
    console.log("Full reset completed - all data cleared");
  }, [processorRef, lastValidResults]);

  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter: arrhythmiaAnalyzerRef.current?.getArrhythmiaCounter() || 0,
    lastValidResults,
    arrhythmiaWindows,
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10)
    }
  };
};
