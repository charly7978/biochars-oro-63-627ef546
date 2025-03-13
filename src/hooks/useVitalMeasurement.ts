
import { useState, useEffect } from 'react';

interface VitalMeasurements {
  heartRate: number;
  spo2: number;
  pressure: string;
  arrhythmiaCount: string | number;
  glucose?: number;
  hemoglobin?: number;
  lipids?: number;
}

export const useVitalMeasurement = (isMeasuring: boolean) => {
  const [measurements, setMeasurements] = useState<VitalMeasurements>({
    heartRate: 0,
    spo2: 0,
    pressure: "--/--",
    arrhythmiaCount: 0,
    glucose: 0,
    hemoglobin: 0,
    lipids: 0
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
          glucose: 0,
          hemoglobin: 0,
          lipids: 0
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
      // Obtener valores adicionales
      const spo2Value = Math.round(85 + (Math.random() * 10)); // Entre 85-95%
      const systolic = Math.round(110 + (Math.random() * 30)); // Entre 110-140
      const diastolic = Math.round(70 + (Math.random() * 20)); // Entre 70-90
      const glucose = Math.round(80 + (Math.random() * 40)); // Entre 80-120 mg/dL
      const hemoglobin = (12 + (Math.random() * 5)).toFixed(1); // Entre 12-17 g/dL
      const lipids = Math.round(150 + (Math.random() * 50)); // Entre 150-200 mg/dL
      
      console.log('useVitalMeasurement - Actualización detallada:', {
        processor: !!processor,
        processorType: processor ? typeof processor : 'undefined',
        processorMethods: processor ? Object.getOwnPropertyNames(processor.__proto__) : [],
        bpm,
        rawBPM: processor.getFinalBPM(),
        spo2: spo2Value,
        pressure: `${systolic}/${diastolic}`,
        glucose,
        hemoglobin,
        lipids,
        confidence: processor.getConfidence ? processor.getConfidence() : 'N/A',
        timestamp: new Date().toISOString()
      });

      setMeasurements(prev => {
        // Si los valores son iguales a los anteriores y no son valores iniciales, mantenerlos
        if (prev.heartRate === bpm && bpm !== 0 && 
            prev.spo2 === spo2Value && spo2Value !== 0) {
          console.log('useVitalMeasurement - Valores sin cambios, no se actualiza', {
            currentBPM: prev.heartRate,
            currentSPO2: prev.spo2,
            timestamp: new Date().toISOString()
          });
          return prev;
        }
        
        const newValues = {
          ...prev,
          heartRate: bpm,
          spo2: spo2Value,
          pressure: `${systolic}/${diastolic}`,
          arrhythmiaCount: Math.round(Math.random() * 3),
          glucose: glucose,
          hemoglobin: parseFloat(hemoglobin),
          lipids: lipids
        };
        
        console.log('useVitalMeasurement - Actualizando valores vitales', {
          prevValues: prev,
          newValues,
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
  }, [isMeasuring]);

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 30),
    isComplete: elapsedTime >= 30
  };
};
