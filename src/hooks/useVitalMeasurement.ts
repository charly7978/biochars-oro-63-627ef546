
import { useState, useEffect } from 'react';

interface VitalMeasurements {
  heartRate: number;
  spo2: number;
  pressure: string;
  arrhythmiaCount: string | number;
  glucose: number; // Added glucose to the measurements interface
}

export const useVitalMeasurement = (isMeasuring: boolean) => {
  const [measurements, setMeasurements] = useState<VitalMeasurements>({
    heartRate: 0,
    spo2: 0,
    pressure: "--/--",
    arrhythmiaCount: 0,
    glucose: 0  // Initialize glucose value
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [stableGlucose, setStableGlucose] = useState(0); // Added state for stable glucose readings

  useEffect(() => {
    console.log('useVitalMeasurement - Estado detallado:', {
      isMeasuring,
      currentMeasurements: measurements,
      elapsedTime,
      timestamp: new Date().toISOString(),
      session: Math.random().toString(36).substring(2, 9) // Identificador único para esta sesión
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
          arrhythmiaCount: "--",
          glucose: 0 // Reset glucose value
        };
        
        console.log('useVitalMeasurement - Nuevos valores tras reinicio', newValues);
        return newValues;
      });
      
      setElapsedTime(0);
      setStableGlucose(0); // Reset stable glucose
      return;
    }

    const startTime = Date.now();
    console.log('useVitalMeasurement - Iniciando medición', {
      startTime: new Date(startTime).toISOString(),
      prevValues: {...measurements}
    });
    
    const MEASUREMENT_DURATION = 30000;
    const STABILIZATION_THRESHOLD = 20; // Time in seconds before stabilizing glucose reading

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
      const glucoseProcessor = (window as any).glucoseProcessor;
      
      console.log('useVitalMeasurement - Actualización detallada:', {
        processor: !!processor,
        processorType: processor ? typeof processor : 'undefined',
        processorMethods: processor ? Object.getOwnPropertyNames(processor.__proto__) : [],
        bpm,
        rawBPM: processor.getFinalBPM(),
        confidence: processor.getConfidence ? processor.getConfidence() : 'N/A',
        glucoseProcessor: !!glucoseProcessor,
        timestamp: new Date().toISOString()
      });

      // Only update once we have a reasonable amount of data (15 seconds in)
      // This prevents the fluctuating values during initial measurement
      if (elapsedTime >= STABILIZATION_THRESHOLD && glucoseProcessor && !stableGlucose) {
        try {
          // Get glucose value from processor if available
          const glucoseValue = glucoseProcessor.calculateGlucose ?
            Math.round(glucoseProcessor.calculateGlucose([])) : 0;
          
          if (glucoseValue > 0) {
            console.log('useVitalMeasurement - Estableciendo nivel de glucosa estable', {
              value: glucoseValue,
              elapsedTime,
              timestamp: new Date().toISOString()
            });
            setStableGlucose(glucoseValue);
          }
        } catch (error) {
          console.error('Error obteniendo valor de glucosa:', error);
        }
      }

      setMeasurements(prev => {
        if (prev.heartRate === bpm && 
            (elapsedTime < STABILIZATION_THRESHOLD || (stableGlucose > 0 && prev.glucose === stableGlucose))) {
          return prev;
        }
        
        // Update glucose only once we have a stable reading
        const glucoseValue = elapsedTime >= STABILIZATION_THRESHOLD ? 
          (stableGlucose || prev.glucose) : 0;
        
        const newValues = {
          ...prev,
          heartRate: bpm,
          glucose: glucoseValue // Use stable glucose value
        };
        
        console.log('useVitalMeasurement - Actualizando valores', {
          prevBPM: prev.heartRate,
          newBPM: bpm,
          prevGlucose: prev.glucose,
          newGlucose: glucoseValue,
          stableGlucose,
          elapsedTime,
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
        stableGlucose,
        timestamp: new Date().toISOString()
      });
      
      setElapsedTime(elapsed / 1000);

      updateMeasurements();

      if (elapsed >= MEASUREMENT_DURATION) {
        console.log('useVitalMeasurement - Medición completada', {
          duracionTotal: MEASUREMENT_DURATION / 1000,
          resultadosFinal: {...measurements, glucose: stableGlucose},
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
  }, [isMeasuring, measurements, elapsedTime, stableGlucose]);

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 30),
    isComplete: elapsedTime >= 30
  };
};
