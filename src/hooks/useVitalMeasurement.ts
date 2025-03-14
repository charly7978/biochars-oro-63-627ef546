
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
  const [stableGlucose, setStableGlucose] = useState(0);
  const [glucoseReadings, setGlucoseReadings] = useState<number[]>([]);

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
      setStableGlucose(0);
      setGlucoseReadings([]);
      return;
    }

    const startTime = Date.now();
    console.log('useVitalMeasurement - Iniciando medición', {
      startTime: new Date(startTime).toISOString(),
      prevValues: {...measurements}
    });
    
    const MEASUREMENT_DURATION = 30000;
    const STABILIZATION_THRESHOLD = 15; // Reduced to 15 seconds for earlier glucose reading
    const FINAL_STABILIZATION = 25; // Use data from 25-30 seconds for final reading

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

      // Calculate glucose after the initial stabilization period
      if (elapsedTime >= STABILIZATION_THRESHOLD && glucoseProcessor) {
        try {
          // Get glucose value from processor
          const rawGlucoseValue = glucoseProcessor.calculateGlucose ? 
            Math.round(glucoseProcessor.calculateGlucose([])) : 0;
          
          if (rawGlucoseValue > 0) {
            // Store all readings for later analysis
            setGlucoseReadings(prev => [...prev, rawGlucoseValue]);
            
            console.log('useVitalMeasurement - Nuevo valor de glucosa:', {
              raw: rawGlucoseValue,
              totalReadings: glucoseReadings.length + 1,
              elapsedTime,
              timestamp: new Date().toISOString()
            });
            
            // In the final 5 seconds, calculate a more stable average
            if (elapsedTime >= FINAL_STABILIZATION) {
              // Take last 10 readings (or all if less than 10)
              const recentReadings = [...glucoseReadings, rawGlucoseValue].slice(-10);
              
              // Filter out extreme outliers (outside ±20% of median)
              const sortedReadings = [...recentReadings].sort((a, b) => a - b);
              const median = sortedReadings[Math.floor(sortedReadings.length / 2)];
              const filteredReadings = recentReadings.filter(
                value => value >= median * 0.8 && value <= median * 1.2
              );
              
              // Calculate weighted average (more recent = higher weight)
              let weightedSum = 0;
              let weightSum = 0;
              
              filteredReadings.forEach((value, index) => {
                const weight = index + 1;
                weightedSum += value * weight;
                weightSum += weight;
              });
              
              const newStableGlucose = Math.round(weightSum > 0 ? 
                weightedSum / weightSum : 
                (median || rawGlucoseValue));
              
              // Only update if significantly different from previous stable value
              if (Math.abs(newStableGlucose - stableGlucose) > 5 || stableGlucose === 0) {
                console.log('useVitalMeasurement - Actualizando nivel de glucosa estable', {
                  prevStable: stableGlucose,
                  newStable: newStableGlucose,
                  recentReadings,
                  filteredReadings,
                  median,
                  elapsedTime,
                  timestamp: new Date().toISOString()
                });
                
                setStableGlucose(newStableGlucose);
              }
            }
          }
        } catch (error) {
          console.error('Error obteniendo valor de glucosa:', error);
        }
      }

      setMeasurements(prev => {
        // Calculate glucose value to display
        let displayGlucose = prev.glucose;
        
        // After initial stabilization, show current readings
        if (elapsedTime >= STABILIZATION_THRESHOLD) {
          // In the final phase, use stable reading
          if (elapsedTime >= FINAL_STABILIZATION && stableGlucose > 0) {
            displayGlucose = stableGlucose;
          } 
          // In between initial stabilization and final phase, show latest reading
          else if (glucoseReadings.length > 0) {
            displayGlucose = glucoseReadings[glucoseReadings.length - 1];
          }
        }
        
        // Only update if values have changed
        if (prev.heartRate === bpm && prev.glucose === displayGlucose) {
          return prev;
        }
        
        const newValues = {
          ...prev,
          heartRate: bpm,
          glucose: displayGlucose
        };
        
        console.log('useVitalMeasurement - Actualizando valores', {
          prevBPM: prev.heartRate,
          newBPM: bpm,
          prevGlucose: prev.glucose,
          newGlucose: displayGlucose,
          stableGlucose,
          glucoseReadings: glucoseReadings.length,
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
          resultadosFinal: {...measurements, glucose: stableGlucose || measurements.glucose},
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
  }, [isMeasuring, measurements, elapsedTime, stableGlucose, glucoseReadings]);

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 30),
    isComplete: elapsedTime >= 30
  };
};
