
import { useState, useEffect, useRef } from 'react';

interface VitalMeasurements {
  heartRate: number;
  spo2: number;
  pressure: string;
}

export const useVitalMeasurement = (isMeasuring: boolean) => {
  const [measurements, setMeasurements] = useState<VitalMeasurements>({
    heartRate: 0,
    spo2: 0,
    pressure: "--/--"
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));

  useEffect(() => {
    console.log('useVitalMeasurement - Estado detallado:', {
      isMeasuring,
      currentMeasurements: measurements,
      elapsedTime,
      timestamp: new Date().toISOString(),
      session: sessionId.current
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
        pressure: "--/--"
      });
      
      setElapsedTime(0);
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
      pressure: "--/--"
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

      // Use direct method to get BPM with no adjustments
      const rawBPM = processor.calculateCurrentBPM ? processor.calculateCurrentBPM() : 0;
      const bpm = Math.round(rawBPM);
      
      console.log('useVitalMeasurement - Actualización detallada:', {
        processor: !!processor,
        processorType: processor ? typeof processor : 'undefined',
        processorMethods: processor ? Object.getOwnPropertyNames(processor.__proto__) : [],
        rawBPM,
        bpm,
        timestamp: new Date().toISOString()
      });

      // Update measurements directly without preserving previous values
      setMeasurements({
        heartRate: bpm,
        spo2: 0, // These will be updated by the VitalSignsProcessor
        pressure: "--/--"
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
  }, [isMeasuring, measurements]);

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 30),
    isComplete: elapsedTime >= 30
  };
};
