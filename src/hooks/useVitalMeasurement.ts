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
  const [rawBPMReadings, setRawBPMReadings] = useState<number[]>([]);

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
      setRawBPMReadings([]);
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

      if (bpm > 40 && bpm < 180) {
        setRawBPMReadings(prev => [...prev, bpm]);
      }

      if (glucoseProcessor && glucoseProcessor.calculateGlucose) {
        try {
          const ppgData = processor.getPPGData ? processor.getPPGData() : [];
          
          const rawGlucoseValue = glucoseProcessor.calculateGlucose(ppgData);
          
          if (rawGlucoseValue && rawGlucoseValue > 0) {
            setRawGlucoseReadings(prev => [...prev, rawGlucoseValue]);
            
            console.log('useVitalMeasurement - Nuevo valor de glucosa:', {
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
        let finalBPM = prev.heartRate;
        if (rawBPMReadings.length > 2) {
          const sortedBPM = [...rawBPMReadings].sort((a, b) => a - b);
          const medianBPM = sortedBPM[Math.floor(sortedBPM.length / 2)];
          finalBPM = medianBPM;
        } else if (bpm > 0) {
          finalBPM = bpm;
        }

        let finalGlucose = prev.glucose;
        if (rawGlucoseReadings.length > 2) {
          const sortedGlucose = [...rawGlucoseReadings].sort((a, b) => a - b);
          
          const cutStart = Math.floor(sortedGlucose.length * 0.1);
          const cutEnd = Math.floor(sortedGlucose.length * 0.9);
          const filteredGlucose = sortedGlucose.slice(cutStart, cutEnd + 1);
          
          if (filteredGlucose.length > 0) {
            const medianGlucose = filteredGlucose[Math.floor(filteredGlucose.length / 2)];
            finalGlucose = Math.round(medianGlucose);
          } else if (sortedGlucose.length > 0) {
            const medianGlucose = sortedGlucose[Math.floor(sortedGlucose.length / 2)];
            finalGlucose = Math.round(medianGlucose);
          }
        } else if (rawGlucoseReadings.length > 0) {
          finalGlucose = Math.round(rawGlucoseReadings[rawGlucoseReadings.length - 1]);
        }

        let pressureString = prev.pressure;
        const vitalSignsProcessor = (window as any).vitalSignsProcessor;
        if (vitalSignsProcessor && vitalSignsProcessor.calculateBloodPressure) {
          try {
            const ppgData = processor.getPPGData ? processor.getPPGData() : [];
            if (ppgData && ppgData.length > 0) {
              const bp = vitalSignsProcessor.calculateBloodPressure(ppgData);
              if (bp && bp.systolic > 0 && bp.diastolic > 0) {
                pressureString = `${bp.systolic}/${bp.diastolic}`;
              }
            }
          } catch (error) {
            console.error('Error calculando presión arterial:', error);
          }
        }

        if (
          prev.heartRate !== finalBPM || 
          prev.glucose !== finalGlucose || 
          prev.pressure !== pressureString
        ) {
          const newValues = {
            ...prev,
            heartRate: finalBPM,
            glucose: finalGlucose,
            pressure: pressureString
          };
          
          console.log('useVitalMeasurement - Actualizando valores', {
            prevHeartRate: prev.heartRate,
            newHeartRate: finalBPM,
            prevGlucose: prev.glucose,
            newGlucose: finalGlucose,
            prevPressure: prev.pressure,
            newPressure: pressureString,
            totalReadings: {
              bpm: rawBPMReadings.length,
              glucose: rawGlucoseReadings.length
            },
            elapsedTime,
            timestamp: new Date().toISOString()
          });
          
          return newValues;
        }
        
        return prev;
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
        lecturasBPM: rawBPMReadings.length,
        timestamp: new Date().toISOString()
      });
      
      setElapsedTime(elapsed / 1000);

      updateMeasurements();

      if (elapsed >= MEASUREMENT_DURATION) {
        console.log('useVitalMeasurement - Medición completada', {
          duracionTotal: MEASUREMENT_DURATION / 1000,
          resultadosFinal: {...measurements},
          totalLecturasGlucosa: rawGlucoseReadings.length,
          totalLecturasBPM: rawBPMReadings.length,
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
  }, [isMeasuring, measurements, elapsedTime, rawGlucoseReadings, rawBPMReadings]);

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 30),
    isComplete: elapsedTime >= 30
  };
};
