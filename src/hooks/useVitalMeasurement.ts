
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

  useEffect(() => {
    console.log('useVitalMeasurement - Estado detallado:', {
      isMeasuring,
      currentMeasurements: measurements,
      elapsedTime,
      arrhythmiaWindows: arrhythmiaWindows.length,
      timestamp: new Date().toISOString(),
      session: sessionId.current
    });

    if (!isMeasuring) {
      console.log('useVitalMeasurement - Reiniciando mediciones por detención', {
        prevValues: {...measurements},
        timestamp: new Date().toISOString()
      });
      
      setMeasurements(prev => {
        const newValues = {
          ...prev,
          heartRate: 0,
          spo2: 0,
          pressure: "--/--",
          arrhythmiaCount: "--"
        };
        
        console.log('useVitalMeasurement - Nuevos valores tras reinicio', newValues);
        return newValues;
      });
      
      setElapsedTime(0);
      setArrhythmiaWindows([]);
      return;
    }

    const startTime = Date.now();
    console.log('useVitalMeasurement - Iniciando medición', {
      startTime: new Date(startTime).toISOString(),
      prevValues: {...measurements}
    });
    
    const MEASUREMENT_DURATION = 30000;

    const updateMeasurements = () => {
      const processor = (window as any).heartBeatProcessor;
      if (!processor) {
        console.warn('VitalMeasurement: No se encontró el procesador', {
          windowObject: Object.keys(window),
          timestamp: new Date().toISOString()
        });
        return;
      }

      const bpm = processor.getFinalBPM() || 0;
      const arrhythmias = processor.getArrhythmiaCounter ? processor.getArrhythmiaCounter() : 0;
      
      console.log('useVitalMeasurement - Actualización detallada:', {
        processor: !!processor,
        processorType: processor ? typeof processor : 'undefined',
        processorMethods: processor ? Object.getOwnPropertyNames(processor.__proto__) : [],
        bpm,
        arrhythmias,
        rawBPM: processor.getFinalBPM(),
        confidence: processor.getConfidence ? processor.getConfidence() : 'N/A',
        arritmiaWindows: processor.getArrhythmiaWindows ? processor.getArrhythmiaWindows() : [],
        timestamp: new Date().toISOString()
      });

      // Verificamos si hay ventanas de arritmia disponibles
      if (processor.getArrhythmiaWindows && typeof processor.getArrhythmiaWindows === 'function') {
        const windows = processor.getArrhythmiaWindows();
        if (windows && Array.isArray(windows) && windows.length > 0) {
          setArrhythmiaWindows(windows);
        }
      }

      setMeasurements(prev => {
        if (prev.heartRate === bpm && prev.arrhythmiaCount === arrhythmias) {
          console.log('useVitalMeasurement - Valores sin cambios, no se actualiza', {
            currentBPM: prev.heartRate,
            currentArrhythmias: prev.arrhythmiaCount,
            timestamp: new Date().toISOString()
          });
          return prev;
        }
        
        const newValues = {
          ...prev,
          heartRate: bpm,
          arrhythmiaCount: arrhythmias
        };
        
        console.log('useVitalMeasurement - Actualizando valores', {
          prevBPM: prev.heartRate,
          newBPM: bpm,
          prevArrhythmias: prev.arrhythmiaCount,
          newArrhythmias: arrhythmias,
          timestamp: new Date().toISOString()
        });
        
        return newValues;
      });
    };

    updateMeasurements();

    const interval = setInterval(() => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      
      console.log('useVitalMeasurement - Progreso de medición', {
        elapsed: elapsed / 1000,
        porcentaje: (elapsed / MEASUREMENT_DURATION) * 100,
        timestamp: new Date().toISOString()
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
