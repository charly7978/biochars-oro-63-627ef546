
import { useState, useEffect, useRef } from 'react';

interface VitalMeasurements {
  heartRate: number;
  spo2: number;
  pressure: string;
  arrhythmiaCount: string | number;
}

interface ArrhythmiaWindow {
  start: number;
  end: number;
}

export const useVitalMeasurement = (isMeasuring: boolean) => {
  const [measurements, setMeasurements] = useState<VitalMeasurements>({
    heartRate: 0,
    spo2: 0,
    pressure: "--/--",
    arrhythmiaCount: 0
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const validSignalDetectedRef = useRef<boolean>(false);
  const consecutiveValidSignalsRef = useRef<number>(0);
  const MIN_CONSECUTIVE_VALID_SIGNALS = 1.5; // Reducido para mayor sensibilidad inicial
  const lastMeasurementTimeRef = useRef<number>(0);
  const measurementIntervalRef = useRef<number>(100); // Intervalo entre mediciones en ms
  const lastQualityScoreRef = useRef<number>(0);
  const qualityHistoryRef = useRef<{quality: number, stable: boolean, timestamp: number}[]>([]);

  useEffect(() => {
    console.log('useVitalMeasurement - Estado detallado:', {
      isMeasuring,
      currentMeasurements: measurements,
      elapsedTime,
      arrhythmiaWindows: arrhythmiaWindows.length,
      timestamp: new Date().toISOString(),
      session: sessionId.current,
      validSignalDetected: validSignalDetectedRef.current,
      consecutiveValidSignals: consecutiveValidSignalsRef.current,
      lastQualityScore: lastQualityScoreRef.current,
      qualityHistoryLength: qualityHistoryRef.current.length
    });

    // Always reset to zero when stopping or not measuring
    if (!isMeasuring) {
      console.log('useVitalMeasurement - Reiniciando mediciones a cero', {
        prevValues: {...measurements},
        timestamp: new Date().toISOString()
      });
      
      setMeasurements({
        heartRate: 0,
        spo2: 0,
        pressure: "--/--",
        arrhythmiaCount: "--"
      });
      
      setElapsedTime(0);
      setArrhythmiaWindows([]);
      validSignalDetectedRef.current = false;
      consecutiveValidSignalsRef.current = 0;
      lastMeasurementTimeRef.current = 0;
      lastQualityScoreRef.current = 0;
      qualityHistoryRef.current = [];
      return;
    }

    const startTime = Date.now();
    console.log('useVitalMeasurement - Iniciando medición desde cero', {
      startTime: new Date(startTime).toISOString()
    });
    
    // Reset measurements to zero at start
    setMeasurements({
      heartRate: 0,
      spo2: 0,
      pressure: "--/--",
      arrhythmiaCount: 0
    });
    
    const MEASUREMENT_DURATION = 30000;

    // Listener mejorado para señales válidas detectadas
    const handleValidSignal = (event: CustomEvent) => {
      const detail = event.detail || {};
      const quality = detail.quality || 0;
      const stable = detail.stable || false;
      const variance = detail.variance || 0;
      const stabilityScore = detail.stabilityScore || 0;
      
      // Actualizar historial de calidad para análisis
      qualityHistoryRef.current.push({
        quality,
        stable,
        timestamp: Date.now()
      });
      
      // Mantener sólo los últimos 10 datos de calidad
      if (qualityHistoryRef.current.length > 10) {
        qualityHistoryRef.current.shift();
      }
      
      // Calcular promedio ponderado de calidad reciente
      let weightedQualitySum = 0;
      let weightSum = 0;
      
      qualityHistoryRef.current.forEach((entry, idx) => {
        const weight = Math.pow(1.2, idx); // Más peso a entradas recientes
        weightedQualitySum += entry.quality * weight;
        weightSum += weight;
      });
      
      const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
      lastQualityScoreRef.current = avgQuality;
      
      console.log('useVitalMeasurement - Análisis de señal detallado', {
        quality,
        avgQuality,
        stable,
        variance,
        stabilityScore,
        consecutiveValidSignals: consecutiveValidSignalsRef.current,
        timestamp: new Date().toISOString()
      });
      
      // Detección más sensible pero también más exigente con la estabilidad
      if (quality > 50 && avgQuality > 45) {
        const stabilityBonus = stable ? 0.5 : 0;
        const qualityFactor = quality > 70 ? 0.4 : 0.3;
        
        // Incremento proporcional a la calidad
        consecutiveValidSignalsRef.current += stabilityBonus + qualityFactor;
        
        // Limitar el máximo para evitar falsos positivos prolongados
        consecutiveValidSignalsRef.current = Math.min(5, consecutiveValidSignalsRef.current);
        
        if (consecutiveValidSignalsRef.current >= MIN_CONSECUTIVE_VALID_SIGNALS) {
          validSignalDetectedRef.current = true;
        }
      } else {
        // Reducción gradual para evitar pérdida inmediata de señal
        consecutiveValidSignalsRef.current = Math.max(0, consecutiveValidSignalsRef.current - 0.3);
        
        // Si cae demasiado, invalidar la señal
        if (consecutiveValidSignalsRef.current < MIN_CONSECUTIVE_VALID_SIGNALS) {
          validSignalDetectedRef.current = false;
        }
      }
    };
    
    window.addEventListener('validSignalDetected', handleValidSignal as EventListener);

    const updateMeasurements = () => {
      const currentTime = Date.now();
      
      // Limitar frecuencia de actualizaciones para evitar cargar la UI
      if (currentTime - lastMeasurementTimeRef.current < measurementIntervalRef.current) {
        return;
      }
      lastMeasurementTimeRef.current = currentTime;
      
      const processor = (window as any).heartBeatProcessor;
      if (!processor) {
        console.warn('VitalMeasurement: No se encontró el procesador', {
          windowObject: Object.keys(window),
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Solo procesar si hay una señal válida detectada con calidad suficiente
      if (!validSignalDetectedRef.current) {
        console.log('useVitalMeasurement - Esperando señal válida para medir', {
          consecutiveValidSignals: consecutiveValidSignalsRef.current,
          needed: MIN_CONSECUTIVE_VALID_SIGNALS,
          lastQualityScore: lastQualityScoreRef.current,
          qualityHistory: qualityHistoryRef.current.length,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Use direct method to get BPM with no adjustments
      const rawBPM = processor.calculateCurrentBPM ? processor.calculateCurrentBPM() : 0;
      const bpm = Math.round(rawBPM);
      const arrhythmias = processor.getArrhythmiaCounter ? processor.getArrhythmiaCounter() : 0;
      
      // Obtener SpO2 directamente del procesador - SIN NINGÚN VALOR INICIAL
      let spo2Value = processor.getLastSpO2 ? processor.getLastSpO2() : 0;
      
      // Obtener presión arterial directamente del procesador - SIN NINGÚN VALOR INICIAL
      let pressureValue = processor.getLastBloodPressure ? processor.getLastBloodPressure() : "--/--";
      
      console.log('useVitalMeasurement - Actualización detallada:', {
        processor: !!processor,
        processorType: processor ? typeof processor : 'undefined',
        processorMethods: processor ? Object.getOwnPropertyNames(processor.__proto__) : [],
        rawBPM,
        bpm,
        spo2Value,
        pressureValue,
        arrhythmias,
        timestamp: new Date().toISOString(),
        validSignalDetected: validSignalDetectedRef.current,
        lastQualityScore: lastQualityScoreRef.current
      });

      // Check for arrhythmia windows
      if (processor.getArrhythmiaWindows && typeof processor.getArrhythmiaWindows === 'function') {
        const windows = processor.getArrhythmiaWindows();
        if (windows && Array.isArray(windows) && windows.length > 0) {
          setArrhythmiaWindows(windows);
        }
      }

      // Verificar que el BPM sea fisiológicamente plausible (40-180)
      if (bpm >= 40 && bpm <= 180) {
        // Update measurements - priorizar nuevos valores sólo si son válidos
        setMeasurements(prev => ({
          heartRate: bpm,
          spo2: spo2Value > 0 ? spo2Value : prev.spo2, 
          pressure: pressureValue !== "--/--" ? pressureValue : prev.pressure,
          arrhythmiaCount: arrhythmias
        }));
      } else {
        console.warn('useVitalMeasurement - BPM fuera de rango fisiológico', {
          bpm,
          timestamp: new Date().toISOString()
        });
      }
    };

    // Realizar una primera medición inmediata
    updateMeasurements();

    const interval = setInterval(() => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      
      console.log('useVitalMeasurement - Progreso de medición', {
        elapsed: elapsed / 1000,
        porcentaje: (elapsed / MEASUREMENT_DURATION) * 100,
        timestamp: new Date().toISOString(),
        validSignalDetected: validSignalDetectedRef.current,
        lastQualityScore: lastQualityScoreRef.current
      });
      
      setElapsedTime(elapsed / 1000);

      updateMeasurements();

      if (elapsed >= MEASUREMENT_DURATION) {
        console.log('useVitalMeasurement - Medición completada', {
          duracionTotal: MEASUREMENT_DURATION / 1000,
          resultadosFinal: {...measurements},
          arrhythmiaWindows: arrhythmiaWindows.length,
          timestamp: new Date().toISOString()
        });
        
        clearInterval(interval);
        const event = new CustomEvent('measurementComplete');
        window.dispatchEvent(event);
      }
    }, 200);

    return () => {
      console.log('useVitalMeasurement - Limpiando intervalo', {
        currentElapsed: elapsedTime,
        timestamp: new Date().toISOString()
      });
      window.removeEventListener('validSignalDetected', handleValidSignal as EventListener);
      clearInterval(interval);
    };
  }, [isMeasuring, measurements, arrhythmiaWindows.length]);

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 30),
    isComplete: elapsedTime >= 30,
    arrhythmiaWindows
  };
};
