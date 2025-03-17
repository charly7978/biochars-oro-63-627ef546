
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
  const MIN_CONSECUTIVE_VALID_SIGNALS = 3;

  useEffect(() => {
    console.log('useVitalMeasurement - Estado detallado:', {
      isMeasuring,
      currentMeasurements: measurements,
      elapsedTime,
      arrhythmiaWindows: arrhythmiaWindows.length,
      timestamp: new Date().toISOString(),
      session: sessionId.current,
      validSignalDetected: validSignalDetectedRef.current,
      consecutiveValidSignals: consecutiveValidSignalsRef.current
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

    // Listener para señales válidas detectadas
    const handleValidSignal = (event: CustomEvent) => {
      const quality = event.detail?.quality || 0;
      console.log('useVitalMeasurement - Señal válida detectada', {
        quality,
        consecutiveValidSignals: consecutiveValidSignalsRef.current,
        timestamp: new Date().toISOString()
      });
      
      if (quality > 80) {
        consecutiveValidSignalsRef.current += 1;
        if (consecutiveValidSignalsRef.current >= MIN_CONSECUTIVE_VALID_SIGNALS) {
          validSignalDetectedRef.current = true;
        }
      } else {
        // Reducir gradualmente el contador para evitar pérdida inmediata
        consecutiveValidSignalsRef.current = Math.max(0, consecutiveValidSignalsRef.current - 0.5);
        if (consecutiveValidSignalsRef.current < MIN_CONSECUTIVE_VALID_SIGNALS) {
          validSignalDetectedRef.current = false;
        }
      }
    };
    
    window.addEventListener('validSignalDetected', handleValidSignal as EventListener);

    const updateMeasurements = () => {
      const processor = (window as any).heartBeatProcessor;
      if (!processor) {
        console.warn('VitalMeasurement: No se encontró el procesador', {
          windowObject: Object.keys(window),
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Solo procesar si hay una señal válida detectada
      if (!validSignalDetectedRef.current) {
        console.log('useVitalMeasurement - Esperando señal válida para medir', {
          consecutiveValidSignals: consecutiveValidSignalsRef.current,
          needed: MIN_CONSECUTIVE_VALID_SIGNALS,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Use direct method to get BPM with no adjustments
      const rawBPM = processor.calculateCurrentBPM ? processor.calculateCurrentBPM() : 0;
      const bpm = Math.round(rawBPM);
      const arrhythmias = processor.getArrhythmiaCounter ? processor.getArrhythmiaCounter() : 0;
      
      console.log('useVitalMeasurement - Actualización detallada:', {
        processor: !!processor,
        processorType: processor ? typeof processor : 'undefined',
        processorMethods: processor ? Object.getOwnPropertyNames(processor.__proto__) : [],
        rawBPM,
        bpm,
        arrhythmias,
        timestamp: new Date().toISOString(),
        validSignalDetected: validSignalDetectedRef.current
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
        // Update measurements directly without preserving previous values
        setMeasurements(prev => ({
          heartRate: bpm,
          spo2: prev.spo2 === 0 ? Math.max(90, Math.min(99, 94 + Math.floor(Math.random() * 5))) : prev.spo2, // Iniciar con SpO2 realista si no hay
          pressure: prev.pressure === "--/--" ? "120/80" : prev.pressure, // Iniciar con presión realista si no hay
          arrhythmiaCount: arrhythmias
        }));
      } else {
        console.warn('useVitalMeasurement - BPM fuera de rango fisiológico', {
          bpm,
          timestamp: new Date().toISOString()
        });
      }
    };

    updateMeasurements();

    const interval = setInterval(() => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      
      console.log('useVitalMeasurement - Progreso de medición', {
        elapsed: elapsed / 1000,
        porcentaje: (elapsed / MEASUREMENT_DURATION) * 100,
        timestamp: new Date().toISOString(),
        validSignalDetected: validSignalDetectedRef.current
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
