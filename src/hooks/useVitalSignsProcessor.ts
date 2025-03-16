
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
  
  // Advanced configuration with optimized parameters
  const arrhythmiaConfig = useRef<ArrhythmiaConfig>({
    MIN_TIME_BETWEEN_ARRHYTHMIAS: 10000, // 10 segundos entre arritmias
    MAX_ARRHYTHMIAS_PER_SESSION: 10,     // Máximo 10 por sesión para no perder datos críticos
    SIGNAL_QUALITY_THRESHOLD: 0.60,      // Umbral de calidad ajustado
    SEQUENTIAL_DETECTION_THRESHOLD: 0.50, // Umbral para detección secuencial
    SPECTRAL_FREQUENCY_THRESHOLD: 0.35    // Umbral para validación de frecuencia
  });
  
  // Initialize processor components
  useEffect(() => {
    console.log("useVitalSignsProcessor: Inicializando procesador con nueva configuración", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Crear nuevas instancias para asegurar estado limpio
    processorRef.current = new VitalSignsProcessor();
    arrhythmiaAnalyzerRef.current = new ArrhythmiaAnalyzer(arrhythmiaConfig.current);
    
    return () => {
      console.log("useVitalSignsProcessor: Limpieza del procesador", {
        sessionId: sessionId.current,
        totalArrhythmias: arrhythmiaAnalyzerRef.current?.getArrhythmiaCounter() || 0,
        processedSignals: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  /**
   * Register a new arrhythmia window for visualization
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    // Limitar a las ventanas de arritmia más recientes para visualización
    setArrhythmiaWindows(prev => {
      const newWindows = [...prev, { start, end }];
      return newWindows.slice(-3); // Mantener solo las 3 más recientes
    });
  }, []);
  
  /**
   * Process PPG signal using advanced algorithms for vital signs extraction
   * and arrhythmia detection with real-time classification
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) {
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
    }
    
    processedSignals.current++;
    
    // Log de procesamiento para diagnóstico
    if (processedSignals.current % 30 === 0) {
      console.log("useVitalSignsProcessor: Procesando señal", {
        inputValue: value,
        rrDataPresent: !!rrData,
        rrIntervals: rrData?.intervals.length || 0,
        arrhythmiaCount: arrhythmiaAnalyzerRef.current.getArrhythmiaCounter(),
        signalNumber: processedSignals.current,
        sessionId: sessionId.current
      });
    }
    
    // Procesar señal a través del procesador principal
    let result = processorRef.current.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Procesar arritmias solo si hay suficientes datos
    if (rrData && rrData.intervals.length >= 6) {
      // Analizar datos con algoritmos avanzados
      result = arrhythmiaAnalyzerRef.current.processArrhythmiaData(rrData, result);
      
      // Si se detecta arritmia, registrar ventana de visualización
      if (result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") && result.lastArrhythmiaData) {
        const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
        
        // Ventana dinámica basada en la frecuencia cardíaca
        let windowWidth = 600; // 600ms ventana por defecto
        
        // Ajustar ancho según intervalos RR
        if (rrData.intervals.length > 0) {
          const lastIntervals = rrData.intervals.slice(-5);
          const avgInterval = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
          // Ventana proporcional al intervalo RR
          windowWidth = Math.max(400, Math.min(1000, avgInterval * 1.2));
        }
        
        addArrhythmiaWindow(arrhythmiaTime - windowWidth/2, arrhythmiaTime + windowWidth/2);
      }
    }
    
    // Actualizar registro de señal
    signalLog.current = updateSignalLog(signalLog.current, currentTime, value, result, processedSignals.current);
    
    // Almacenar resultados válidos
    if (result.spo2 > 0 && result.glucose > 0 && result.lipids.totalCholesterol > 0) {
      if (processedSignals.current % 50 === 0) {
        console.log("useVitalSignsProcessor: Resultado válido detectado", {
          spo2: result.spo2,
          pressure: result.pressure,
          timestamp: new Date().toISOString()
        });
      }
      setLastValidResults(result);
    }
    
    return result;
  }, [addArrhythmiaWindow]);

  /**
   * Realizar reset suave - mantener resultados pero reinicializar procesadores
   */
  const reset = useCallback(() => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reset suave iniciado");
    
    const savedResults = processorRef.current.reset();
    arrhythmiaAnalyzerRef.current.reset();
    setArrhythmiaWindows([]);
    
    if (savedResults) {
      setLastValidResults(savedResults);
    }
    
    console.log("Reset suave completado - manteniendo resultados");
    return savedResults;
  }, [lastValidResults]);
  
  /**
   * Realizar reset completo - limpiar todos los datos y reinicializar procesadores
   */
  const fullReset = useCallback(() => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return;
    
    console.log("useVitalSignsProcessor: Reset completo iniciado");
    
    processorRef.current.fullReset();
    arrhythmiaAnalyzerRef.current.reset();
    setLastValidResults(null);
    setArrhythmiaWindows([]);
    processedSignals.current = 0;
    signalLog.current = [];
    console.log("Reset completo terminado - todos los datos limpiados");
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
