
import { useState, useEffect } from 'react';

interface VitalMeasurements {
  heartRate: number;
  spo2: number;
  pressure: string;
  arrhythmiaCount: string | number;
  glucose: number;
}

export const useVitalMeasurement = (isMeasuring: boolean) => {
  const [measurements, setMeasurements] = useState<VitalMeasurements>({
    heartRate: 0,
    spo2: 0,
    pressure: "--/--",
    arrhythmiaCount: 0,
    glucose: 0
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [rawGlucoseReadings, setRawGlucoseReadings] = useState<number[]>([]);

  useEffect(() => {
    console.log('useVitalMeasurement - Estado detallado:', {
      isMeasuring,
      currentMeasurements: measurements,
      elapsedTime,
      timestamp: new Date().toISOString(),
      session: Math.random().toString(36).substring(2, 9)
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
          glucose: 0
        };
        
        console.log('useVitalMeasurement - Nuevos valores tras reinicio', newValues);
        return newValues;
      });
      
      setElapsedTime(0);
      setRawGlucoseReadings([]);
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

      // Get raw glucose value directly from the processor using current PPG data
      if (glucoseProcessor) {
        try {
          // Use the processor's calculateGlucose method without simulated data
          // Pass an empty array to let the processor use its internal buffer
          const rawGlucoseValue = glucoseProcessor.calculateGlucose ? 
            Math.round(glucoseProcessor.calculateGlucose([])) : 0;
          
          if (rawGlucoseValue > 0) {
            // Store all readings for trend analysis
            setRawGlucoseReadings(prev => [...prev, rawGlucoseValue]);
            
            console.log('useVitalMeasurement - Nuevo valor de glucosa real:', {
              valor: rawGlucoseValue,
              totalLecturas: rawGlucoseReadings.length + 1,
              tiempoTranscurrido: elapsedTime,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error obteniendo valor de glucosa:', error);
        }
      }

      setMeasurements(prev => {
        // Only update if actual values have changed or if we have new glucose readings
        const latestGlucoseReading = rawGlucoseReadings.length > 0 ? 
          rawGlucoseReadings[rawGlucoseReadings.length - 1] : prev.glucose;
        
        if (prev.heartRate === bpm && prev.glucose === latestGlucoseReading) {
          return prev;
        }
        
        const newValues = {
          ...prev,
          heartRate: bpm,
          glucose: latestGlucoseReading
        };
        
        console.log('useVitalMeasurement - Actualizando valores', {
          frecuenciaAnterior: prev.heartRate,
          nuevaFrecuencia: bpm,
          glucosaAnterior: prev.glucose,
          nuevaGlucosa: latestGlucoseReading,
          totalLecturasGlucosa: rawGlucoseReadings.length,
          tiempoTranscurrido: elapsedTime,
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
        lecturasGlucosa: rawGlucoseReadings.length,
        timestamp: new Date().toISOString()
      });
      
      setElapsedTime(elapsed / 1000);

      updateMeasurements();

      if (elapsed >= MEASUREMENT_DURATION) {
        console.log('useVitalMeasurement - Medición completada', {
          duracionTotal: MEASUREMENT_DURATION / 1000,
          resultadosFinal: {...measurements},
          totalLecturasGlucosa: rawGlucoseReadings.length,
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
  }, [isMeasuring, measurements, elapsedTime, rawGlucoseReadings]);

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 30),
    isComplete: elapsedTime >= 30
  };
};
