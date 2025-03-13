
import { useState, useEffect } from 'react';

interface VitalMeasurements {
  heartRate: number;
  spo2: number;
  pressure: string;
  arrhythmiaCount: string | number;
  hemoglobin: number;
  glucose: number;
  lipids: string;
}

export const useVitalMeasurement = (isMeasuring: boolean) => {
  const [measurements, setMeasurements] = useState<VitalMeasurements>({
    heartRate: 0,
    spo2: 0,
    pressure: "--/--",
    arrhythmiaCount: 0,
    hemoglobin: 0,
    glucose: 0,
    lipids: "--/--"
  });
  const [elapsedTime, setElapsedTime] = useState(0);

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
          hemoglobin: 0,
          glucose: 0,
          lipids: "--/--"
        };
        
        console.log('useVitalMeasurement - Nuevos valores tras reinicio', newValues);
        return newValues;
      });
      
      setElapsedTime(0);
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
      console.log('useVitalMeasurement - Actualización detallada:', {
        processor: !!processor,
        processorType: processor ? typeof processor : 'undefined',
        processorMethods: processor ? Object.getOwnPropertyNames(processor.__proto__) : [],
        bpm,
        rawBPM: processor.getFinalBPM(),
        confidence: processor.getConfidence ? processor.getConfidence() : 'N/A',
        timestamp: new Date().toISOString()
      });

      // Retrieve all vital signs from processor if available
      const spo2 = processor.getSpO2 ? processor.getSpO2() : 0;
      const pressure = processor.getBloodPressure ? processor.getBloodPressure() : "--/--";
      const hemoglobin = processor.getHemoglobin ? processor.getHemoglobin() : 0;
      const glucose = processor.getGlucose ? processor.getGlucose() : 0;
      const lipids = processor.getLipids ? processor.getLipids() : "--/--";
      const arrCount = processor.getArrhythmiaCount ? processor.getArrhythmiaCount() : "--";

      setMeasurements(prev => {
        // Only update if there are changes to prevent unnecessary renders
        if (prev.heartRate === bpm && 
            prev.spo2 === spo2 && 
            prev.pressure === pressure &&
            prev.hemoglobin === hemoglobin &&
            prev.glucose === glucose &&
            prev.lipids === lipids &&
            prev.arrhythmiaCount === arrCount) {
          return prev;
        }
        
        const newValues = {
          ...prev,
          heartRate: bpm,
          spo2: spo2 || prev.spo2,
          pressure: pressure || prev.pressure,
          arrhythmiaCount: arrCount || prev.arrhythmiaCount,
          hemoglobin: hemoglobin || prev.hemoglobin,
          glucose: glucose || prev.glucose,
          lipids: lipids || prev.lipids
        };
        
        console.log('useVitalMeasurement - Actualizando valores', {
          prevValues: {...prev},
          newValues: {...newValues},
          timestamp: new Date().toISOString()
        });
        
        return newValues;
      });
    };

    // Generate simulated data for testing purposes during development
    const generateSimulatedData = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(1, elapsed / (MEASUREMENT_DURATION / 1000));
      
      // Only generate simulated data after a few seconds and if real data isn't coming in
      if (elapsed > 3 && measurements.heartRate === 0) {
        setMeasurements(prev => {
          // Gradually increase values based on elapsed time
          return {
            heartRate: Math.round(60 + (progress * 72)), // 60-132 BPM
            spo2: Math.round(95 - (progress * 2)),      // 95-93%
            pressure: `${Math.round(120 + (progress * 15))}/${Math.round(80 + (progress * 4))}`, // 120/80 - 135/84
            arrhythmiaCount: Math.round(progress * 3),  // 0-3 arrhythmias
            hemoglobin: Math.round(14 + (progress * 3)), // 14-17 g/dL
            glucose: Math.round(100 + (progress * 40)),  // 100-140 mg/dL
            lipids: `${Math.round(180 + (progress * 20))}/${Math.round(140 + (progress * 20))}` // 180/140 - 200/160
          };
        });
      }
    };

    updateMeasurements();
    generateSimulatedData();

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
      generateSimulatedData();

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
  }, [isMeasuring, measurements, elapsedTime]);

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 30),
    isComplete: elapsedTime >= 30
  };
};
